import type {
  AnalysisStats,
  AnalyticsBundle,
  FilterOptions,
  FilterState,
  FraudAlert,
  FraudType,
  SortState,
  TransactionRecord,
} from '@/types/fraud';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(value));
}

function normalize(value: string) {
  return value.toLowerCase();
}

function matchesDateRange(timestamp: number, filters: FilterState) {
  if (filters.startDate) {
    const start = new Date(`${filters.startDate}T00:00:00`).getTime();
    if (timestamp < start) {
      return false;
    }
  }

  if (filters.endDate) {
    const end = new Date(`${filters.endDate}T23:59:59`).getTime();
    if (timestamp > end) {
      return false;
    }
  }

  return true;
}

function compareRisk(left: string, right: string) {
  const order = { baixo: 1, medio: 2, alto: 3 };
  return order[left as keyof typeof order] - order[right as keyof typeof order];
}

function sortAlerts(alerts: FraudAlert[], sort: SortState) {
  return [...alerts].sort((left, right) => {
    const modifier = sort.direction === 'asc' ? 1 : -1;

    switch (sort.column) {
      case 'cardId':
        return left.cardId.localeCompare(right.cardId) * modifier;
      case 'locationLabel':
        return left.locationLabel.localeCompare(right.locationLabel) * modifier;
      case 'fraudType':
        return left.fraudType.localeCompare(right.fraudType) * modifier;
      case 'riskScore':
        return compareRisk(left.riskScore, right.riskScore) * modifier;
      case 'dateTime':
      default:
        return (left.timestamp - right.timestamp) * modifier;
    }
  });
}

function topEntry(entries: Map<string, number>, emptyLabel = 'Sem dados') {
  const ordered = [...entries.entries()].sort((left, right) => right[1] - left[1]);
  return ordered[0]?.[0] ?? emptyLabel;
}

export function filterTransactions(transactions: TransactionRecord[], filters: FilterState) {
  return transactions.filter((transaction) => {
    const station = transaction.metroStation || transaction.equipmentLocation;
    const line = transaction.busLine;

    if (filters.cardId && !normalize(transaction.cardId).includes(normalize(filters.cardId))) {
      return false;
    }

    if (filters.station !== 'all' && station !== filters.station) {
      return false;
    }

    if (filters.line !== 'all' && line !== filters.line) {
      return false;
    }

    return matchesDateRange(transaction.timestamp, filters);
  });
}

export function filterAlerts(alerts: FraudAlert[], filters: FilterState, sort: SortState) {
  const filtered = alerts.filter((alert) => {
    if (filters.cardId && !normalize(alert.cardId).includes(normalize(filters.cardId))) {
      return false;
    }

    if (filters.fraudType !== 'all' && alert.fraudType !== filters.fraudType) {
      return false;
    }

    if (filters.station !== 'all' && alert.metroStation !== filters.station && alert.locationLabel !== filters.station) {
      return false;
    }

    if (filters.line !== 'all' && alert.busLine !== filters.line) {
      return false;
    }

    return matchesDateRange(alert.timestamp, filters);
  });

  return sortAlerts(filtered, sort);
}

export function buildFilterOptions(transactions: TransactionRecord[], alerts: FraudAlert[]): FilterOptions {
  const cardIds = new Set<string>();
  const stations = new Set<string>();
  const lines = new Set<string>();
  const fraudTypes = new Set<FraudType>();

  for (const transaction of transactions) {
    cardIds.add(transaction.cardId);
    if (transaction.metroStation) {
      stations.add(transaction.metroStation);
    }
    if (transaction.busLine) {
      lines.add(transaction.busLine);
    }
    if (!transaction.metroStation && transaction.equipmentLocation) {
      stations.add(transaction.equipmentLocation);
    }
  }

  for (const alert of alerts) {
    fraudTypes.add(alert.fraudType);
  }

  return {
    cardIds: [...cardIds].sort((left, right) => left.localeCompare(right)),
    stations: [...stations].sort((left, right) => left.localeCompare(right)),
    lines: [...lines].sort((left, right) => left.localeCompare(right)),
    fraudTypes: [...fraudTypes].sort((left, right) => left.localeCompare(right)),
  };
}

export function buildAnalytics(alerts: FraudAlert[], stats?: AnalysisStats): AnalyticsBundle {
  const byType = new Map<string, number>();
  const byDay = new Map<string, number>();
  const byLocation = new Map<string, number>();
  const byCard = new Map<string, number>();
  const byStation = new Map<string, number>();
  const byLine = new Map<string, number>();

  for (const alert of alerts) {
    byType.set(alert.fraudType, (byType.get(alert.fraudType) ?? 0) + 1);
    byDay.set(alert.dateTime.slice(0, 10), (byDay.get(alert.dateTime.slice(0, 10)) ?? 0) + 1);
    byLocation.set(alert.locationLabel, (byLocation.get(alert.locationLabel) ?? 0) + 1);
    byCard.set(alert.cardId, (byCard.get(alert.cardId) ?? 0) + 1);

    if (alert.metroStation) {
      byStation.set(alert.metroStation, (byStation.get(alert.metroStation) ?? 0) + 1);
    }

    if (alert.busLine) {
      byLine.set(alert.busLine, (byLine.get(alert.busLine) ?? 0) + 1);
    }
  }

  const highRiskAlerts = alerts.filter((alert) => alert.riskScore === 'alto').length;
  const fraudByType = [...byType.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([name, total]) => ({ name, total }));

  const fraudTimeline = [...byDay.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([day, total]) => ({ day: formatDate(day), total }));

  const fraudByLocation = [...byLocation.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([name, total]) => ({ name, total }));

  const topCard = topEntry(byCard);
  const topStation = topEntry(byStation);
  const topLine = topEntry(byLine);
  const topFraudType = topEntry(byType);

  return {
    totalAlerts: alerts.length,
    highRiskAlerts,
    uniqueCards: new Set(alerts.map((alert) => alert.cardId)).size,
    suspiciousLocations: byLocation.size,
    stationCoverage: byStation.size,
    lineCoverage: byLine.size,
    topFraudType,
    topCard,
    topStation,
    topLine,
    fraudByType,
    fraudTimeline,
    fraudByLocation,
    keyAnswers: [
      {
        label: 'Fraudes na estacao mais critica',
        value: `${topStation}: ${byStation.get(topStation) ?? 0}`,
      },
      {
        label: 'Suspeitas do cartao com mais ocorrencias',
        value: `${topCard}: ${byCard.get(topCard) ?? 0}`,
      },
      {
        label: 'Tipo mais comum',
        value: `${topFraudType} (${byType.get(topFraudType) ?? 0})`,
      },
      {
        label: 'Media diaria da base carregada',
        value: `${stats?.averageDailyUsage.toFixed(1) ?? '0.0'} usos/cartao-dia`,
      },
    ],
  };
}
