# Finance OS — Backend: come avviarlo

## Setup (una tantum)

```bash
# 1. Vai nella cartella backend
cd finance-os/backend

# 2. Installa dipendenze
npm install

# 3. Copia i file shared nel posto giusto
#    (i modelli TypeScript condivisi)
mkdir -p src/shared
cp -r ../shared/models src/shared/

# 4. Verifica che ci siano i file connettori
#    (già scritti nella sessione precedente)
ls src/connectors/
# deve mostrare: connector.interface.ts, revolut.connector.ts,
#                fineco.connector.ts, index.ts
```

## Avvio in sviluppo

```bash
npm run dev
```

Il server parte su http://localhost:3000  
Il DB SQLite viene creato automaticamente in `data/finance-os.db`  
I 5 conti vengono inseriti al primo avvio (seed automatico).

## Test rapido da terminale

```bash
# Health check
curl http://localhost:3000/api/health

# Lista conti (i tuoi 5 conti già inseriti)
curl http://localhost:3000/api/accounts

# Lista connettori disponibili
curl http://localhost:3000/api/import/connectors

# Import CSV Revolut
curl -X POST http://localhost:3000/api/import/csv \
  -F "file=@/path/to/revolut-export.csv" \
  -F "account_id=acc_revolut" \
  -F "format=revolut"

# Import kakebo fisico
curl -X POST http://localhost:3000/api/kakebo/import-csv \
  -F "file=@/path/to/kakebo_aprile_2025.csv"

# Riconciliazione aprile 2025
curl -X POST http://localhost:3000/api/kakebo/reconcile \
  -H "Content-Type: application/json" \
  -d '{"month": "2025-04"}'

# Transazioni filtrate
curl "http://localhost:3000/api/transactions?fiscal_year=2025&is_deductible=true"
```

## Struttura backend

```
backend/
├── src/
│   ├── db/
│   │   ├── database.ts           ← wrapper SQLite (singleton)
│   │   ├── schema.sql            ← schema principale
│   │   └── schema.reconciliation.sql
│   ├── connectors/
│   │   ├── connector.interface.ts
│   │   ├── revolut.connector.ts
│   │   ├── fineco.connector.ts
│   │   ├── intesa.connector.ts
│   │   ├── trade-republic.connector.ts
│   │   ├── paypal.connector.ts
│   │   └── index.ts              ← registro connettori
│   ├── routes/
│   │   ├── accounts.ts
│   │   ├── transactions.ts
│   │   ├── import.ts
│   │   ├── kakebo.ts
│   │   ├── planned.ts
│   │   ├── investments.ts
│   │   └── fiscal.ts
│   ├── services/
│   │   └── reconciliation.engine.ts
│   └── index.ts                  ← entry point server
├── data/
│   └── finance-os.db             ← creato automaticamente
├── package.json
└── tsconfig.json
```
