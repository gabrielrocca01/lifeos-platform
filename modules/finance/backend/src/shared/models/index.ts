// ============================================================
// Finance OS — Shared Domain Models
// Usati sia dal backend Node.js che dal frontend Angular
// Copia in: backend/src/models/ e frontend/src/app/shared/models/
// ============================================================

// ------------------------------------------------------------
// ENUMS
// ------------------------------------------------------------

export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'prepaid'
  | 'investment'
  | 'cash';

export type TransactionDirection = 'in' | 'out';

export type TransactionStatus = 'pending' | 'confirmed' | 'excluded';

export type ImportFormat =
  | 'fineco'
  | 'n26'
  | 'revolut'
  | 'unicredit'
  | 'intesa'
  | 'trade_republic'
  | 'paypal'
  | 'generic';

export type TaxDocumentType =
  | 'cu'
  | '730'
  | 'estratto_conto'
  | 'fattura'
  | 'ricevuta'
  | 'f24'
  | 'altro';

// Codici sezione Quadro E del 730
export type Code730 =
  | 'E1'   // Spese sanitarie
  | 'E2'   // Spese sanitarie per disabili
  | 'E3'   // Spese per veicoli disabili
  | 'E4'   // Spese per cani guida
  | 'E5'   // Spese funebri
  | 'E6'   // Spese per istruzione
  | 'E7'   // Spese per attività sportive ragazzi
  | 'E8'   // Spese per intermediazione immobiliare
  | 'E9'   // Canoni di locazione studenti
  | 'E10'  // Erogazioni liberali
  | 'E13'  // Premi assicurazione vita/infortuni
  | 'E14'  // Interessi mutuo abitazione principale
  | 'E17'  // Spese veterinarie
  | 'E19'  // Spese per asili nido
  | 'B1'   // Interessi mutuo
  | '19';  // Detrazione 19% generica

// ------------------------------------------------------------
// ACCOUNT
// ------------------------------------------------------------

export interface Account {
  id: string;
  name: string;
  bankName: string;
  iban?: string;
  type: AccountType;
  currency: string;
  balance: number;
  colorTag: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountDto {
  name: string;
  bankName: string;
  iban?: string;
  type: AccountType;
  currency?: string;
  balance?: number;
  colorTag?: string;
  notes?: string;
}

export interface UpdateAccountDto extends Partial<CreateAccountDto> {
  isActive?: boolean;
}

// Per la dashboard: account con saldo calcolato dalle transazioni
export interface AccountWithBalance extends Account {
  balanceComputed: number;
  transactionCount: number;
}

// ------------------------------------------------------------
// CATEGORY
// ------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  icon: string;
  color: string;
  isDeductible: boolean;
  deductibleCode730?: Code730;
  isSystem: boolean;
  createdAt: string;
  children?: Category[]; // popolato in frontend per albero
}

export interface CreateCategoryDto {
  name: string;
  parentId?: string;
  icon?: string;
  color?: string;
  isDeductible?: boolean;
  deductibleCode730?: Code730;
}

// ------------------------------------------------------------
// IMPORT BATCH
// ------------------------------------------------------------

export interface ImportBatch {
  id: string;
  accountId: string;
  filename: string;
  format: ImportFormat;
  rowsTotal: number;
  rowsImported: number;
  rowsSkipped: number;
  periodFrom?: string;
  periodTo?: string;
  importedAt: string;
  notes?: string;
}

export interface ImportBatchResult {
  batch: ImportBatch;
  imported: Transaction[];
  skipped: CsvRow[];
  duplicates: CsvRow[];
}

// Riga CSV grezza prima del mapping
export interface CsvRow {
  [key: string]: string;
}

// ------------------------------------------------------------
// TRANSACTION
// ------------------------------------------------------------

export interface Transaction {
  id: string;
  accountId: string;
  categoryId?: string;
  importBatchId?: string;

  amount: number;
  direction: TransactionDirection;
  description: string;
  merchant?: string;
  date: string;          // YYYY-MM-DD
  fiscalYear: string;    // es. "2024"

  isDeductible: boolean;
  deductibleType?: string;
  deductiblePct: number;

  status: TransactionStatus;
  isTransfer: boolean;
  transferPairId?: string;

  notes?: string;
  tags?: string[];

  createdAt: string;
  updatedAt: string;

  // Relazioni (popolate opzionalmente dal backend)
  account?: Pick<Account, 'id' | 'name' | 'bankName' | 'colorTag'>;
  category?: Pick<Category, 'id' | 'name' | 'icon' | 'color'>;
}

export interface CreateTransactionDto {
  accountId: string;
  categoryId?: string;
  amount: number;
  direction: TransactionDirection;
  description: string;
  merchant?: string;
  date: string;
  isDeductible?: boolean;
  deductibleType?: string;
  deductiblePct?: number;
  isTransfer?: boolean;
  transferPairId?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateTransactionDto extends Partial<CreateTransactionDto> {
  status?: TransactionStatus;
}

// ------------------------------------------------------------
// FILTRI & PAGINAZIONE
// ------------------------------------------------------------

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  direction?: TransactionDirection;
  status?: TransactionStatus;
  dateFrom?: string;
  dateTo?: string;
  fiscalYear?: string;
  isDeductible?: boolean;
  isTransfer?: boolean;
  search?: string;       // cerca in description e merchant
  tags?: string[];
  minAmount?: number;
  maxAmount?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// ------------------------------------------------------------
// TAX RECORDS
// ------------------------------------------------------------

export interface TaxRecord {
  id: string;
  fiscalYear: string;
  documentType: TaxDocumentType;
  filename?: string;
  filePath?: string;
  totalDeductible: number;
  taxCreditEstimate: number;
  redditoImponibile?: number;   // dalla CU
  irpefTrattenuta?: number;     // dalla CU
  notes?: string;
  uploadedAt: string;
}

export interface CreateTaxRecordDto {
  fiscalYear: string;
  documentType: TaxDocumentType;
  filename?: string;
  totalDeductible?: number;
  redditoImponibile?: number;
  irpefTrattenuta?: number;
  notes?: string;
}

// ------------------------------------------------------------
// DEDUCTIBLE ITEMS
// ------------------------------------------------------------

export interface DeductibleItem {
  id: string;
  transactionId?: string;
  taxRecordId?: string;
  fiscalYear: string;
  code730: Code730;
  category: string;
  description?: string;
  amount: number;
  deductiblePct: number;
  deductibleAmount: number;  // calcolato: amount * pct / 100
  confirmed: boolean;
  createdAt: string;

  // Relazioni
  transaction?: Pick<Transaction, 'id' | 'description' | 'date' | 'merchant'>;
}

export interface CreateDeductibleItemDto {
  transactionId?: string;
  taxRecordId?: string;
  fiscalYear: string;
  code730: Code730;
  category: string;
  description?: string;
  amount: number;
  deductiblePct?: number;
}

// ------------------------------------------------------------
// BUDGETS
// ------------------------------------------------------------

export interface Budget {
  id: string;
  categoryId: string;
  monthlyLimit: number;
  fiscalYear: string;
  active: boolean;
  createdAt: string;

  // Calcolati (non nel DB)
  currentMonthSpent?: number;
  percentageUsed?: number;
  category?: Pick<Category, 'id' | 'name' | 'icon' | 'color'>;
}

export interface CreateBudgetDto {
  categoryId: string;
  monthlyLimit: number;
  fiscalYear?: string;
}

// ------------------------------------------------------------
// ANALYTICS & DASHBOARD
// ------------------------------------------------------------

// Riepilogo mensile per categoria (dalla view v_monthly_by_category)
export interface MonthlyByCategory {
  month: string;          // YYYY-MM
  fiscalYear: string;
  category: string;
  categoryId: string;
  color: string;
  totalOut: number;
  totalIn: number;
  txCount: number;
}

// Riepilogo detraibili per anno (dalla view v_deductible_summary)
export interface DeductibleSummary {
  fiscalYear: string;
  code730: Code730;
  category: string;
  itemCount: number;
  totalAmount: number;
  totalDeductible: number;
  confirmedDeductible: number;
}

// Overview dashboard
export interface DashboardOverview {
  totalBalance: number;                          // somma saldi tutti i conti attivi
  accounts: AccountWithBalance[];
  currentMonth: {
    totalIn: number;
    totalOut: number;
    net: number;
    topCategories: MonthlyByCategory[];
  };
  fiscalYear: {
    year: string;
    totalDeductible: number;
    taxCreditEstimate: number;
    deductibleByCode: DeductibleSummary[];
  };
  budgets: Budget[];
  recentTransactions: Transaction[];
}

// Dati per Chart.js — flussi mensili
export interface CashFlowChartData {
  labels: string[];      // mesi: ["Gen", "Feb", ...]
  income: number[];
  expenses: number[];
  net: number[];
}

// Dati per Chart.js — spese per categoria (donut)
export interface CategoryChartData {
  labels: string[];
  amounts: number[];
  colors: string[];
  categoryIds: string[];
}

// ------------------------------------------------------------
// API RESPONSES
// ------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// ------------------------------------------------------------
// CSV IMPORT — configurazioni per ogni banca
// ------------------------------------------------------------

export interface CsvColumnMapping {
  date: string;
  description: string;
  amount?: string;
  amountIn?: string;
  amountOut?: string;
  merchant?: string;
  balance?: string;
  notes?: string;
}

export interface CsvImportConfig {
  format: ImportFormat;
  delimiter: string;
  dateFormat: string;          // es. "DD/MM/YYYY"
  encoding: string;            // es. "UTF-8", "ISO-8859-1"
  skipRows: number;            // righe header da saltare
  columns: CsvColumnMapping;
  amountSign?: 'separate' | 'sign' | 'always_positive'; // come leggere import/export
}

export const CSV_CONFIGS: Record<ImportFormat, CsvImportConfig> = {
  fineco: {
    format: 'fineco',
    delimiter: ';',
    dateFormat: 'DD/MM/YYYY',
    encoding: 'ISO-8859-1',
    skipRows: 7,
    columns: {
      date: 'Data',
      description: 'Descrizione operazione',
      amountIn: 'Entrate',
      amountOut: 'Uscite',
      merchant: 'Descrizione operazione',
      balance: 'Saldo contabile',
    },
    amountSign: 'separate',
  },
  n26: {
    format: 'n26',
    delimiter: ',',
    dateFormat: 'YYYY-MM-DD',
    encoding: 'UTF-8',
    skipRows: 1,
    columns: {
      date: 'Date',
      description: 'Partner Name',
      amount: 'Amount (EUR)',
      merchant: 'Partner Name',
      notes: 'Payment reference',
    },
    amountSign: 'sign',
  },
  revolut: {
    format: 'revolut',
    delimiter: ',',
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
    encoding: 'UTF-8',
    skipRows: 1,
    columns: {
      date: 'Started Date',
      description: 'Description',
      amount: 'Amount',
      merchant: 'Description',
      balance: 'Balance',
    },
    amountSign: 'sign',
  },
  unicredit: {
    format: 'unicredit',
    delimiter: ';',
    dateFormat: 'DD/MM/YYYY',
    encoding: 'UTF-8',
    skipRows: 1,
    columns: {
      date: 'Data Registrazione',
      description: 'Descrizione',
      amountIn: 'Accrediti',
      amountOut: 'Addebiti',
    },
    amountSign: 'separate',
  },
  intesa: {
    format: 'intesa',
    delimiter: ';',
    dateFormat: 'DD/MM/YYYY',
    encoding: 'UTF-8',
    skipRows: 1,
    columns: {
      date: 'Data operazione',
      description: 'Descrizione',
      amount: 'Importo',
      merchant: 'Descrizione',
    },
    amountSign: 'sign',
  },
  trade_republic: {
    format: 'trade_republic',
    delimiter: ',',
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
    encoding: 'UTF-8',
    skipRows: 1,
    columns: {
      date: 'date',
      description: 'description',
      amount: 'amount',
      merchant: 'counterparty_name',
    },
    amountSign: 'sign',
  },
  paypal: {
    format: 'paypal',
    delimiter: ',',
    dateFormat: 'DD/MM/YYYY',
    encoding: 'UTF-8',
    skipRows: 1,
    columns: {
      date: 'Data',
      description: 'Descrizione',
      amount: 'Netto',
      merchant: 'Nome',
    },
    amountSign: 'sign',
  },
  generic: {
    format: 'generic',
    delimiter: ',',
    dateFormat: 'YYYY-MM-DD',
    encoding: 'UTF-8',
    skipRows: 1,
    columns: {
      date: 'date',
      description: 'description',
      amount: 'amount',
    },
    amountSign: 'sign',
  },
};