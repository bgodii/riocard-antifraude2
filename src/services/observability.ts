import { buildFinancialDashboard } from '@/services/financial';
import { lookupCard } from '@/services/cardLookupService';
import { createInitialSession, handleCopilotTurn } from '@/services/copilotService';
import { buildRiskActionCases, classifyRiskLevel } from '@/services/riskActions';
import type { FinancialEntry, FinancialFilterState } from '@/types/financial';
import type { FraudAlert, TransactionRecord, UploadedDataset } from '@/types/fraud';
import type {
  AuditAnomaly,
  AuditBehaviorStep,
  AuditImpact,
  AuditStatus,
  AuditTestResult,
  CopilotSimulationResult,
  LearningInsight,
  ObservabilityAuditRun,
  ObservabilitySnapshot,
} from '@/types/observability';

const HISTORY_STORAGE_KEY = 'riocard-observability-history';

const fullRangeFilters: FinancialFilterState = {
  startMonth: 'all',
  endMonth: 'all',
  category: 'all',
  type: 'all',
};

function createTestResult(
  suite: AuditTestResult['suite'],
  name: string,
  status: AuditStatus,
  impact: AuditImpact,
  expected: string,
  actual: string,
  detail: string,
  recommendation: string,
  evidence: string[] = [],
): AuditTestResult {
  return {
    id: `${suite}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    suite,
    name,
    status,
    impact,
    expected,
    actual,
    detail,
    recommendation,
    evidence,
    timestamp: new Date().toISOString(),
  };
}

function getHistory(): ObservabilityAuditRun[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ObservabilityAuditRun[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(run: ObservabilityAuditRun) {
  if (typeof window === 'undefined') {
    return;
  }

  const history = getHistory();
  const nextHistory = [run, ...history].slice(0, 20);
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
}

function round(value: number, digits = 1) {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getTopCard(dataset: UploadedDataset) {
  const grouped = new Map<string, number>();

  for (const alert of dataset.alerts) {
    grouped.set(alert.cardId, (grouped.get(alert.cardId) ?? 0) + 1);
  }

  return [...grouped.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
}

function buildFraudDistribution(dataset: UploadedDataset) {
  const grouped = new Map<string, number>();

  for (const alert of dataset.alerts) {
    grouped.set(alert.fraudType, (grouped.get(alert.fraudType) ?? 0) + 1);
  }

  return [...grouped.entries()].sort((left, right) => right[1] - left[1]);
}

function computeFinancialBaseline(entries: FinancialEntry[]) {
  return entries.reduce(
    (accumulator, entry) => {
      if (entry.type === 'receita') {
        accumulator.revenue += entry.value;
      } else {
        accumulator.cost += entry.value;
      }

      accumulator.months.add(entry.month);
      return accumulator;
    },
    { revenue: 0, cost: 0, months: new Set<string>() },
  );
}

function validateDataConsistency(snapshot: ObservabilitySnapshot): AuditTestResult[] {
  const results: AuditTestResult[] = [];
  const { dataset, financialEntries } = snapshot;
  const financialDashboard = buildFinancialDashboard(financialEntries, fullRangeFilters);
  const baseline = computeFinancialBaseline(financialEntries);
  const marginBaseline = baseline.revenue - baseline.cost;
  const statsAligned =
    dataset.stats.totalTransactions === dataset.transactions.length &&
    dataset.stats.uniqueCards === new Set(dataset.transactions.map((transaction) => transaction.cardId)).size;

  results.push(
    createTestResult(
      'consistencia_dados',
      'Base antifraude consolidada',
      statsAligned ? 'ok' : 'erro',
      statsAligned ? 'baixo' : 'alto',
      `totalTransactions=${dataset.transactions.length} e uniqueCards=${new Set(dataset.transactions.map((transaction) => transaction.cardId)).size}`,
      `totalTransactions=${dataset.stats.totalTransactions} e uniqueCards=${dataset.stats.uniqueCards}`,
      statsAligned
        ? 'Os totais consolidados da base antifraude batem com os dados normalizados.'
        : 'Os indicadores consolidados da base antifraude nao batem com as transacoes processadas.',
      statsAligned ? 'Nenhuma acao imediata.' : 'Revisar a agregacao do contexto MonitoringData antes de publicar novas analises.',
      [`Alertas ativos: ${dataset.alerts.length}`],
    ),
  );

  if (!financialEntries.length) {
    results.push(
      createTestResult(
        'consistencia_dados',
        'Base financeira carregada',
        'alerta',
        'medio',
        'Receitas, custos e margem auditaveis com base financeira carregada.',
        'Nenhuma base financeira disponivel.',
        'Sem base financeira, o agente nao consegue validar margens nem previsoes do modulo executivo.',
        'Carregar uma planilha financeira para habilitar a validacao completa do modulo Financeiro & Previsao.',
      ),
    );

    return results;
  }

  const revenueAligned = round(financialDashboard.kpis.revenueTotal, 0) === round(baseline.revenue, 0);
  const costAligned = round(financialDashboard.kpis.costTotal, 0) === round(baseline.cost, 0);
  const marginAligned = round(financialDashboard.kpis.marginTotal, 0) === round(marginBaseline, 0);
  const allAligned = revenueAligned && costAligned && marginAligned;

  results.push(
    createTestResult(
      'consistencia_dados',
      'Receita, custo e margem recalculados',
      allAligned ? 'ok' : 'erro',
      allAligned ? 'baixo' : 'critico',
      `Receita ${formatNumber(baseline.revenue)} | Custo ${formatNumber(baseline.cost)} | Margem ${formatNumber(marginBaseline)}`,
      `Receita ${formatNumber(financialDashboard.kpis.revenueTotal)} | Custo ${formatNumber(financialDashboard.kpis.costTotal)} | Margem ${formatNumber(financialDashboard.kpis.marginTotal)}`,
      allAligned
        ? 'Os KPIs financeiros exibidos estao coerentes com o recalculo independente da base carregada.'
        : 'Foi encontrada divergencia entre o recalculo independente e os KPIs do modulo financeiro.',
      allAligned ? 'Nenhuma acao imediata.' : 'Revisar normalizacao dos valores e agregacao mensal antes da exibicao.',
      [`Meses auditados: ${baseline.months.size}`, `Lancamentos ativos: ${financialEntries.length}`],
    ),
  );

  return results;
}

function validateCharts(snapshot: ObservabilitySnapshot): AuditTestResult[] {
  const { dataset, financialEntries } = snapshot;
  const results: AuditTestResult[] = [];
  const financialDashboard = buildFinancialDashboard(financialEntries, fullRangeFilters);
  const uniqueHistoryMonths = new Set(financialDashboard.history.map((point) => point.month));
  const historyHasDuplicates = uniqueHistoryMonths.size !== financialDashboard.history.length;
  const missingFinancialLabels = financialDashboard.combinedTimeline.some((point) => !point.monthLabel);

  results.push(
    createTestResult(
      'graficos',
      'Serie financeira sem duplicidade',
      !historyHasDuplicates ? 'ok' : 'erro',
      !historyHasDuplicates ? 'baixo' : 'alto',
      'Um ponto historico por mes na linha financeira.',
      `${financialDashboard.history.length} pontos historicos para ${uniqueHistoryMonths.size} meses unicos.`,
      !historyHasDuplicates
        ? 'A linha historica do financeiro nao apresenta meses duplicados.'
        : 'Existem meses duplicados na serie historica financeira, o que pode distorcer barras e linhas.',
      !historyHasDuplicates ? 'Nenhuma acao imediata.' : 'Revisar a consolidacao mensal antes de renderizar os graficos.',
    ),
  );

  results.push(
    createTestResult(
      'graficos',
      'Rotulos financeiros preenchidos',
      !missingFinancialLabels ? 'ok' : 'alerta',
      !missingFinancialLabels ? 'baixo' : 'medio',
      'Todos os pontos financeiros com rotulo de mes.',
      missingFinancialLabels ? 'Foram encontrados pontos sem monthLabel.' : 'Todos os pontos possuem monthLabel.',
      !missingFinancialLabels
        ? 'Os rotulos curtos de mes estao prontos para exibicao nos eixos.'
        : 'Existem pontos sem rotulo, o que pode gerar falhas visuais nos eixos dos graficos.',
      !missingFinancialLabels ? 'Nenhuma acao imediata.' : 'Garantir que todo ponto financeiro seja enviado com monthLabel.',
    ),
  );

  const alertDays = new Set(dataset.alerts.map((alert) => alert.dateTime.slice(0, 10))).size;
  const hasAlertsWithoutLocations = dataset.alerts.some((alert) => !alert.locationLabel);

  results.push(
    createTestResult(
      'graficos',
      'Serie de fraude com cobertura minima',
      dataset.alerts.length === 0 || (alertDays > 0 && !hasAlertsWithoutLocations) ? 'ok' : 'alerta',
      dataset.alerts.length === 0 || (alertDays > 0 && !hasAlertsWithoutLocations) ? 'baixo' : 'medio',
      'Alertas com dia e local suficientes para timeline e distribuicao por local.',
      `${dataset.alerts.length} alertas | ${alertDays} dias com eventos | locais faltantes=${hasAlertsWithoutLocations ? 'sim' : 'nao'}`,
      dataset.alerts.length === 0
        ? 'Sem alertas carregados, os graficos de fraude ficam corretamente vazios.'
        : hasAlertsWithoutLocations
          ? 'Foram encontrados alertas sem localizacao consolidada, o que pode gerar barras incompletas.'
          : 'Os alertas possuem densidade minima para alimentar timeline e distribuicao geolocalizada.',
      hasAlertsWithoutLocations ? 'Revisar a formacao de locationLabel durante a normalizacao da planilha.' : 'Nenhuma acao imediata.',
    ),
  );

  return results;
}

function validateForecast(snapshot: ObservabilitySnapshot): AuditTestResult[] {
  const { financialEntries } = snapshot;
  const results: AuditTestResult[] = [];

  if (!financialEntries.length) {
    return [
      createTestResult(
        'forecast',
        'Forecast financeiro disponivel',
        'alerta',
        'medio',
        'Seis meses de previsao baseados no historico carregado.',
        'Sem base financeira carregada.',
        'Nao ha historico financeiro para gerar previsao confiavel.',
        'Carregar uma base financeira antes de auditar tendencia e outliers.',
      ),
    ];
  }

  const financialDashboard = buildFinancialDashboard(financialEntries, fullRangeFilters);
  const averageRevenue = average(financialDashboard.history.map((point) => point.revenue));
  const averageCost = average(financialDashboard.history.map((point) => point.cost));
  const absurdRevenueOutlier = financialDashboard.forecast.some((point) => point.revenue > averageRevenue * 3.2 && averageRevenue > 0);
  const absurdCostOutlier = financialDashboard.forecast.some((point) => point.cost > averageCost * 3.2 && averageCost > 0);
  const validHorizon = financialDashboard.forecast.length === 6;

  results.push(
    createTestResult(
      'forecast',
      'Horizonte de previsao',
      validHorizon ? 'ok' : 'erro',
      validHorizon ? 'baixo' : 'alto',
      'Forecast com 6 meses futuros.',
      `${financialDashboard.forecast.length} meses projetados.`,
      validHorizon
        ? 'A previsao financeira cobre exatamente os proximos 6 meses, como esperado.'
        : 'A previsao nao retornou 6 meses completos, comprometendo a leitura executiva.',
      validHorizon ? 'Nenhuma acao imediata.' : 'Revisar a geracao da serie futura no modulo financeiro.',
    ),
  );

  results.push(
    createTestResult(
      'forecast',
      'Outliers absurdos no forecast',
      !absurdRevenueOutlier && !absurdCostOutlier ? 'ok' : 'alerta',
      !absurdRevenueOutlier && !absurdCostOutlier ? 'baixo' : 'alto',
      'Previsao aderente ao comportamento medio recente.',
      `media receita=${formatNumber(averageRevenue)} | media custo=${formatNumber(averageCost)} | outlierReceita=${absurdRevenueOutlier ? 'sim' : 'nao'} | outlierCusto=${absurdCostOutlier ? 'sim' : 'nao'}`,
      !absurdRevenueOutlier && !absurdCostOutlier
        ? 'A previsao esta em uma faixa plausivel frente ao historico recente.'
        : 'A previsao projetou valores muito acima do historico medio, sinalizando risco de distorcao.',
      !absurdRevenueOutlier && !absurdCostOutlier
        ? 'Nenhuma acao imediata.'
        : 'Ajustar pesos da media movel e da tendencia linear para reduzir explosoes artificiais.',
    ),
  );

  return results;
}

function getIndependentRiskLevel(transactions: TransactionRecord[], alerts: FraudAlert[]) {
  const highestScore = Math.max(
    ...transactions.map((transaction) => Math.max(transaction.baseRiskScore ?? 0, transaction.modelRiskScore ?? 0)),
    ...alerts.map((alert) => alert.riskPoints),
    0,
  );

  return classifyRiskLevel(highestScore > 1 ? highestScore / 100 : highestScore);
}

function validateAntifraud(snapshot: ObservabilitySnapshot): AuditTestResult[] {
  const { dataset } = snapshot;
  const results: AuditTestResult[] = [];
  const cases = buildRiskActionCases(dataset);
  const topCase = cases[0];

  if (!dataset.transactions.length) {
    return [
      createTestResult(
        'antifraude',
        'Base antifraude disponivel',
        'alerta',
        'medio',
        'Transacoes suficientes para recalcular score e classificacao.',
        'Nenhuma transacao carregada.',
        'Sem base antifraude, o agente nao consegue validar score, fraude ou regressao operacional.',
        'Carregar uma planilha transacional antes da auditoria antifraude.',
      ),
    ];
  }

  const groupedTransactions = new Map<string, TransactionRecord[]>();
  const groupedAlerts = new Map<string, FraudAlert[]>();

  for (const transaction of dataset.transactions) {
    const list = groupedTransactions.get(transaction.cardId) ?? [];
    list.push(transaction);
    groupedTransactions.set(transaction.cardId, list);
  }

  for (const alert of dataset.alerts) {
    const list = groupedAlerts.get(alert.cardId) ?? [];
    list.push(alert);
    groupedAlerts.set(alert.cardId, list);
  }

  const mismatches = cases.filter((item) => {
    const riskLevel = getIndependentRiskLevel(groupedTransactions.get(item.cardId) ?? [], groupedAlerts.get(item.cardId) ?? []);
    return riskLevel !== item.riskLevel;
  });

  results.push(
    createTestResult(
      'antifraude',
      'Classificacao de risco coerente',
      mismatches.length === 0 ? 'ok' : 'erro',
      mismatches.length === 0 ? 'baixo' : 'alto',
      'Classificacao do caso alinhada ao maior score observado por cartao.',
      `${mismatches.length} divergencia(s) em ${cases.length} casos auditados.`,
      mismatches.length === 0
        ? 'Os casos de risco seguem o mesmo racional de classificacao do recalculo independente.'
        : 'Existem casos cuja criticidade nao bate com o score maximo encontrado nas transacoes e alertas.',
      mismatches.length === 0 ? 'Nenhuma acao imediata.' : 'Revisar a composicao do score consolidado e a classificacao final.',
      topCase ? [`Cartao lider de risco: ${topCase.cardId}`, `Nivel mais alto atual: ${topCase.riskLevel}`] : [],
    ),
  );

  const invalidFraudTypes = dataset.alerts.filter((alert) => !alert.fraudType);

  results.push(
    createTestResult(
      'antifraude',
      'Alertas classificados por tipo',
      invalidFraudTypes.length === 0 ? 'ok' : 'alerta',
      invalidFraudTypes.length === 0 ? 'baixo' : 'medio',
      'Todo alerta com tipo de fraude legivel.',
      `${invalidFraudTypes.length} alerta(s) sem tipo consistente.`,
      invalidFraudTypes.length === 0
        ? 'Todos os alertas possuem tipo de fraude definido para triagem.'
        : 'Foram encontrados alertas sem tipificacao clara, o que prejudica investigacao e dashboard.',
      invalidFraudTypes.length === 0 ? 'Nenhuma acao imediata.' : 'Revisar a classificacao devolvida pelo motor antifraude.',
    ),
  );

  return results;
}

function validateAutomaticActions(snapshot: ObservabilitySnapshot): AuditTestResult[] {
  const { dataset } = snapshot;
  const cases = buildRiskActionCases(dataset);
  const criticalCases = cases.filter((item) => item.riskLevel === 'critico');
  const blockedCriticalCases = criticalCases.filter((item) => item.cardStatus === 'bloqueado');
  const criticalCasesMissingLogs = criticalCases.filter(
    (item) => !item.executedActionTypes.includes('bloqueio') || !item.executedActionTypes.includes('analise_humana'),
  );

  return [
    createTestResult(
      'acoes_automaticas',
      'Bloqueio automatico em casos criticos',
      criticalCases.length === blockedCriticalCases.length ? 'ok' : 'erro',
      criticalCases.length === blockedCriticalCases.length ? 'baixo' : 'critico',
      `${criticalCases.length} caso(s) criticos bloqueados preventivamente.`,
      `${blockedCriticalCases.length} de ${criticalCases.length} caso(s) criticos bloqueados.`,
      criticalCases.length === blockedCriticalCases.length
        ? 'Todos os casos criticos estao com bloqueio automatico consistente.'
        : 'Existe caso critico sem bloqueio preventivo, o que representa risco operacional elevado.',
      criticalCases.length === blockedCriticalCases.length ? 'Nenhuma acao imediata.' : 'Revisar a regra de cardStatus para risco critico.',
    ),
    createTestResult(
      'acoes_automaticas',
      'Timeline de alerta e caso humano',
      criticalCasesMissingLogs.length === 0 ? 'ok' : 'alerta',
      criticalCasesMissingLogs.length === 0 ? 'baixo' : 'alto',
      'Casos criticos com logs de bloqueio, alerta e analise humana.',
      `${criticalCasesMissingLogs.length} caso(s) criticos sem trilha completa.`,
      criticalCasesMissingLogs.length === 0
        ? 'A trilha automatica cobre bloqueio, comunicacao e abertura de caso humano.'
        : 'Nem todo caso critico esta gerando a trilha automatica completa esperada.',
      criticalCasesMissingLogs.length === 0 ? 'Nenhuma acao imediata.' : 'Completar a timeline automatica para garantir auditabilidade.',
    ),
  ];
}

function runCopilotScenario(dataset: UploadedDataset, cardId: string, issuePrompt: string) {
  let session = createInitialSession('web');

  const conversation = [
    'Camila Mantilla',
    '12345678901',
    'Rua das Laranjeiras, 200 - Rio de Janeiro',
    cardId,
    issuePrompt,
  ];

  let lastMessage = '';

  for (const input of conversation) {
    const result = handleCopilotTurn({
      channel: 'web',
      input,
      session,
      dataset,
    });

    session = result.session;
    lastMessage = result.messages.at(-1)?.content ?? lastMessage;
  }

  return { session, lastMessage };
}

function validateCopilot(snapshot: ObservabilitySnapshot) {
  const { dataset } = snapshot;
  const topCard = getTopCard(dataset)?.[0] ?? dataset.transactions[0]?.cardId ?? '';

  if (!topCard) {
    const fallbackResult = createTestResult(
      'copilot',
      'Copilot com base carregada',
      'alerta',
      'medio',
      'Atendimento guiado com cartao localizado na base ativa.',
      'Nenhum cartao disponivel para simulacao.',
      'Sem base transacional, nao foi possivel simular um atendimento real do Copilot.',
      'Carregar uma planilha de transacoes antes da auditoria conversacional.',
    );

    return {
      tests: [fallbackResult],
      simulations: [] as CopilotSimulationResult[],
    };
  }

  const usageScenario = runCopilotScenario(dataset, topCard, 'onde usei meu cartao');
  const fraudScenario = runCopilotScenario(dataset, topCard, 'acho que clonaram meu cartao');
  const lookup = lookupCard(dataset, topCard);
  const lastTransactionsMentioned = usageScenario.lastMessage.toLowerCase().includes('ultimas utilizacoes');
  const fraudRouteValid = fraudScenario.session.lastIntent === 'fraud_suspicion';
  const cardWasFound = Boolean(lookup);

  const simulations: CopilotSimulationResult[] = [
    {
      id: 'copilot-usage',
      scenario: 'Consulta de uso',
      intent: 'usage_history',
      route: usageScenario.session.lastRoute,
      status: lastTransactionsMentioned ? 'ok' : 'alerta',
      detail: lastTransactionsMentioned
        ? 'O Copilot localizou o cartao e respondeu com historico recente.'
        : 'O Copilot nao deixou claro o historico recente ao simular consulta de uso.',
    },
    {
      id: 'copilot-fraud',
      scenario: 'Suspeita de fraude',
      intent: 'fraud_suspicion',
      route: fraudScenario.session.lastRoute,
      status: fraudRouteValid ? 'ok' : 'erro',
      detail: fraudRouteValid
        ? 'O fluxo entendeu a suspeita de fraude e aplicou a rota esperada.'
        : 'A simulacao de suspeita de fraude nao foi classificada corretamente.',
    },
  ];

  const tests = [
    createTestResult(
      'copilot',
      'Localizacao do cartao na base carregada',
      cardWasFound ? 'ok' : 'erro',
      cardWasFound ? 'baixo' : 'critico',
      'Copilot encontra o cartao digitado pelo usuario na base transacional atual.',
      cardWasFound ? `Cartao ${topCard} localizado.` : `Cartao ${topCard} nao localizado.`,
      cardWasFound
        ? 'O fluxo de atendimento esta usando a base carregada para localizar o cartao informado.'
        : 'O Copilot nao conseguiu localizar um cartao que deveria existir na base auditada.',
      cardWasFound ? 'Nenhuma acao imediata.' : 'Revisar a busca do cardLookupService e a normalizacao da entrada.',
    ),
    createTestResult(
      'copilot',
      'Resposta coerente para consulta de uso',
      lastTransactionsMentioned ? 'ok' : 'alerta',
      lastTransactionsMentioned ? 'baixo' : 'medio',
      'Mensagem com ultimas transacoes apos identificacao do cartao.',
      usageScenario.lastMessage || 'Sem mensagem final.',
      lastTransactionsMentioned
        ? 'A resposta do Copilot ficou coerente com a intencao de consulta de uso.'
        : 'A resposta final nao deixou clara a consulta das transacoes recentes.',
      lastTransactionsMentioned ? 'Nenhuma acao imediata.' : 'Reforcar o template de resposta para historico de uso.',
    ),
    createTestResult(
      'copilot',
      'Decisao correta em suspeita de fraude',
      fraudRouteValid ? 'ok' : 'erro',
      fraudRouteValid ? 'baixo' : 'alto',
      'Fluxo entende suspeita de fraude e segue para resposta ou escalonamento adequado.',
      `Intent=${fraudScenario.session.lastIntent ?? 'none'} | route=${fraudScenario.session.lastRoute}`,
      fraudRouteValid
        ? 'A intencao de fraude foi reconhecida no fluxo conversacional.'
        : 'O motor conversacional nao entendeu corretamente uma suspeita de fraude.',
      fraudRouteValid ? 'Nenhuma acao imediata.' : 'Revisar interpretacao de linguagem natural e decision engine.',
    ),
  ];

  return { tests, simulations };
}

function simulateBehavior(snapshot: ObservabilitySnapshot): AuditBehaviorStep[] {
  const { dataset, financialEntries } = snapshot;
  const sampleCard = dataset.transactions[0]?.cardId;

  return [
    {
      id: 'upload-antifraude',
      label: 'Upload de planilha antifraude',
      status: dataset.rawRows.length ? 'ok' : 'alerta',
      detail: dataset.rawRows.length
        ? `${dataset.rawRows.length} linhas brutas prontas para exploracao na aplicacao.`
        : 'Nenhuma planilha transacional carregada no momento.',
    },
    {
      id: 'navigate-financial',
      label: 'Navegacao entre abas',
      status: financialEntries.length || dataset.transactions.length ? 'ok' : 'alerta',
      detail:
        financialEntries.length || dataset.transactions.length
          ? 'Ha dados suficientes para navegar entre modulos sem estado vazio total.'
          : 'A aplicacao esta sem base carregada, entao a navegacao exibira apenas estados vazios.',
    },
    {
      id: 'apply-filters',
      label: 'Aplicacao de filtros',
      status: dataset.alerts.length || financialEntries.length ? 'ok' : 'alerta',
      detail:
        dataset.alerts.length || financialEntries.length
          ? 'Os modulos possuem massa de dados para testar filtros, ordenacao e KPIs.'
          : 'Sem dados suficientes para validar comportamento de filtros.',
    },
    {
      id: 'card-action',
      label: 'Acao operacional no cartao',
      status: sampleCard ? 'ok' : 'alerta',
      detail: sampleCard
        ? `Existe pelo menos um cartao (${sampleCard}) elegivel para simular bloqueio e auditoria de acoes.`
        : 'Nao existe cartao carregado para simular acao operacional.',
    },
    {
      id: 'copilot-flow',
      label: 'Interacao com o Copilot',
      status: sampleCard ? 'ok' : 'alerta',
      detail: sampleCard
        ? 'O agente pode simular onboarding, localizacao do cartao e tratamento de duvidas.'
        : 'Sem cartao carregado, o Copilot nao pode ser testado ponta a ponta.',
    },
  ];
}

function detectAnomalies(snapshot: ObservabilitySnapshot): AuditAnomaly[] {
  const { dataset, financialEntries } = snapshot;
  const anomalies: AuditAnomaly[] = [];

  if (dataset.transactions.length && dataset.alerts.length > dataset.transactions.length * 0.7) {
    anomalies.push({
      id: 'dense-alerts',
      title: 'Densidade alta de alertas',
      severity: 'alto',
      description: 'A base esta gerando alertas em proporcao muito alta em relacao ao total de transacoes. Vale revisar thresholds e qualidade da origem.',
    });
  }

  if (financialEntries.length) {
    const dashboard = buildFinancialDashboard(financialEntries, fullRangeFilters);
    const negativeForecastMonths = dashboard.forecast.filter((point) => point.margin < 0).length;

    if (negativeForecastMonths >= 2) {
      anomalies.push({
        id: 'negative-forecast',
        title: 'Forecast com margem negativa recorrente',
        severity: 'alto',
        description: `${negativeForecastMonths} meses projetados estao com margem negativa, o que sugere risco financeiro futuro relevante.`,
      });
    }
  }

  const topFraud = buildFraudDistribution(dataset)[0];
  if (topFraud && dataset.alerts.length && topFraud[1] / dataset.alerts.length >= 0.65) {
    anomalies.push({
      id: 'fraud-concentration',
      title: 'Concentracao elevada em um tipo de fraude',
      severity: 'medio',
      description: `${topFraud[0]} responde por ${round((topFraud[1] / dataset.alerts.length) * 100)}% dos alertas atuais.`,
    });
  }

  if (!anomalies.length) {
    anomalies.push({
      id: 'steady-state',
      title: 'Sem anomalias criticas imediatas',
      severity: 'baixo',
      description: 'No recorte atual, o agente nao encontrou desvios estruturais relevantes alem dos testes pontuais.',
    });
  }

  return anomalies;
}

function inferSuggestedCause(test: AuditTestResult) {
  if (test.suite === 'consistencia_dados') {
    return 'Possivel falha de agregacao, normalizacao de colunas ou conversao numerica na leitura da planilha.';
  }

  if (test.suite === 'forecast') {
    return 'Possivel desbalanceamento entre media movel e tendencia linear no modelo de previsao.';
  }

  if (test.suite === 'copilot') {
    return 'Possivel falha na interpretacao de linguagem natural ou na busca do cartao na base carregada.';
  }

  if (test.suite === 'acoes_automaticas') {
    return 'Possivel quebra nas regras operacionais que disparam bloqueio, alerta ou abertura de caso.';
  }

  return 'Possivel regressao funcional ou dado de entrada fora do padrao esperado.';
}

function buildLearningInsights(currentTests: AuditTestResult[], history: ObservabilityAuditRun[]): LearningInsight[] {
  const relevantTests = [...history.flatMap((run) => run.tests), ...currentTests].filter((test) => test.status !== 'ok');
  const grouped = new Map<string, AuditTestResult[]>();

  for (const test of relevantTests) {
    const list = grouped.get(test.id) ?? [];
    list.push(test);
    grouped.set(test.id, list);
  }

  return [...grouped.entries()]
    .map(([signature, items]) => ({
      signature,
      occurrences: items.length,
      firstSeen: items[items.length - 1]?.timestamp ?? new Date().toISOString(),
      lastSeen: items[0]?.timestamp ?? new Date().toISOString(),
      suggestedCause: inferSuggestedCause(items[0]),
    }))
    .sort((left, right) => right.occurrences - left.occurrences)
    .slice(0, 6);
}

function markRegressions(currentTests: AuditTestResult[], previousRun?: ObservabilityAuditRun) {
  if (!previousRun) {
    return currentTests;
  }

  const previousStatuses = new Map(previousRun.tests.map((test) => [test.id, test.status]));

  return currentTests.map((test) => {
    const previousStatus = previousStatuses.get(test.id);
    if (previousStatus === 'ok' && test.status !== 'ok') {
      return {
        ...test,
        status: 'regressao' as const,
        impact: test.impact === 'baixo' ? 'alto' : test.impact,
        detail: `${test.detail} O teste estava OK na execucao anterior e agora falhou, por isso foi marcado como REGRESSAO CRITICA.`,
      };
    }

    return test;
  });
}

function buildSummary(tests: AuditTestResult[]) {
  const totalTests = tests.length;
  const ok = tests.filter((test) => test.status === 'ok').length;
  const errors = tests.filter((test) => test.status === 'erro').length;
  const alerts = tests.filter((test) => test.status === 'alerta').length;
  const regressions = tests.filter((test) => test.status === 'regressao').length;
  const accuracyPct = totalTests ? round((ok / totalTests) * 100) : 0;

  return {
    totalTests,
    ok,
    errors,
    alerts,
    regressions,
    accuracyPct,
  };
}

export function runFullAudit(snapshot: ObservabilitySnapshot): ObservabilityAuditRun {
  const previousRun = getHistory()[0];
  const consistencyTests = validateDataConsistency(snapshot);
  const chartTests = validateCharts(snapshot);
  const forecastTests = validateForecast(snapshot);
  const antifraudTests = validateAntifraud(snapshot);
  const actionTests = validateAutomaticActions(snapshot);
  const copilotBundle = validateCopilot(snapshot);
  const behaviorSteps = simulateBehavior(snapshot);
  const anomalies = detectAnomalies(snapshot);
  const anomalyTests = anomalies.map((anomaly) =>
    createTestResult(
      'anomalias',
      anomaly.title,
      anomaly.severity === 'alto' || anomaly.severity === 'critico' ? 'alerta' : 'ok',
      anomaly.severity,
      'Sem desvio estrutural relevante na operacao.',
      anomaly.description,
      anomaly.description,
      anomaly.severity === 'alto' || anomaly.severity === 'critico'
        ? 'Investigar imediatamente o desvio destacado pelo detector de anomalias.'
        : 'Manter acompanhamento continuo.',
    ),
  );
  const behaviorTests = behaviorSteps.map((step) =>
    createTestResult(
      'simulacao_usuario',
      step.label,
      step.status,
      step.status === 'ok' ? 'baixo' : 'medio',
      'Fluxo de uso simulavel pelo agente autonomo.',
      step.detail,
      step.detail,
      step.status === 'ok' ? 'Nenhuma acao imediata.' : 'Carregar dados ou revisar o fluxo correspondente.',
    ),
  );

  const tests = markRegressions(
    [
      ...consistencyTests,
      ...chartTests,
      ...forecastTests,
      ...antifraudTests,
      ...actionTests,
      ...copilotBundle.tests,
      ...behaviorTests,
      ...anomalyTests,
    ],
    previousRun,
  );

  const cases = buildRiskActionCases(snapshot.dataset);
  const recurringFraudTypes = buildFraudDistribution(snapshot.dataset)
    .slice(0, 3)
    .map(([fraudType]) => fraudType as ObservabilityAuditRun['recurringFraudTypes'][number]);
  const run: ObservabilityAuditRun = {
    id: `audit-${Date.now()}`,
    executedAt: new Date().toISOString(),
    summary: buildSummary(tests),
    sourceOverview: {
      transactionRows: snapshot.dataset.transactions.length,
      alerts: snapshot.dataset.alerts.length,
      cards: snapshot.dataset.stats.uniqueCards,
      financialEntries: snapshot.financialEntries.length,
    },
    tests,
    anomalies,
    behaviorSteps,
    copilotSimulations: copilotBundle.simulations,
    learningInsights: buildLearningInsights(tests, getHistory()),
    actionSummary: {
      criticalCases: cases.filter((item) => item.riskLevel === 'critico').length,
      blockedCards: cases.filter((item) => item.cardStatus === 'bloqueado').length,
      escalatedCases: cases.filter((item) => item.caseStatus === 'em_analise').length,
      topRiskLevel: cases[0]?.riskLevel ?? 'baixo',
    },
    recurringFraudTypes,
  };

  saveHistory(run);
  return run;
}

export function getObservabilityHistory() {
  return getHistory();
}

export function startMonitoring(
  interval: number,
  execute: () => ObservabilityAuditRun,
  onRun: (run: ObservabilityAuditRun) => void,
) {
  const safeInterval = Math.max(15_000, interval);
  const timer = window.setInterval(() => {
    const run = execute();
    onRun(run);
  }, safeInterval);

  return () => window.clearInterval(timer);
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportAuditJson(run: ObservabilityAuditRun) {
  downloadTextFile(`observabilidade-${run.id}.json`, JSON.stringify(run, null, 2), 'application/json');
}

export function exportAuditCsv(run: ObservabilityAuditRun) {
  const headers = ['suite', 'teste', 'status', 'impacto', 'esperado', 'obtido', 'detalhe', 'recomendacao'];
  const body = run.tests.map((test) =>
    [
      test.suite,
      test.name,
      test.status,
      test.impact,
      test.expected,
      test.actual,
      test.detail,
      test.recommendation,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(','),
  );

  downloadTextFile(`observabilidade-${run.id}.csv`, [headers.join(','), ...body].join('\n'), 'text/csv;charset=utf-8');
}

export function exportExecutiveReport(run: ObservabilityAuditRun) {
  const lines = [
    'Relatorio Executivo - Observabilidade & Validacao',
    '',
    `Execucao: ${formatDateTime(run.executedAt)}`,
    `Acuracia geral: ${run.summary.accuracyPct}%`,
    `Erros: ${run.summary.errors}`,
    `Alertas: ${run.summary.alerts}`,
    `Regressoes: ${run.summary.regressions}`,
    '',
    'Principais achados:',
    ...run.tests
      .filter((test) => test.status !== 'ok')
      .slice(0, 8)
      .map((test) => `- [${test.status.toUpperCase()}] ${test.name}: ${test.detail}`),
    '',
    'Riscos e impactos:',
    ...run.anomalies.map((item) => `- ${item.title}: ${item.description}`),
    '',
    'Aprendizados recorrentes:',
    ...run.learningInsights.slice(0, 5).map((item) => `- ${item.signature}: ${item.suggestedCause}`),
  ];

  downloadTextFile(`observabilidade-${run.id}.txt`, lines.join('\n'), 'text/plain;charset=utf-8');
}
