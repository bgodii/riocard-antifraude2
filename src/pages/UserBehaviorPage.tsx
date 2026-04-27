import { useMemo, useState } from 'react';
import { AlertTriangle, CreditCard, MapPin, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeRisco } from '@/components/BadgeRisco';
import { CardResumo } from '@/components/CardResumo';
import { PageHeader } from '@/components/PageHeader';
import { useMonitoringData } from '@/context/MonitoringDataContext';
import type { FraudAlert, FraudType, TransactionRecord } from '@/types/fraud';
import { formatCurrency, formatDateTime } from '@/utils/format';

type ExecutiveInsight = {
  title: string;
  description: string;
};

type CardInsight = {
  cardId: string;
  totalTransactions: number;
  fraudCount: number;
  primaryFraud: string;
  riskLevel: 'baixo' | 'medio' | 'alto';
  riskPoints: number;
  normalPattern: string;
  changedBehavior: string;
  explanation: string;
  estimatedLoss: number;
};

type StationInsight = {
  station: string;
  fraudCount: number;
  cardCount: number;
  topFraud: string;
  estimatedLoss: number;
};

type ProfileInsight = {
  profile: string;
  totalTransactions: number;
  suspiciousTransactions: number;
  fraudRate: number;
  mainDeviation: string;
};

type AlertExplanation = {
  id: string;
  cardId: string;
  fraudType: string;
  dateTime: string;
  location: string;
  riskLevel: 'baixo' | 'medio' | 'alto';
  riskPoints: number;
  whySuspicious: string;
  violatedRule: string;
  impact: string;
};

const chartPalette = ['#0454a3', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];
const periodConfig = [
  { label: 'manha', start: 5, end: 11 },
  { label: 'tarde', start: 12, end: 17 },
  { label: 'noite', start: 18, end: 23 },
] as const;

function prettifyFraudType(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toDayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getPeriodLabel(timestamp: number) {
  const hour = new Date(timestamp).getHours();
  return periodConfig.find((period) => hour >= period.start && hour <= period.end)?.label ?? 'noite';
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, current) => sum + current, 0) / values.length;
}

function sumEstimatedLoss(alerts: FraudAlert[]) {
  const lossByTransaction = new Map<string, number>();

  for (const alert of alerts) {
    const current = lossByTransaction.get(alert.transactionId) ?? 0;
    lossByTransaction.set(alert.transactionId, Math.max(current, alert.estimatedFinancialLoss ?? 0));
  }

  return [...lossByTransaction.values()].reduce((sum, current) => sum + current, 0);
}

function topEntry(entries: Map<string, number>, fallback = 'Sem dados') {
  return [...entries.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? fallback;
}

function buildRuleViolation(fraudType: FraudType) {
  switch (fraudType) {
    case 'compartilhamento':
      return 'Uso do mesmo cartao em locais diferentes em intervalo curto.';
    case 'revenda':
      return 'Sequencia de validacoes em ritmo incompatível com uso individual.';
    case 'uso abusivo':
      return 'Volume diario acima do comportamento humano esperado.';
    case 'deslocamento impossivel':
      return 'Distancia entre validacoes incompatível com o tempo decorrido.';
    case 'uso gratuidade indevida':
      return 'Perfil de gratuidade com frequencia acima do padrao esperado.';
    case 'multi validacao sequencial':
      return 'Repeticao sequencial de validacoes sem justificativa operacional.';
    case 'clonagem de cartao':
      return 'Padrao compativel com duplicidade ou uso indevido de credencial.';
    default:
      return 'Comportamento fora do padrao esperado para o cartao.';
  }
}

function buildImpactText(alert: FraudAlert) {
  if (alert.estimatedFinancialLoss) {
    return `Perda financeira estimada de ${formatCurrency(alert.estimatedFinancialLoss)}.`;
  }

  if (alert.relatedTransactionIds.length > 1) {
    return `${alert.relatedTransactionIds.length} transacoes relacionadas exigem verificacao operacional.`;
  }

  return 'Impacto potencial na receita e no controle de uso do sistema.';
}

function buildNormalPattern(transactions: TransactionRecord[]) {
  const dayCounts = new Map<string, number>();
  const stationCounts = new Map<string, number>();
  const periodCounts = new Map<string, number>();

  for (const transaction of transactions) {
    dayCounts.set(toDayKey(transaction.timestamp), (dayCounts.get(toDayKey(transaction.timestamp)) ?? 0) + 1);
    stationCounts.set(transaction.locationLabel, (stationCounts.get(transaction.locationLabel) ?? 0) + 1);
    periodCounts.set(getPeriodLabel(transaction.timestamp), (periodCounts.get(getPeriodLabel(transaction.timestamp)) ?? 0) + 1);
  }

  const avgDaily = average([...dayCounts.values()]);
  const topStation = topEntry(stationCounts);
  const topPeriod = topEntry(periodCounts);

  return `Em media, esse cartao realiza ${avgDaily.toFixed(1)} uso(s) por dia ativo, com concentracao em ${topStation} e maior recorrencia no periodo da ${topPeriod}.`;
}

function buildBehaviorChange(transactions: TransactionRecord[], alerts: FraudAlert[]) {
  const dayCounts = new Map<string, number>();

  for (const transaction of transactions) {
    dayCounts.set(toDayKey(transaction.timestamp), (dayCounts.get(toDayKey(transaction.timestamp)) ?? 0) + 1);
  }

  const orderedDays = [...dayCounts.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  const latestDay = orderedDays.at(-1);
  const historicalAverage = average(orderedDays.slice(0, -1).map(([, total]) => total));
  const latestTotal = latestDay?.[1] ?? 0;
  const topAlert = [...alerts].sort((left, right) => right.riskPoints - left.riskPoints)[0];

  if (historicalAverage > 0 && latestTotal >= historicalAverage * 1.5) {
    return `No ultimo dia da base, o cartao saiu de uma media de ${historicalAverage.toFixed(1)} uso(s) para ${latestTotal} uso(s), indicando aceleracao relevante do comportamento.`;
  }

  if (topAlert) {
    return topAlert.reason;
  }

  return 'O comportamento recente divergiu do padrao esperado e exige acompanhamento.';
}

function buildCardInsights(alerts: FraudAlert[], transactions: TransactionRecord[]) {
  const transactionMap = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const alertsByCard = new Map<string, FraudAlert[]>();
  const transactionsByCard = new Map<string, TransactionRecord[]>();

  for (const transaction of transactions) {
    const collection = transactionsByCard.get(transaction.cardId) ?? [];
    collection.push(transaction);
    transactionsByCard.set(transaction.cardId, collection);
  }

  for (const alert of alerts) {
    const collection = alertsByCard.get(alert.cardId) ?? [];
    collection.push(alert);
    alertsByCard.set(alert.cardId, collection);
  }

  return [...alertsByCard.entries()]
    .map<CardInsight>(([cardId, cardAlerts]) => {
      const cardTransactions = transactionsByCard.get(cardId) ?? [];
      const fraudTypeCounts = new Map<string, number>();

      for (const alert of cardAlerts) {
        fraudTypeCounts.set(alert.fraudType, (fraudTypeCounts.get(alert.fraudType) ?? 0) + 1);
      }

      const primaryFraud = prettifyFraudType(topEntry(fraudTypeCounts));
      const riskPoints = Math.max(...cardAlerts.map((alert) => alert.riskPoints));
      const riskLevel = riskPoints >= 85 ? 'alto' : riskPoints >= 55 ? 'medio' : 'baixo';
      const explanation = [...cardAlerts]
        .sort((left, right) => right.riskPoints - left.riskPoints)[0]
        ?.reason ?? 'Comportamento fora do padrao esperado.';

      return {
        cardId,
        totalTransactions: cardTransactions.length,
        fraudCount: cardAlerts.length,
        primaryFraud,
        riskLevel,
        riskPoints,
        normalPattern: buildNormalPattern(cardTransactions),
        changedBehavior: buildBehaviorChange(cardTransactions, cardAlerts),
        explanation,
        estimatedLoss: sumEstimatedLoss(cardAlerts),
      };
    })
    .sort((left, right) => right.riskPoints - left.riskPoints || right.fraudCount - left.fraudCount)
    .slice(0, 8);
}

function buildStationInsights(alerts: FraudAlert[]) {
  const grouped = new Map<string, FraudAlert[]>();

  for (const alert of alerts) {
    const key = alert.locationLabel || 'Local nao informado';
    const collection = grouped.get(key) ?? [];
    collection.push(alert);
    grouped.set(key, collection);
  }

  return [...grouped.entries()]
    .map<StationInsight>(([station, stationAlerts]) => {
      const typeCounts = new Map<string, number>();

      for (const alert of stationAlerts) {
        typeCounts.set(alert.fraudType, (typeCounts.get(alert.fraudType) ?? 0) + 1);
      }

      return {
        station,
        fraudCount: stationAlerts.length,
        cardCount: new Set(stationAlerts.map((alert) => alert.cardId)).size,
        topFraud: prettifyFraudType(topEntry(typeCounts)),
        estimatedLoss: sumEstimatedLoss(stationAlerts),
      };
    })
    .sort((left, right) => right.fraudCount - left.fraudCount)
    .slice(0, 8);
}

function buildProfileInsights(alerts: FraudAlert[], transactions: TransactionRecord[]) {
  const transactionMap = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const totalsByProfile = new Map<string, number>();
  const suspiciousByProfile = new Map<string, Set<string>>();
  const fraudTypeByProfile = new Map<string, Map<string, number>>();

  for (const transaction of transactions) {
    const profile = transaction.userProfile || 'Perfil nao informado';
    totalsByProfile.set(profile, (totalsByProfile.get(profile) ?? 0) + 1);
  }

  for (const alert of alerts) {
    const profile = transactionMap.get(alert.transactionId)?.userProfile || 'Perfil nao informado';
    const suspicious = suspiciousByProfile.get(profile) ?? new Set<string>();
    suspicious.add(alert.transactionId);
    suspiciousByProfile.set(profile, suspicious);

    const typeCounts = fraudTypeByProfile.get(profile) ?? new Map<string, number>();
    typeCounts.set(alert.fraudType, (typeCounts.get(alert.fraudType) ?? 0) + 1);
    fraudTypeByProfile.set(profile, typeCounts);
  }

  return [...totalsByProfile.entries()]
    .map<ProfileInsight>(([profile, totalTransactions]) => {
      const suspiciousTransactions = suspiciousByProfile.get(profile)?.size ?? 0;
      const fraudRate = totalTransactions ? (suspiciousTransactions / totalTransactions) * 100 : 0;
      const mainDeviation = prettifyFraudType(topEntry(fraudTypeByProfile.get(profile) ?? new Map<string, number>(), 'Sem desvio relevante'));

      return {
        profile,
        totalTransactions,
        suspiciousTransactions,
        fraudRate,
        mainDeviation,
      };
    })
    .sort((left, right) => right.fraudRate - left.fraudRate)
    .slice(0, 6);
}

function buildExecutiveInsights(
  cards: CardInsight[],
  stations: StationInsight[],
  profiles: ProfileInsight[],
  fraudByType: Array<{ name: string; total: number }>,
  estimatedLoss: number,
) {
  const topCard = cards[0];
  const topStation = stations[0];
  const topProfile = profiles[0];
  const topFraud = fraudByType[0];

  const insights: ExecutiveInsight[] = [];

  if (topFraud) {
    insights.push({
      title: `Fraude dominante: ${topFraud.name}`,
      description: `${topFraud.total} ocorrencias concentradas nesse tipo, o que ajuda a priorizar a primeira frente de investigacao e resposta operacional.`,
    });
  }

  if (topCard) {
    insights.push({
      title: `Cartao mais critico: ${topCard.cardId}`,
      description: `${topCard.fraudCount} alertas com risco ${topCard.riskLevel} e perda potencial de ${formatCurrency(topCard.estimatedLoss)}. ${topCard.changedBehavior}`,
    });
  }

  if (topStation) {
    insights.push({
      title: `Hotspot principal: ${topStation.station}`,
      description: `${topStation.fraudCount} fraudes detectadas e ${topStation.cardCount} cartoes envolvidos. O local concentra ${topStation.topFraud} e deve receber monitoramento reforcado.`,
    });
  }

  if (topProfile) {
    insights.push({
      title: `Perfil mais desviado: ${topProfile.profile}`,
      description: `Taxa de fraude de ${formatPercent(topProfile.fraudRate)} nesse grupo, com destaque para ${topProfile.mainDeviation}. Esse perfil merece regra e trilha de investigacao especifica.`,
    });
  }

  if (!insights.length) {
    insights.push({
      title: 'Sem padroes relevantes',
      description: `Nao foram encontrados desvios suficientes para consolidar uma leitura executiva. Perda potencial acumulada: ${formatCurrency(estimatedLoss)}.`,
    });
  }

  return insights.slice(0, 4);
}

function buildAlertExplanations(alerts: FraudAlert[]) {
  return [...alerts]
    .sort((left, right) => right.riskPoints - left.riskPoints || right.timestamp - left.timestamp)
    .slice(0, 10)
    .map<AlertExplanation>((alert) => ({
      id: alert.id,
      cardId: alert.cardId,
      fraudType: prettifyFraudType(alert.fraudType),
      dateTime: alert.dateTime,
      location: alert.locationLabel,
      riskLevel: alert.riskScore,
      riskPoints: alert.riskPoints,
      whySuspicious: alert.reason,
      violatedRule: buildRuleViolation(alert.fraudType),
      impact: buildImpactText(alert),
    }));
}

function buildFraudByType(alerts: FraudAlert[]) {
  const counts = new Map<string, number>();

  for (const alert of alerts) {
    const name = prettifyFraudType(alert.fraudType);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((left, right) => right.total - left.total);
}

export function UserBehaviorPage() {
  const { dataset, sourceLabel } = useMonitoringData();
  const [selectedFraudType, setSelectedFraudType] = useState('todos');
  const [selectedStation, setSelectedStation] = useState('todas');

  const fraudTypeOptions = useMemo(
    () => ['todos', ...new Set(dataset.alerts.map((alert) => prettifyFraudType(alert.fraudType)))],
    [dataset.alerts],
  );

  const stationOptions = useMemo(
    () => ['todas', ...new Set(dataset.alerts.map((alert) => alert.locationLabel || 'Local nao informado'))],
    [dataset.alerts],
  );

  const filteredAlerts = useMemo(() => {
    return dataset.alerts.filter((alert) => {
      const matchesFraud = selectedFraudType === 'todos' || prettifyFraudType(alert.fraudType) === selectedFraudType;
      const matchesStation = selectedStation === 'todas' || (alert.locationLabel || 'Local nao informado') === selectedStation;

      return matchesFraud && matchesStation;
    });
  }, [dataset.alerts, selectedFraudType, selectedStation]);

  const filteredTransactionIds = useMemo(() => new Set(filteredAlerts.map((alert) => alert.transactionId)), [filteredAlerts]);
  const suspiciousTransactionCount = useMemo(() => filteredTransactionIds.size, [filteredTransactionIds]);
  const fraudRate = dataset.transactions.length ? (suspiciousTransactionCount / dataset.transactions.length) * 100 : 0;
  const estimatedLoss = useMemo(() => sumEstimatedLoss(filteredAlerts), [filteredAlerts]);
  const fraudByType = useMemo(() => buildFraudByType(filteredAlerts), [filteredAlerts]);
  const topCards = useMemo(() => buildCardInsights(filteredAlerts, dataset.transactions), [filteredAlerts, dataset.transactions]);
  const stationInsights = useMemo(() => buildStationInsights(filteredAlerts), [filteredAlerts]);
  const profileInsights = useMemo(() => buildProfileInsights(filteredAlerts, dataset.transactions), [filteredAlerts, dataset.transactions]);
  const executiveInsights = useMemo(
    () => buildExecutiveInsights(topCards, stationInsights, profileInsights, fraudByType, estimatedLoss),
    [topCards, stationInsights, profileInsights, fraudByType, estimatedLoss],
  );
  const alertExplanations = useMemo(() => buildAlertExplanations(filteredAlerts), [filteredAlerts]);

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Analista antifraude"
        title="Analise antifraude orientada ao negocio"
        description="Interprete a base carregada como uma central de decisao: compare comportamento atual vs esperado, classifique as fraudes, explique os desvios e destaque onde agir primeiro."
      />

      <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <label htmlFor="behavior-fraud-type" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Tipo de fraude
            </label>
            <select
              id="behavior-fraud-type"
              value={selectedFraudType}
              onChange={(event) => setSelectedFraudType(event.target.value)}
              className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
            >
              {fraudTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'todos' ? 'Todos os tipos' : option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="behavior-station" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Estacao ou local
            </label>
            <select
              id="behavior-station"
              value={selectedStation}
              onChange={(event) => setSelectedStation(event.target.value)}
              className="w-full rounded-2xl border border-line bg-[#f8fbff] px-4 py-3 text-sm text-panel outline-none transition focus:border-accent focus:bg-white"
            >
              {stationOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'todas' ? 'Todos os locais' : option}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] px-4 py-4 text-sm text-slate-600">
            <p className="font-semibold text-panel">{sourceLabel}</p>
            <p className="mt-1">{filteredAlerts.length} alerta(s) no recorte atual.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          title="Total de transacoes"
          value={dataset.transactions.length.toString()}
          subtitle="Base considerada nesta analise."
          icon={<TrendingUp size={20} />}
        />
        <CardResumo
          title="Fraudes detectadas"
          value={filteredAlerts.length.toString()}
          subtitle={`${suspiciousTransactionCount} transacao(oes) unicas sinalizadas.`}
          icon={<AlertTriangle size={20} />}
          tone="warning"
        />
        <CardResumo
          title="% de fraude"
          value={formatPercent(fraudRate)}
          subtitle="Participacao do recorte suspeito sobre o total de transacoes."
          icon={<CreditCard size={20} />}
          tone="danger"
        />
        <CardResumo
          title="Perda estimada"
          value={formatCurrency(estimatedLoss)}
          subtitle="Impacto financeiro potencial das ocorrencias filtradas."
          icon={<MapPin size={20} />}
          tone="success"
        />
      </div>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-panel">Resumo executivo</h2>
          <p className="text-sm text-slate-600">Principais leituras para decisao rapida, priorizando risco, impacto e resposta operacional.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {executiveInsights.map((insight) => (
            <article key={insight.title} className="rounded-3xl border border-line bg-[#f8fbff] p-5">
              <h3 className="text-base font-semibold text-panel">{insight.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{insight.description}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-panel">Top cartoes suspeitos</h2>
              <p className="text-sm text-slate-600">Visao individual com padrao normal, mudanca observada, nivel de risco e justificativa da suspeita.</p>
            </div>
          </div>

          <div className="space-y-4">
            {topCards.map((card) => (
              <article key={card.cardId} className="rounded-3xl border border-line bg-[#f8fbff] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.primaryFraud}</p>
                    <h3 className="mt-2 text-xl font-semibold text-panel">{card.cardId}</h3>
                  </div>
                  <div className="text-right">
                    <BadgeRisco level={card.riskLevel} />
                    <p className="mt-2 text-sm font-semibold text-panel">Score {card.riskPoints}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-line bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Transacoes</p>
                    <p className="mt-2 text-2xl font-semibold text-panel">{card.totalTransactions}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Fraudes</p>
                    <p className="mt-2 text-2xl font-semibold text-panel">{card.fraudCount}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Perda estimada</p>
                    <p className="mt-2 text-2xl font-semibold text-panel">{formatCurrency(card.estimatedLoss)}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                  <p><span className="font-semibold text-panel">Padrao normal:</span> {card.normalPattern}</p>
                  <p><span className="font-semibold text-panel">O que mudou:</span> {card.changedBehavior}</p>
                  <p><span className="font-semibold text-panel">Explicacao:</span> {card.explanation}</p>
                </div>
              </article>
            ))}

            {!topCards.length ? (
              <div className="rounded-3xl border border-line bg-[#f8fbff] px-5 py-12 text-center text-sm text-slate-500">
                Nenhum cartao suspeito encontrado para o recorte atual.
              </div>
            ) : null}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-panel">Fraudes por tipo</h2>
            <p className="mb-4 text-sm text-slate-600">Distribuicao das ocorrencias para ajudar na priorizacao das frentes de investigacao.</p>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart data={fraudByType}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #cfe0f5',
                      borderRadius: '16px',
                      color: '#12345b',
                    }}
                    labelStyle={{ color: '#0454a3', fontWeight: 600 }}
                  />
                  <Bar dataKey="total" radius={[12, 12, 0, 0]}>
                    {fraudByType.map((item, index) => (
                      <Cell key={item.name} fill={chartPalette[index % chartPalette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-panel">Desvios por perfil de usuario</h2>
            <p className="mb-4 text-sm text-slate-600">Compara o comportamento esperado vs real por tipo de usuario da base.</p>

            <div className="space-y-3">
              {profileInsights.map((profile) => (
                <article key={profile.profile} className="rounded-2xl border border-line bg-[#f8fbff] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-panel">{profile.profile}</h3>
                      <p className="mt-1 text-sm text-slate-600">Desvio principal: {profile.mainDeviation}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Taxa de fraude</p>
                      <p className="mt-1 text-xl font-semibold text-panel">{formatPercent(profile.fraudRate)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {profile.suspiciousTransactions} transacao(oes) suspeita(s) em {profile.totalTransactions} transacao(oes) totais.
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-panel">Analise por estacao</h2>
          <p className="text-sm text-slate-600">Ranking dos hotspots de fraude para orientar fiscalizacao, monitoramento e bloqueios preventivos.</p>
        </div>

        <div className="space-y-3">
          {stationInsights.map((station, index) => (
            <article key={station.station} className="rounded-2xl border border-line bg-[#f8fbff] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">#{index + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold text-panel">{station.station}</h3>
                  <p className="mt-1 text-sm text-slate-600">Tipo dominante: {station.topFraud}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-line bg-white px-4 py-3 text-center">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Fraudes</p>
                    <p className="mt-2 text-xl font-semibold text-panel">{station.fraudCount}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-3 text-center">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Cartoes</p>
                    <p className="mt-2 text-xl font-semibold text-panel">{station.cardCount}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-3 text-center">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Perda</p>
                    <p className="mt-2 text-xl font-semibold text-panel">{formatCurrency(station.estimatedLoss)}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {!stationInsights.length ? (
            <div className="rounded-3xl border border-line bg-[#f8fbff] px-5 py-12 text-center text-sm text-slate-500">
              Nenhum hotspot identificado para o recorte atual.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-panel">Padroes identificados</h2>
          <p className="text-sm text-slate-600">Comportamentos recorrentes convertidos em leitura executiva e acao recomendada.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {executiveInsights.map((insight) => (
            <article key={`${insight.title}-pattern`} className="rounded-3xl border border-line bg-[#f8fbff] p-5">
              <h3 className="text-base font-semibold text-panel">{insight.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{insight.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-panel">Explicacao clara dos alertas</h2>
          <p className="text-sm text-slate-600">Cada ocorrencia abaixo explica por que e suspeita, qual regra foi violada e qual impacto pode gerar ao negocio.</p>
        </div>

        <div className="space-y-4">
          {alertExplanations.map((alert) => (
            <article key={alert.id} className="rounded-3xl border border-line bg-[#f8fbff] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{alert.fraudType}</p>
                  <h3 className="mt-2 text-lg font-semibold text-panel">{alert.cardId}</h3>
                  <p className="mt-1 text-sm text-slate-600">{alert.location} | {formatDateTime(alert.dateTime)}</p>
                </div>
                <div className="text-right">
                  <BadgeRisco level={alert.riskLevel} />
                  <p className="mt-2 text-sm font-semibold text-panel">Score {alert.riskPoints}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                <p><span className="font-semibold text-panel">Por que e suspeito:</span> {alert.whySuspicious}</p>
                <p><span className="font-semibold text-panel">Regra violada:</span> {alert.violatedRule}</p>
                <p><span className="font-semibold text-panel">Impacto:</span> {alert.impact}</p>
              </div>
            </article>
          ))}

          {!alertExplanations.length ? (
            <div className="rounded-3xl border border-line bg-[#f8fbff] px-5 py-12 text-center text-sm text-slate-500">
              Nenhum alerta relevante para explicar no recorte atual.
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
