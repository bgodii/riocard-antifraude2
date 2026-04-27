import type { AlertSource, AnalysisStats, FraudAlert, FraudType, RiskScore, TransactionRecord } from '@/types/fraud';

const MINUTE = 60 * 1000;
export const REVENDA_MIN_TRANSACTIONS = 5;
export const REVENDA_MAX_WINDOW_MINUTES = 10;

function getRiskScore(points: number): RiskScore {
  if (points >= 85) {
    return 'alto';
  }

  if (points >= 55) {
    return 'medio';
  }

  return 'baixo';
}

function normalizeCategory(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');
}

function mapNativeFraudType(category: string): FraudType {
  const normalized = normalizeCategory(category);

  if (normalized.includes('multi_validacao') || normalized.includes('sequencial')) {
    return 'multi validacao sequencial';
  }

  if (normalized.includes('gratuidade')) {
    return 'uso gratuidade indevida';
  }

  if (normalized.includes('clonagem')) {
    return 'clonagem de cartao';
  }

  if (normalized.includes('revenda')) {
    return 'revenda';
  }

  if (normalized.includes('deslocamento')) {
    return 'deslocamento impossivel';
  }

  if (normalized.includes('compartilhamento')) {
    return 'compartilhamento';
  }

  return 'uso abusivo';
}

function nativeReason(transaction: TransactionRecord, fraudType: FraudType) {
  const category = transaction.suspiciousCategory || fraudType;

  if (transaction.estimatedFinancialLoss) {
    return `Sinalizacao nativa da planilha para ${category} com perda estimada de R$ ${transaction.estimatedFinancialLoss.toFixed(2)}.`;
  }

  return `Sinalizacao nativa da planilha para ${category} com score de risco do modelo em ${transaction.modelRiskScore ?? transaction.baseRiskScore ?? 0}.`;
}

function mergeSource(current: AlertSource, next: AlertSource): AlertSource {
  return current === next ? current : 'hibrido';
}

function addAlert(
  alertMap: Map<string, FraudAlert>,
  transaction: TransactionRecord,
  fraudType: FraudType,
  riskPoints: number,
  reason: string,
  source: AlertSource,
  sourceCategory = '',
  relatedTransactionIds: string[] = [transaction.id],
) {
  const alertId = `${transaction.externalTransactionId || transaction.id}-${fraudType}`;
  const existing = alertMap.get(alertId);

  if (existing) {
    const mergedReason = existing.reason.includes(reason) ? existing.reason : `${existing.reason} ${reason}`;
    const mergedRisk = Math.max(existing.riskPoints, riskPoints);

    alertMap.set(alertId, {
      ...existing,
      riskPoints: mergedRisk,
      riskScore: getRiskScore(mergedRisk),
      reason: mergedReason,
      source: mergeSource(existing.source, source),
      sourceCategory: existing.sourceCategory || sourceCategory,
      relatedTransactionIds: [...new Set([...existing.relatedTransactionIds, ...relatedTransactionIds])],
      estimatedFinancialLoss: Math.max(existing.estimatedFinancialLoss ?? 0, transaction.estimatedFinancialLoss ?? 0) || null,
    });
    return;
  }

  alertMap.set(alertId, {
    id: alertId,
    transactionId: transaction.id,
    relatedTransactionIds,
    externalTransactionId: transaction.externalTransactionId,
    cardId: transaction.cardId,
    dateTime: transaction.dateTime,
    timestamp: transaction.timestamp,
    locationLabel: transaction.locationLabel,
    busLine: transaction.busLine,
    metroStation: transaction.metroStation,
    transportType: transaction.transportType,
    fraudType,
    riskScore: getRiskScore(riskPoints),
    riskPoints,
    reason,
    source,
    sourceCategory,
    estimatedFinancialLoss: transaction.estimatedFinancialLoss,
  });
}

function haversineKm(first: TransactionRecord, second: TransactionRecord) {
  if (first.latitude === null || first.longitude === null || second.latitude === null || second.longitude === null) {
    return null;
  }

  const earthRadius = 6371;
  const dLat = ((second.latitude - first.latitude) * Math.PI) / 180;
  const dLon = ((second.longitude - first.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((first.latitude * Math.PI) / 180) *
      Math.cos((second.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function groupByCard(transactions: TransactionRecord[]) {
  const groups = new Map<string, TransactionRecord[]>();

  for (const transaction of transactions) {
    const collection = groups.get(transaction.cardId) ?? [];
    collection.push(transaction);
    groups.set(transaction.cardId, collection);
  }

  return groups;
}

function getDominantLocationShare(transactions: TransactionRecord[]) {
  const counts = new Map<string, number>();

  for (const transaction of transactions) {
    const key = transaction.locationLabel || 'local_desconhecido';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const highestCount = Math.max(...counts.values());
  return highestCount / transactions.length;
}

export function isSuspiciousResaleWindow(transactions: TransactionRecord[]) {
  if (transactions.length < REVENDA_MIN_TRANSACTIONS) {
    return false;
  }

  const sortedTransactions = [...transactions].sort((left, right) => left.timestamp - right.timestamp);
  const windowSpanMinutes = (sortedTransactions.at(-1)!.timestamp - sortedTransactions[0].timestamp) / MINUTE;

  if (windowSpanMinutes > REVENDA_MAX_WINDOW_MINUTES) {
    return false;
  }

  return getDominantLocationShare(sortedTransactions) >= 0.8;
}

function buildStats(transactions: TransactionRecord[]): AnalysisStats {
  const cardDayUsage = new Map<string, number>();

  for (const transaction of transactions) {
    const day = transaction.dateTime.slice(0, 10);
    const key = `${transaction.cardId}-${day}`;
    cardDayUsage.set(key, (cardDayUsage.get(key) ?? 0) + 1);
  }

  const usageValues = [...cardDayUsage.values()];
  const totalUsage = usageValues.reduce((sum, current) => sum + current, 0);

  return {
    totalTransactions: transactions.length,
    averageDailyUsage: usageValues.length ? totalUsage / usageValues.length : 0,
    uniqueCards: new Set(transactions.map((transaction) => transaction.cardId)).size,
  };
}

export function analyzeTransactions(transactions: TransactionRecord[]) {
  const alertMap = new Map<string, FraudAlert>();
  const byCard = groupByCard(transactions);
  const stats = buildStats(transactions);

  for (const transaction of transactions) {
    const shouldUseNativeSignal =
      transaction.suspiciousFlag || Boolean(transaction.suspiciousCategory) || (transaction.modelRiskScore ?? 0) >= 75;

    if (shouldUseNativeSignal) {
      const fraudType = mapNativeFraudType(transaction.suspiciousCategory || 'uso_abusivo');
      const riskPoints = Math.max(
        transaction.modelRiskScore ?? 0,
        transaction.baseRiskScore ?? 0,
        transaction.suspiciousFlag ? 72 : 0,
      );

      addAlert(
        alertMap,
        transaction,
        fraudType,
        riskPoints || 72,
        nativeReason(transaction, fraudType),
        'planilha',
        transaction.suspiciousCategory,
        [transaction.id],
      );
    }
  }

  for (const [cardId, cardTransactions] of byCard.entries()) {
    const dailyUsage = new Map<string, TransactionRecord[]>();

    for (const transaction of cardTransactions) {
      const day = transaction.dateTime.slice(0, 10);
      const list = dailyUsage.get(day) ?? [];
      list.push(transaction);
      dailyUsage.set(day, list);
    }

    for (const [day, items] of dailyUsage.entries()) {
      const dayCount = items.length;
      if (dayCount >= Math.max(8, Math.ceil(stats.averageDailyUsage * 2.5))) {
        for (const item of items) {
          addAlert(
            alertMap,
            item,
            'uso abusivo',
            Math.min(95, 48 + dayCount * 4),
            `O cartao ${cardId} registrou ${dayCount} validacoes em ${day}, acima da media diaria observada.`,
            'modelo',
            '',
            [item.id],
          );
        }
      }
    }

    for (let index = 0; index < cardTransactions.length; index += 1) {
      const current = cardTransactions[index];
      const next = cardTransactions[index + 1];

      if (!next) {
        continue;
      }

      const diffMinutes = (next.timestamp - current.timestamp) / MINUTE;
      const locationChanged = current.locationLabel && next.locationLabel && current.locationLabel !== next.locationLabel;

      if (diffMinutes <= 12 && locationChanged) {
        addAlert(
          alertMap,
          next,
          'compartilhamento',
          diffMinutes <= 6 ? 90 : 74,
          `Uso do mesmo cartao em ${current.locationLabel} e ${next.locationLabel} com intervalo de ${Math.max(
            1,
            Math.round(diffMinutes),
          )} minuto(s).`,
          'modelo',
          '',
          [current.id, next.id],
        );
      }

      const distanceKm = haversineKm(current, next);
      if (distanceKm !== null && diffMinutes > 0) {
        const speed = distanceKm / (diffMinutes / 60);
        if (distanceKm >= 12 && speed >= 65) {
          addAlert(
            alertMap,
            next,
            'deslocamento impossivel',
            speed >= 95 ? 96 : 84,
            `O cartao percorreu aproximadamente ${distanceKm.toFixed(1)} km em ${Math.round(
              diffMinutes,
            )} minuto(s), exigindo velocidade incompativel.`,
            'modelo',
            '',
            [current.id, next.id],
          );
        }
      }

      const windowStart = Math.max(0, index - 5);
      const windowItems = cardTransactions.slice(windowStart, index + 1);
      const windowSpanMinutes = (windowItems.at(-1)!.timestamp - windowItems[0].timestamp) / MINUTE;

      if (isSuspiciousResaleWindow(windowItems)) {
        addAlert(
          alertMap,
          next,
          'revenda',
          92,
          `Foram detectadas ${windowItems.length} validacoes concentradas em ${windowSpanMinutes.toFixed(
            1,
          )} minutos no mesmo ponto de uso, padrao compativel com venda informal.`,
          'modelo',
          '',
          windowItems.map((item) => item.id).concat(next.id),
        );
      } else if (windowItems.length >= 4 && windowSpanMinutes <= 5 && locationChanged) {
        addAlert(
          alertMap,
          next,
          'compartilhamento',
          64,
          'Sequencia intensa de validacoes em curto intervalo sugere compartilhamento operacional do cartao.',
          'modelo',
          '',
          windowItems.map((item) => item.id).concat(next.id),
        );
      }
    }
  }

  return {
    alerts: [...alertMap.values()].sort((left, right) => right.timestamp - left.timestamp),
    stats,
  };
}
