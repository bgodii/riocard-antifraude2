import type { FraudAlert, FraudType, TransactionRecord, UploadedDataset } from '@/types/fraud';
import type {
  CardOperationalStatus,
  CaseWorkflowStatus,
  NotificationChannel,
  RiskActionCase,
  RiskActionLog,
  RiskActionOverride,
  RiskActionType,
  RiskCriticality,
} from '@/types/riskActions';

function prettifyFraudType(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function clampScore01(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }

  const normalized = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalized));
}

export function classifyRiskLevel(score01: number): RiskCriticality {
  if (score01 >= 0.9) {
    return 'critico';
  }

  if (score01 >= 0.7) {
    return 'alto';
  }

  if (score01 >= 0.4) {
    return 'medio';
  }

  return 'baixo';
}

function createLogId(cardId: string, type: RiskActionType, timestamp: string) {
  return `${cardId}-${type}-${timestamp}`;
}

function createLog(
  cardId: string,
  type: RiskActionType,
  description: string,
  timestamp: string,
  automated: boolean,
  actor: string,
  channel?: NotificationChannel,
): RiskActionLog {
  return {
    id: createLogId(cardId, type, timestamp),
    type,
    description,
    timestamp,
    automated,
    actor,
    channel,
  };
}

function getScore01(transactions: TransactionRecord[], alerts: FraudAlert[]) {
  const candidates = [
    ...transactions.flatMap((transaction) => [transaction.modelRiskScore, transaction.baseRiskScore]),
    ...alerts.map((alert) => alert.riskPoints),
  ]
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .map((value) => clampScore01(value));

  return candidates.length ? Math.max(...candidates) : 0;
}

function getRecommendedAction(level: RiskCriticality) {
  switch (level) {
    case 'critico':
      return 'Bloqueio automatico, alerta ao usuario e abertura imediata de caso para analise humana.';
    case 'alto':
      return 'Encaminhar para analise humana e permitir alerta manual ao usuario.';
    case 'medio':
      return 'Manter em monitoramento com destaque no dashboard, sem bloqueio automatico.';
    case 'baixo':
    default:
      return 'Apenas acompanhar o comportamento, sem acao operacional imediata.';
  }
}

function getDefaultCardStatus(level: RiskCriticality): CardOperationalStatus {
  return level === 'critico' ? 'bloqueado' : 'ativo';
}

function getDefaultCaseStatus(level: RiskCriticality): CaseWorkflowStatus {
  if (level === 'critico') {
    return 'em_analise';
  }

  return 'monitoramento';
}

function buildAutomaticTimeline(cardId: string, level: RiskCriticality, referenceTimestamp: string) {
  const baseTime = new Date(referenceTimestamp).getTime() || Date.now();
  const makeTime = (offsetMinutes: number) => new Date(baseTime + offsetMinutes * 60 * 1000).toISOString();

  if (level === 'critico') {
    return [
      createLog(
        cardId,
        'bloqueio',
        'Bloqueio automatico executado por score critico igual ou superior a 0,90.',
        makeTime(1),
        true,
        'Decision Engine',
      ),
      createLog(
        cardId,
        'alerta',
        'WhatsApp simulado enviado ao usuario informando atividade incomum e bloqueio preventivo.',
        makeTime(2),
        true,
        'Notification Service',
        'whatsapp',
      ),
      createLog(
        cardId,
        'analise_humana',
        'Caso aberto automaticamente para revisao humana prioritaria.',
        makeTime(3),
        true,
        'Case Management',
      ),
    ];
  }

  if (level === 'medio') {
    return [
      createLog(
        cardId,
        'monitoramento',
        'Caso mantido em monitoramento reforcado no dashboard por risco medio.',
        referenceTimestamp,
        true,
        'Decision Engine',
      ),
    ];
  }

  return [];
}

function summarizeExecutedActions(logs: RiskActionLog[]) {
  if (!logs.length) {
    return 'Nenhuma acao executada';
  }

  const labels = Array.from(
    new Set(
      logs.map((log) => {
        switch (log.type) {
          case 'bloqueio':
            return 'Cartao bloqueado';
          case 'alerta':
            return log.channel === 'ligacao' ? 'Ligacao simulada' : 'Alerta enviado';
          case 'analise_humana':
            return 'Em analise humana';
          case 'monitoramento':
            return 'Monitoramento';
          case 'resolvido':
            return 'Caso resolvido';
          case 'reativacao':
            return 'Cartao reativado';
          default:
            return 'Acao registrada';
        }
      }),
    ),
  );

  return labels.join(' | ');
}

function getEstimatedLoss(transactions: TransactionRecord[], alerts: FraudAlert[]) {
  const transactionLoss = transactions.reduce((sum, transaction) => sum + (transaction.estimatedFinancialLoss ?? 0), 0);
  const alertLoss = alerts.reduce((sum, alert) => sum + (alert.estimatedFinancialLoss ?? 0), 0);
  return Math.max(transactionLoss, alertLoss);
}

function uniqueFraudTypes(alerts: FraudAlert[], transactions: TransactionRecord[]) {
  const nativeTypes = transactions
    .map((transaction) => transaction.suspiciousCategory)
    .filter(Boolean)
    .map((value) => value.toLowerCase().replaceAll('_', ' '));

  const fraudTypes = new Set<FraudType>();

  for (const alert of alerts) {
    fraudTypes.add(alert.fraudType);
  }

  for (const type of nativeTypes) {
    if (type.includes('revenda')) {
      fraudTypes.add('revenda');
    } else if (type.includes('compartilhamento')) {
      fraudTypes.add('compartilhamento');
    } else if (type.includes('deslocamento')) {
      fraudTypes.add('deslocamento impossivel');
    } else if (type.includes('gratuidade')) {
      fraudTypes.add('uso gratuidade indevida');
    } else if (type.includes('clonagem')) {
      fraudTypes.add('clonagem de cartao');
    } else if (type.includes('multi') || type.includes('sequencial')) {
      fraudTypes.add('multi validacao sequencial');
    } else if (type) {
      fraudTypes.add('uso abusivo');
    }
  }

  return [...fraudTypes];
}

export function buildRiskActionCases(dataset: UploadedDataset) {
  const transactionsByCard = new Map<string, TransactionRecord[]>();
  const alertsByCard = new Map<string, FraudAlert[]>();

  for (const transaction of dataset.transactions) {
    const list = transactionsByCard.get(transaction.cardId) ?? [];
    list.push(transaction);
    transactionsByCard.set(transaction.cardId, list);
  }

  for (const alert of dataset.alerts) {
    const list = alertsByCard.get(alert.cardId) ?? [];
    list.push(alert);
    alertsByCard.set(alert.cardId, list);
  }

  const candidateCards = [...new Set([...transactionsByCard.keys(), ...alertsByCard.keys()])];

  return candidateCards
    .map((cardId) => {
      const transactions = (transactionsByCard.get(cardId) ?? []).sort((left, right) => right.timestamp - left.timestamp);
      const alerts = (alertsByCard.get(cardId) ?? []).sort((left, right) => right.timestamp - left.timestamp);
      const score01 = getScore01(transactions, alerts);
      const hasSignals =
        alerts.length > 0 ||
        transactions.some((transaction) => Boolean(transaction.suspiciousFlag || transaction.suspiciousCategory)) ||
        score01 >= 0.4;

      if (!hasSignals || !transactions.length) {
        return null;
      }

      const scorePercent = Math.round(score01 * 100);
      const riskLevel = classifyRiskLevel(score01);
      const latestTransaction = transactions[0];
      const fraudTypes = uniqueFraudTypes(alerts, transactions);
      const fraudTypeLabels = fraudTypes.length ? fraudTypes.map(prettifyFraudType) : ['Sem classificacao'];
      const automaticTimeline = buildAutomaticTimeline(cardId, riskLevel, latestTransaction.dateTime);
      const latestReason =
        alerts[0]?.reason ??
        `Cartao com score ${score01.toFixed(2)} e ${transactions.length} transacoes observadas na base carregada.`;

      return {
        id: `risk-case-${cardId}`,
        cardId,
        score01: Number(score01.toFixed(2)),
        scorePercent,
        riskLevel,
        fraudTypes,
        fraudTypeLabels,
        lastTransactionDateTime: latestTransaction.dateTime,
        lastTransactionLocation: latestTransaction.locationLabel,
        cardStatus: getDefaultCardStatus(riskLevel),
        caseStatus: getDefaultCaseStatus(riskLevel),
        recommendedAction: getRecommendedAction(riskLevel),
        executedActionSummary: summarizeExecutedActions(automaticTimeline),
        executedActionTypes: [...new Set(automaticTimeline.map((log) => log.type))],
        decisionJustification: [
          `Score do modelo consolidado em ${score01.toFixed(2)} (${scorePercent} pontos de 100).`,
          `${alerts.length} alerta${alerts.length === 1 ? '' : 's'} relacionado${alerts.length === 1 ? '' : 's'} ao cartao na base atual.`,
          `Ultima transacao registrada em ${latestTransaction.locationLabel}.`,
          `Fraudes associadas: ${fraudTypeLabels.join(', ')}.`,
        ],
        latestReason,
        transactionsCount: transactions.length,
        alertsCount: alerts.length,
        estimatedFinancialLoss: getEstimatedLoss(transactions, alerts),
        actionTimeline: automaticTimeline.sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
      } satisfies RiskActionCase;
    })
    .filter((item): item is RiskActionCase => item !== null)
    .sort((left, right) => {
      if (right.score01 !== left.score01) {
        return right.score01 - left.score01;
      }

      return new Date(right.lastTransactionDateTime).getTime() - new Date(left.lastTransactionDateTime).getTime();
    });
}

export function applyRiskActionOverride(baseCase: RiskActionCase, override?: RiskActionOverride): RiskActionCase {
  if (!override) {
    return baseCase;
  }

  const actionTimeline = [...baseCase.actionTimeline, ...override.extraLogs].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  );

  return {
    ...baseCase,
    cardStatus: override.cardStatus ?? baseCase.cardStatus,
    caseStatus: override.caseStatus ?? baseCase.caseStatus,
    actionTimeline,
    executedActionTypes: [...new Set(actionTimeline.map((log) => log.type))],
    executedActionSummary: summarizeExecutedActions(actionTimeline),
  };
}

export function buildNotificationMessage(cardId: string, blocked: boolean) {
  if (blocked) {
    return `Detectamos atividade incomum no seu cartao Riocard ${cardId}. Seu cartao foi bloqueado por seguranca. Procure atendimento.`;
  }

  return `Detectamos atividade incomum no seu cartao Riocard ${cardId}. Nossa equipe iniciou uma verificacao preventiva.`;
}

export function buildManualRiskLog(
  cardId: string,
  type: RiskActionType,
  automated = false,
  channel?: NotificationChannel,
): RiskActionLog {
  const timestamp = new Date().toISOString();

  if (type === 'alerta') {
    const chosenChannel = channel ?? 'whatsapp';
    const message = chosenChannel === 'ligacao'
      ? 'Ligacao simulada registrada para contato com o usuario.'
      : 'WhatsApp simulado enviado ao usuario com orientacao de seguranca.';

    return createLog(cardId, 'alerta', message, timestamp, automated, automated ? 'Notification Service' : 'Analista', chosenChannel);
  }

  if (type === 'bloqueio') {
    return createLog(cardId, 'bloqueio', 'Bloqueio manual executado pelo analista.', timestamp, automated, 'Analista');
  }

  if (type === 'reativacao') {
    return createLog(cardId, 'reativacao', 'Cartao reativado manualmente apos revisao.', timestamp, automated, 'Analista');
  }

  if (type === 'analise_humana') {
    return createLog(cardId, 'analise_humana', 'Caso encaminhado manualmente para analise humana.', timestamp, automated, 'Analista');
  }

  if (type === 'resolvido') {
    return createLog(cardId, 'resolvido', 'Caso marcado como resolvido pelo analista.', timestamp, automated, 'Analista');
  }

  return createLog(cardId, 'monitoramento', 'Caso mantido em monitoramento manual.', timestamp, automated, 'Analista');
}
