import type { CardFailure, CardLookupResult, CardOperationalStatus, CardSummary } from '@/types/copilot';
import type { FraudAlert, RiskScore, TransactionRecord, UploadedDataset } from '@/types/fraud';

function comparableCardId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function numericCardDigits(value: string) {
  return value.replace(/\D/g, '');
}

function hasEnoughCardSignal(value: string) {
  const comparable = comparableCardId(value);
  const digits = numericCardDigits(value);

  return comparable.length >= 4 && digits.length >= 1;
}

export function maskCardId(cardId: string) {
  const comparable = comparableCardId(cardId);
  if (comparable.length <= 4) {
    return 'Cartao localizado';
  }

  const prefix = cardId.slice(0, 2);
  const suffix = cardId.slice(-2);
  const middleMask = '*'.repeat(Math.max(2, cardId.length - 4));
  return `Cartao ${prefix}${middleMask}${suffix}`;
}

export function normalizeCardInput(value: string) {
  const trimmed = value.trim().toUpperCase();

  if (/^(RIO[- ]?)?\d{4,16}$/i.test(trimmed)) {
    const digits = numericCardDigits(trimmed);
    return trimmed.startsWith('RIO') ? `RIO-${digits}` : digits;
  }

  return trimmed;
}

export function isValidCardFormat(value: string) {
  return hasEnoughCardSignal(value.trim());
}

function scoreCandidate(input: string, candidate: string) {
  const normalizedInput = comparableCardId(input);
  const normalizedCandidate = comparableCardId(candidate);
  const inputDigits = numericCardDigits(input);
  const candidateDigits = numericCardDigits(candidate);

  if (!normalizedInput || !normalizedCandidate) {
    return -1;
  }

  if (normalizedCandidate === normalizedInput) {
    return 100;
  }

  if (inputDigits && candidateDigits === inputDigits) {
    return 96;
  }

  if (inputDigits && normalizedCandidate === `RIO${inputDigits}`) {
    return 94;
  }

  if (normalizedCandidate.startsWith(normalizedInput) || normalizedInput.startsWith(normalizedCandidate)) {
    return 82;
  }

  if (normalizedCandidate.includes(normalizedInput) || normalizedInput.includes(normalizedCandidate)) {
    return 70;
  }

  return -1;
}

function resolveCardId(dataset: UploadedDataset, input: string) {
  const candidates = [...new Set(dataset.transactions.map((transaction) => transaction.cardId).filter(Boolean))];

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(input, candidate),
    }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || left.candidate.length - right.candidate.length);

  return ranked[0]?.candidate ?? null;
}

function getRiskScore(alerts: FraudAlert[], transactions: TransactionRecord[]): RiskScore {
  const highRisk = alerts.some((alert) => alert.riskScore === 'alto');
  const mediumRisk = alerts.some((alert) => alert.riskScore === 'medio');
  const modelRisk = Math.max(...transactions.map((transaction) => transaction.modelRiskScore ?? 0), 0);
  const baseRisk = Math.max(...transactions.map((transaction) => transaction.baseRiskScore ?? 0), 0);

  if (highRisk || modelRisk >= 85 || baseRisk >= 85) {
    return 'alto';
  }

  if (mediumRisk || modelRisk >= 55 || baseRisk >= 55 || alerts.length > 0) {
    return 'medio';
  }

  return 'baixo';
}

function getEstimatedBalance(cardId: string, alerts: FraudAlert[], transactions: TransactionRecord[]) {
  const digits = Number(numericCardDigits(cardId).slice(-4) || '0');
  const latestFare = transactions[0]?.amount ?? 4.7;
  const highRiskCount = alerts.filter((alert) => alert.riskScore === 'alto').length;
  const estimated = 4.5 + (digits % 7) * 1.1 - alerts.length * 0.9 - highRiskCount * 1.8 - latestFare * 0.2;

  return Math.max(0, Number(estimated.toFixed(2)));
}

function explicitFailures(transactions: TransactionRecord[]): CardFailure[] {
  return transactions
    .filter((transaction) => {
      const status = transaction.status.toLowerCase();
      return ['falha', 'erro', 'negad', 'bloque'].some((snippet) => status.includes(snippet));
    })
    .slice(0, 3)
    .map((transaction) => {
      const status = transaction.status.toLowerCase();
      const type = status.includes('saldo')
        ? 'saldo_insuficiente'
        : status.includes('bloque')
          ? 'bloqueio'
          : status.includes('erro')
            ? 'erro_leitura'
            : 'falha_operacional';

      return {
        id: `failure-${transaction.id}`,
        type,
        dateTime: transaction.dateTime,
        summary: transaction.status || 'Falha identificada na tentativa de uso.',
        eligibleForRefund: type !== 'saldo_insuficiente',
        source: 'dataset',
      } satisfies CardFailure;
    });
}

function deriveStatus(
  transactions: TransactionRecord[],
  alerts: FraudAlert[],
  estimatedBalance: number,
): Pick<CardSummary, 'status' | 'statusReason'> {
  const latestStatus = transactions[0]?.status.toLowerCase() ?? '';
  const highRiskTypes = new Set(
    alerts.filter((alert) => alert.riskScore === 'alto').map((alert) => alert.fraudType),
  );

  if (
    latestStatus.includes('bloque') ||
    highRiskTypes.has('clonagem de cartao') ||
    highRiskTypes.has('deslocamento impossivel') ||
    alerts.filter((alert) => alert.riskScore === 'alto').length >= 2
  ) {
    return {
      status: 'bloqueado',
      statusReason: 'Cartao com bloqueio preventivo ou risco elevado, recomendando validacao humana.',
    };
  }

  if (alerts.length > 0 || estimatedBalance < 5) {
    return {
      status: 'atencao',
      statusReason:
        estimatedBalance < 5
          ? 'Cartao com saldo estimado baixo para novas validacoes.'
          : 'Cartao com alertas recentes ou comportamento fora do padrao.',
    };
  }

  return {
    status: 'ativo',
    statusReason: 'Cartao operacional sem bloqueios recentes identificados na base atual.',
  };
}

function synthesizeFailures(
  transactions: TransactionRecord[],
  alerts: FraudAlert[],
  estimatedBalance: number,
  status: CardOperationalStatus,
): CardFailure[] {
  const failures = explicitFailures(transactions);

  if (failures.length > 0) {
    return failures;
  }

  const referenceDate = transactions[0]?.dateTime ?? new Date().toISOString();

  if (status === 'bloqueado') {
    return [
      {
        id: 'mock-block',
        type: 'bloqueio',
        dateTime: referenceDate,
        summary: 'Identificamos bloqueio preventivo por atividade incomum no cartao.',
        eligibleForRefund: true,
        source: 'mock',
      },
    ];
  }

  if (estimatedBalance < (transactions[0]?.amount ?? 4.7)) {
    return [
      {
        id: 'mock-balance',
        type: 'saldo_insuficiente',
        dateTime: referenceDate,
        summary: 'A ultima tentativa pode ter falhado por saldo estimado insuficiente.',
        eligibleForRefund: false,
        source: 'mock',
      },
    ];
  }

  if (alerts.length === 0 && transactions.length > 0) {
    return [
      {
        id: 'mock-read',
        type: 'erro_leitura',
        dateTime: referenceDate,
        summary: 'Nao ha bloqueio nem saldo baixo aparente; a causa mais provavel e erro isolado de leitura.',
        eligibleForRefund: true,
        source: 'mock',
      },
    ];
  }

  return [];
}

export function lookupCard(dataset: UploadedDataset, input: string): CardLookupResult | null {
  const normalizedInput = normalizeCardInput(input);
  const resolvedCardId = resolveCardId(dataset, normalizedInput);

  if (!resolvedCardId) {
    return null;
  }

  const comparableInput = comparableCardId(resolvedCardId);

  const transactions = dataset.transactions
    .filter((transaction) => comparableCardId(transaction.cardId) === comparableInput)
    .sort((left, right) => right.timestamp - left.timestamp);

  if (!transactions.length) {
    return null;
  }

  const alerts = dataset.alerts
    .filter((alert) => comparableCardId(alert.cardId) === comparableInput)
    .sort((left, right) => right.timestamp - left.timestamp);

  const estimatedBalance = getEstimatedBalance(resolvedCardId, alerts, transactions);
  const riskScore = getRiskScore(alerts, transactions);
  const statusData = deriveStatus(transactions, alerts, estimatedBalance);
  const failures = synthesizeFailures(transactions, alerts, estimatedBalance, statusData.status);

  return {
    cardId: resolvedCardId,
    summary: {
      rawCardId: resolvedCardId,
      maskedCardId: maskCardId(resolvedCardId),
      status: statusData.status,
      statusReason: statusData.statusReason,
      estimatedBalance,
      riskScore,
      alertCount: alerts.length,
      failureCount: failures.length,
      lastValidation: transactions[0]?.dateTime ?? null,
      lastLocation: transactions[0]?.locationLabel ?? 'Sem local recente',
    },
    transactions,
    alerts,
    failures,
  };
}
