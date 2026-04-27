import type { CopilotDecision, CopilotDecisionContext, CopilotIntent } from '@/types/copilot';

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const intentMatchers: Array<{ intent: CopilotIntent; keywords: string[] }> = [
  {
    intent: 'human_agent',
    keywords: ['atendente', 'humano', 'pessoa', 'suporte', 'falar com alguem'],
  },
  {
    intent: 'refund',
    keywords: ['reembolso', 'estorno', 'devolver valor', 'ressarcimento'],
  },
  {
    intent: 'fraud_suspicion',
    keywords: ['fraude', 'clonaram', 'clonagem', 'suspeita', 'cartao usado por outro', 'atividade estranha'],
  },
  {
    intent: 'usage_history',
    keywords: ['historico', 'onde usei', 'ultimas transacoes', 'ultimos usos', 'consulta de uso', 'extrato'],
  },
  {
    intent: 'report_issue',
    keywords: ['nao funcionou', 'nao passou', 'bilhete nao funcionou', 'cartao nao passou', 'erro na leitura', 'bloqueado'],
  },
  {
    intent: 'faq',
    keywords: ['duvida', 'ajuda', 'como funciona', 'como faco', 'saldo'],
  },
];

export function interpretIntent(input: string): CopilotIntent {
  const text = normalize(input);

  const fraudByNegationPatterns = [
    ['nao usei', 'cartao'],
    ['nao fui eu'],
    ['nao reconheco'],
    ['nao reconheci'],
    ['nao autorizei'],
    ['uso indevido'],
    ['usaram meu cartao'],
    ['cartao usado por outra pessoa'],
  ];

  if (
    fraudByNegationPatterns.some((pattern) =>
      Array.isArray(pattern) ? pattern.every((token) => text.includes(token)) : text.includes(pattern),
    )
  ) {
    return 'fraud_suspicion';
  }

  for (const matcher of intentMatchers) {
    if (matcher.keywords.some((keyword) => text.includes(keyword))) {
      return matcher.intent;
    }
  }

  return 'unknown';
}

export function decideCopilotAction({ intent, lookup, input }: CopilotDecisionContext): CopilotDecision {
  const normalizedInput = normalize(input);
  const explicitHuman = ['atendente', 'humano', 'especialista'].some((token) => normalizedInput.includes(token));
  const multipleFailures = lookup.failures.length >= 2;
  const highRisk = lookup.summary.riskScore === 'alto';
  const blocked = lookup.summary.status === 'bloqueado';

  if (explicitHuman || intent === 'human_agent') {
    return 'handoff';
  }

  if (intent === 'unknown') {
    return 'ask_info';
  }

  if (intent === 'refund' && lookup.failures.length === 0) {
    return 'ask_info';
  }

  if ((intent === 'report_issue' || intent === 'refund') && (multipleFailures || blocked)) {
    return 'handoff';
  }

  if (intent === 'fraud_suspicion' && (highRisk || blocked || lookup.alerts.length > 1)) {
    return 'handoff';
  }

  return 'resolve';
}
