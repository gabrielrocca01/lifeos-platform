// ============================================================
// Finance OS — Modelli Kakebo & Riconciliazione
// ============================================================

import { Transaction, Category } from './index.js';

// ------------------------------------------------------------
// KAKEBO ENTRY
// ------------------------------------------------------------

export type ReconciliationStatus = 'pending' | 'matched' | 'unmatched' | 'ignored';

export interface KakeboEntry {
  id: string;
  date: string;           // YYYY-MM-DD
  fiscalYear: string;
  month: string;          // YYYY-MM
  accountHint?: string;   // testo libero: "revolut", "contanti", "intesa"
  categoryId?: string;
  description: string;
  amount: number;
  direction: 'in' | 'out';
  notes?: string;
  isCash: boolean;
  reconciliationStatus: ReconciliationStatus;
  matchedTransactionId?: string;
  matchConfidence?: number;  // 0.0 - 1.0
  createdAt: string;
  updatedAt: string;

  // Relazioni opzionali (popolate dal backend)
  category?: Pick<Category, 'id' | 'name' | 'icon' | 'color'>;
  matchedTransaction?: Pick<Transaction, 'id' | 'description' | 'amount' | 'date' | 'merchant'>;
}

export interface CreateKakeboEntryDto {
  date: string;
  accountHint?: string;
  categoryId?: string;
  description: string;
  amount: number;
  direction: 'in' | 'out';
  notes?: string;
  isCash?: boolean;
}

// Riga del CSV kakebo fisico
export interface KakeboCsvRow {
  data: string;           // DD/MM/YYYY o YYYY-MM-DD
  conto: string;          // "revolut", "fineco", "contanti", ecc.
  categoria: string;      // nome categoria (viene mappato a categoryId)
  descrizione: string;
  importo: string;        // numero come stringa
  tipo: string;           // "uscita" | "entrata"
  note?: string;
  detraibile?: string;    // "si" | "no"
}

// ------------------------------------------------------------
// RICONCILIAZIONE
// ------------------------------------------------------------

export type MatchType =
  | 'exact'       // data e importo identici
  | 'fuzzy'       // data ±1 giorno, importo ±0.50€
  | 'amount_only' // stesso importo, data diversa
  | 'manual'      // abbinato manualmente dall'utente
  | 'none';       // nessun match

export interface ReconciliationMatch {
  kakeboEntry: KakeboEntry;
  bankTransaction?: Transaction;
  matchType: MatchType;
  confidence: number;       // 0.0 - 1.0
  delta: number;            // differenza importo (0 se exact)
  daysDiff: number;         // differenza giorni (0 se exact)
  issues: string[];         // es. ["importo diverso di €0.30"]
}

export interface ReconciliationSession {
  id: string;
  month: string;            // YYYY-MM
  fiscalYear: string;
  status: 'open' | 'completed' | 'archived';
  kakeboCount: number;
  bankCount: number;
  matchedCount: number;
  unmatchedKakebo: number;
  unmatchedBank: number;
  discrepancySum: number;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

// Risultato completo di una sessione di riconciliazione
export interface ReconciliationReport {
  session: ReconciliationSession;

  // Voci del kakebo con il loro match bancario (o assenza)
  matched: ReconciliationMatch[];       // trovata corrispondenza
  kakeboOnly: ReconciliationMatch[];    // nel kakebo, non in banca
  bankOnly: Transaction[];             // in banca, non nel kakebo

  // Riepilogo numerico
  summary: {
    kakeboTotal: number;
    bankTotal: number;
    delta: number;                     // differenza assoluta totale
    deltaPercent: number;              // % di errore sul totale
    cashEntries: number;               // voci contanti (attese come unmatched)
    accuracy: number;                  // % voci matchate sul totale kakebo
  };
}

// ------------------------------------------------------------
// ALGORITMO DI MATCHING — tipi ausiliari
// ------------------------------------------------------------

export interface MatchCandidate {
  transaction: Transaction;
  score: number;             // punteggio 0-100
  matchType: MatchType;
  delta: number;
  daysDiff: number;
}

// Configurazione tolleranze per il matching
export interface MatchConfig {
  maxDaysDiff: number;       // default: 2
  maxAmountDiff: number;     // default: 0.50€
  descriptionWeight: number; // 0-1: quanto pesa la somiglianza descrizione
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  maxDaysDiff: 2,
  maxAmountDiff: 0.50,
  descriptionWeight: 0.3,
};
