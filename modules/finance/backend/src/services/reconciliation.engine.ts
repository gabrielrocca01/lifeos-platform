// ============================================================
// Finance OS — ReconciliationEngine
// Confronta le voci del kakebo fisico con le transazioni bancarie
// e produce un report dettagliato con match, mancanti e discrepanze.
// ============================================================

import { Transaction } from '../shared/models/index.js';
import {
  KakeboEntry, ReconciliationMatch, ReconciliationReport,
  ReconciliationSession, MatchCandidate, MatchConfig,
  MatchType, DEFAULT_MATCH_CONFIG
} from '../shared/models/kakebo.models.js';

export class ReconciliationEngine {

  constructor(private config: MatchConfig = DEFAULT_MATCH_CONFIG) {}

  // ------------------------------------------------------------
  // ENTRY POINT — produce il report completo per un mese
  // ------------------------------------------------------------
  reconcile(
    kakeboEntries: KakeboEntry[],
    bankTransactions: Transaction[],
    month: string
  ): ReconciliationReport {

    const matched: ReconciliationMatch[] = [];
    const kakeboOnly: ReconciliationMatch[] = [];
    const usedBankIds = new Set<string>();

    // Separa le voci cash — non avranno mai un match bancario
    const cashEntries = kakeboEntries.filter(k => k.isCash);
    const nonCashEntries = kakeboEntries.filter(k => !k.isCash);

    // Per ogni voce kakebo non-cash, cerca il miglior match bancario
    for (const kakebo of nonCashEntries) {
      const candidates = this.findCandidates(kakebo, bankTransactions, usedBankIds);

      if (candidates.length === 0 || candidates[0].score < 40) {
        // Nessun match accettabile
        kakeboOnly.push({
          kakeboEntry: kakebo,
          bankTransaction: undefined,
          matchType: 'none',
          confidence: 0,
          delta: kakebo.amount,
          daysDiff: 0,
          issues: this.buildIssues(kakebo, undefined),
        });
      } else {
        const best = candidates[0];
        usedBankIds.add(best.transaction.id);
        matched.push({
          kakeboEntry: kakebo,
          bankTransaction: best.transaction,
          matchType: best.matchType,
          confidence: best.score / 100,
          delta: best.delta,
          daysDiff: best.daysDiff,
          issues: this.buildIssues(kakebo, best),
        });
      }
    }

    // Voci cash → sempre unmatched, ma senza "problema"
    for (const cash of cashEntries) {
      kakeboOnly.push({
        kakeboEntry: cash,
        bankTransaction: undefined,
        matchType: 'none',
        confidence: 0,
        delta: 0,
        daysDiff: 0,
        issues: [],  // contanti sono attesi come unmatched
      });
    }

    // Transazioni bancarie senza corrispondenza nel kakebo
    const bankOnly = bankTransactions.filter(t =>
      !usedBankIds.has(t.id) && t.status !== 'excluded'
    );

    const summary = this.buildSummary(kakeboEntries, bankTransactions, matched, bankOnly);
    const session = this.buildSession(month, kakeboEntries, bankTransactions, matched, bankOnly, summary);

    return { session, matched, kakeboOnly, bankOnly, summary };
  }

  // ------------------------------------------------------------
  // ALGORITMO DI SCORING — trova i candidati migliori per una voce
  // ------------------------------------------------------------
  private findCandidates(
    kakebo: KakeboEntry,
    transactions: Transaction[],
    usedIds: Set<string>
  ): MatchCandidate[] {

    const candidates: MatchCandidate[] = [];
    const kakeboDate = new Date(kakebo.date);

    for (const tx of transactions) {
      if (usedIds.has(tx.id)) continue;
      if (tx.direction !== kakebo.direction) continue; // entrata vs uscita non si matchano

      const txDate = new Date(tx.date);
      const daysDiff = Math.abs(
        (txDate.getTime() - kakeboDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const amountDiff = Math.abs(tx.amount - kakebo.amount);

      // Scarta subito se fuori tolleranza massima
      if (daysDiff > this.config.maxDaysDiff * 2) continue;
      if (amountDiff > kakebo.amount * 0.2 && amountDiff > 5) continue;

      const score = this.computeScore(kakebo, tx, daysDiff, amountDiff);
      if (score < 20) continue;

      const matchType = this.classifyMatch(daysDiff, amountDiff);

      candidates.push({ transaction: tx, score, matchType, delta: amountDiff, daysDiff });
    }

    // Ordina per score decrescente
    return candidates.sort((a, b) => b.score - a.score);
  }

  private computeScore(
    kakebo: KakeboEntry,
    tx: Transaction,
    daysDiff: number,
    amountDiff: number
  ): number {
    let score = 100;

    // Penalità per differenza di data (0 diff = 0 penalità, 2 giorni = -30)
    score -= daysDiff * 15;

    // Penalità per differenza di importo
    if (amountDiff === 0) {
      // nessuna penalità
    } else if (amountDiff <= 0.10) {
      score -= 5;
    } else if (amountDiff <= 0.50) {
      score -= 15;
    } else if (amountDiff <= 2.00) {
      score -= 30;
    } else {
      score -= 50;
    }

    // Bonus se le descrizioni si somigliano
    const descSimilarity = this.stringSimilarity(
      kakebo.description.toLowerCase(),
      (tx.description || tx.merchant || '').toLowerCase()
    );
    score += descSimilarity * 20 * this.config.descriptionWeight;

    // Bonus se l'account hint combacia con la banca della transazione
    if (kakebo.accountHint && tx.account) {
      const hint = kakebo.accountHint.toLowerCase();
      const bankName = tx.account.bankName?.toLowerCase() || '';
      if (bankName.includes(hint) || hint.includes(bankName)) {
        score += 10;
      }
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private classifyMatch(daysDiff: number, amountDiff: number): MatchType {
    if (daysDiff === 0 && amountDiff < 0.01) return 'exact';
    if (daysDiff <= this.config.maxDaysDiff && amountDiff <= this.config.maxAmountDiff) return 'fuzzy';
    if (amountDiff < 0.01) return 'amount_only';
    return 'fuzzy';
  }

  // ------------------------------------------------------------
  // HELPER — costruisce la lista problemi per una voce
  // ------------------------------------------------------------
  private buildIssues(kakebo: KakeboEntry, match: MatchCandidate | undefined): string[] {
    const issues: string[] = [];

    if (!match) {
      if (!kakebo.isCash) {
        issues.push('Nessuna transazione bancaria corrispondente trovata');
        issues.push('Verifica: pagamento in contanti? Importo diverso? Data molto diversa?');
      }
      return issues;
    }

    if (match.delta > 0.01) {
      issues.push(`Differenza importo: €${match.delta.toFixed(2)} (kakebo €${kakebo.amount.toFixed(2)} vs banca €${match.transaction.amount.toFixed(2)})`);
    }
    if (match.daysDiff > 0) {
      issues.push(`Differenza data: ${match.daysDiff} giorn${match.daysDiff === 1 ? 'o' : 'i'}`);
    }
    if (match.score < 60) {
      issues.push('Match incerto — verifica manualmente');
    }

    return issues;
  }

  // ------------------------------------------------------------
  // HELPER — somiglianza tra stringhe (Dice coefficient)
  // ------------------------------------------------------------
  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const getBigrams = (str: string) => {
      const bigrams = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.substring(i, i + 2));
      }
      return bigrams;
    };

    const bigramsA = getBigrams(a);
    const bigramsB = getBigrams(b);
    let intersection = 0;
    for (const bg of bigramsA) {
      if (bigramsB.has(bg)) intersection++;
    }

    return (2 * intersection) / (bigramsA.size + bigramsB.size);
  }

  // ------------------------------------------------------------
  // HELPER — costruisce il riepilogo numerico
  // ------------------------------------------------------------
  private buildSummary(
    kakebo: KakeboEntry[],
    bank: Transaction[],
    matched: ReconciliationMatch[],
    bankOnly: Transaction[]
  ) {
    const kakeboTotal = kakebo
      .filter(k => k.direction === 'out')
      .reduce((sum, k) => sum + k.amount, 0);

    const bankTotal = bank
      .filter(t => t.direction === 'out' && t.status !== 'excluded')
      .reduce((sum, t) => sum + t.amount, 0);

    const delta = Math.abs(kakeboTotal - bankTotal);
    const deltaPercent = kakeboTotal > 0 ? (delta / kakeboTotal) * 100 : 0;
    const cashEntries = kakebo.filter(k => k.isCash).length;
    const accuracy = kakebo.length > 0
      ? (matched.length / kakebo.filter(k => !k.isCash).length) * 100
      : 0;

    return {
      kakeboTotal: Math.round(kakeboTotal * 100) / 100,
      bankTotal: Math.round(bankTotal * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      deltaPercent: Math.round(deltaPercent * 10) / 10,
      cashEntries,
      accuracy: Math.round(accuracy * 10) / 10,
    };
  }

  private buildSession(
    month: string,
    kakebo: KakeboEntry[],
    bank: Transaction[],
    matched: ReconciliationMatch[],
    bankOnly: Transaction[],
    summary: ReturnType<typeof this.buildSummary>
  ): ReconciliationSession {
    return {
      id: '',
      month,
      fiscalYear: month.split('-')[0],
      status: 'open',
      kakeboCount: kakebo.length,
      bankCount: bank.length,
      matchedCount: matched.length,
      unmatchedKakebo: kakebo.length - matched.length,
      unmatchedBank: bankOnly.length,
      discrepancySum: summary.delta,
      createdAt: new Date().toISOString(),
    };
  }
}
