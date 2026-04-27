import { decideCopilotAction, interpretIntent } from '@/services/decisionEngine';
import { isValidCardFormat, lookupCard, maskCardId, normalizeCardInput } from '@/services/cardLookupService';
import type {
  CardFailure,
  CardLookupResult,
  CopilotChannel,
  CopilotIntent,
  CopilotMessage,
  CopilotSessionState,
  CopilotTone,
  CopilotTurnParams,
  CopilotTurnResult,
} from '@/types/copilot';
import type { TransactionRecord, UploadedDataset } from '@/types/fraud';

function createMessage(
  channel: CopilotChannel,
  role: CopilotMessage['role'],
  content: string,
  tone: CopilotTone = 'default',
  suggestions?: string[],
): CopilotMessage {
  return {
    id: `${channel}-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    tone,
    timestamp: new Date().toISOString(),
    channel,
    suggestions,
  };
}

function formatDateTime(dateTime: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateTime));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function buildReferenceProtocol(prefix: string, cardId: string) {
  const digits = cardId.replace(/\D/g, '').slice(-4) || '0000';
  const suffix = `${Date.now()}`.slice(-6);
  return `${prefix}-${digits}-${suffix}`;
}

function buildLookupLoadedMessages(channel: CopilotChannel, lookup: CardLookupResult) {
  const latestValidation = lookup.summary.lastValidation
    ? `${formatDateTime(lookup.summary.lastValidation)} em ${lookup.summary.lastLocation}`
    : 'sem validacao recente';
  const recentTransactions = lookup.transactions.slice(0, 3);
  const transactionsText = recentTransactions.length
    ? recentTransactions
        .map(
          (transaction, index) =>
            `${index + 1}. ${formatDateTime(transaction.dateTime)} - ${transaction.locationLabel} - ${transaction.transportType || 'transporte nao informado'}`,
        )
        .join('\n')
    : 'Nenhuma transacao recente encontrada.';

  return [
    createMessage(
      channel,
      'assistant',
      `Cadastro localizado com sucesso.\n\nStatus do cartao: ${lookup.summary.status}\nSaldo estimado: ${formatCurrency(
        lookup.summary.estimatedBalance,
      )}\nRisco: ${lookup.summary.riskScore}\nUltima validacao: ${latestValidation}\n\nUltimas 3 transacoes:\n${transactionsText}\n\nMe diga com qual dessas situacoes voce precisa de ajuda.`,
      lookup.summary.status === 'bloqueado' ? 'danger' : lookup.summary.status === 'atencao' ? 'warning' : 'success',
      ['Bilhete nao funcionou', 'Quero reembolso', 'Consultar uso', 'Suspeita de fraude'],
    ),
  ];
}

function initialPrompt(channel: CopilotChannel) {
  const channelLabel = channel === 'telegram' ? 'Telegram simulado' : 'Web';
  return createMessage(
    channel,
    'assistant',
    `Oi! Eu sou o Copilot de Atendimento Riocard no canal ${channelLabel}. Para iniciar o atendimento, por favor informe seu nome completo.`,
    'info',
  );
}

export function createInitialSession(channel: CopilotChannel): CopilotSessionState {
  return {
    channel,
    customer: {
      fullName: null,
      cpf: null,
      address: null,
    },
    cardId: null,
    lookup: null,
    selectedTransactionId: null,
    awaitingField: 'full_name',
    pendingIntent: null,
    handoffRecommended: false,
    lastIntent: null,
    lastRoute: 'coleta_dados',
  };
}

export function createInitialMessages(channel: CopilotChannel) {
  return [initialPrompt(channel)];
}

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '');
}

function formatCpf(value: string) {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) {
    return value;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function isValidCpf(value: string) {
  return normalizeCpf(value).length === 11;
}

function buildCustomerConfirmation(channel: CopilotChannel, session: CopilotSessionState) {
  return createMessage(
    channel,
    'assistant',
    `Obrigada. Confirmei os dados iniciais:\n\nNome: ${session.customer.fullName}\nCPF: ${session.customer.cpf}\nEndereco: ${session.customer.address}\n\nAgora informe o numero do cartao para eu consultar a base carregada.`,
    'info',
  );
}

function explainAlertForCustomer(lookup: CardLookupResult) {
  const topAlert = lookup.alerts[0];

  if (!topAlert) {
    return 'Nao encontrei nenhum alerta critico no momento.';
  }

  if (topAlert.fraudType === 'deslocamento impossivel') {
    return 'Houve dois usos do cartao em um intervalo de tempo considerado impossivel para deslocamento normal.';
  }

  if (topAlert.fraudType === 'compartilhamento') {
    return 'Identifiquei usos muito proximos entre si, em locais diferentes ou em sequencia incomum, o que sugere compartilhamento do cartao.';
  }

  if (topAlert.fraudType === 'revenda' || topAlert.fraudType === 'multi validacao sequencial') {
    return 'Foram detectadas varias validacoes seguidas em um curto espaco de tempo, o que pode indicar suspeita de revenda.';
  }

  if (topAlert.fraudType === 'uso abusivo') {
    return 'O cartao foi usado muitas vezes acima do comportamento esperado para um mesmo dia.';
  }

  if (topAlert.fraudType === 'clonagem de cartao') {
    return 'O padrao observado e compativel com suspeita de clonagem do cartao.';
  }

  if (topAlert.fraudType === 'uso gratuidade indevida') {
    return 'Foi identificado um padrao de uso que pode indicar utilizacao indevida do beneficio do cartao.';
  }

  return topAlert.reason;
}

function explainAlertsForCustomer(lookup: CardLookupResult) {
  return lookup.alerts.slice(0, 3).map((alert) => {
    if (alert.fraudType === 'deslocamento impossivel') {
      return 'Houve dois usos em locais diferentes em um intervalo curto demais para um deslocamento real.';
    }

    if (alert.fraudType === 'compartilhamento') {
      return 'O mesmo cartao apareceu em usos muito proximos, com comportamento que sugere compartilhamento.';
    }

    if (alert.fraudType === 'revenda' || alert.fraudType === 'multi validacao sequencial') {
      return 'Foram detectadas varias validacoes consecutivas em pouco tempo, indicando suspeita de revenda.';
    }

    if (alert.fraudType === 'uso abusivo') {
      return 'O cartao teve um volume de uso acima do normal para o perfil observado.';
    }

    if (alert.fraudType === 'clonagem de cartao') {
      return 'O comportamento encontrado pode indicar clonagem do cartao.';
    }

    if (alert.fraudType === 'uso gratuidade indevida') {
      return 'Foi visto um padrao de uso que pode indicar uso indevido do beneficio.';
    }

    return alert.reason;
  });
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getRecentTransactions(lookup: CardLookupResult) {
  return lookup.transactions.slice(0, 3);
}

function parseTransactionSelection(input: string, lookup: CardLookupResult) {
  const normalized = normalizeText(input);
  const match = normalized.match(/transa(?:c|ç)(?:a|ã)o\s*(\d+)/i) ?? normalized.match(/^(\d)$/);

  if (!match) {
    return null;
  }

  const position = Number(match[1]);
  if (!Number.isInteger(position) || position < 1) {
    return null;
  }

  return getRecentTransactions(lookup)[position - 1] ?? null;
}

function describeTransaction(transaction: TransactionRecord) {
  return [
    `Data e hora: ${formatDateTime(transaction.dateTime)}`,
    `Local: ${transaction.locationLabel}`,
    `Transporte: ${transaction.transportType || 'nao informado'}`,
    `Status: ${transaction.status || 'nao informado'}`,
    `Valor: ${transaction.amount !== null ? formatCurrency(transaction.amount) : 'nao informado'}`,
  ].join('\n');
}

function buildTransactionConfirmationMessage(channel: CopilotChannel, transaction: TransactionRecord) {
  return createMessage(
    channel,
    'assistant',
    `Encontrei a transacao selecionada. Confira se e esta mesma:\n\n${describeTransaction(
      transaction,
    )}\n\nPosso seguir com o atendimento para essa transacao?`,
    'info',
    ['Sim, e essa', 'Nao, quero outra', 'Quero reembolso', 'Bilhete nao funcionou'],
  );
}

function getIssueCause(lookup: CardLookupResult) {
  const latestFailure = lookup.failures[0];
  const latestFare = lookup.transactions[0]?.amount ?? 4.7;
  const plainAlertReason = explainAlertForCustomer(lookup);

  if (lookup.summary.status === 'bloqueado' || latestFailure?.type === 'bloqueio') {
    return {
      code: 'bloqueio',
      message:
        `Encontrei indicios de bloqueio preventivo no cartao. Em linguagem simples: ${plainAlertReason.toLowerCase()}`,
      solution: 'Minha recomendacao e nao insistir na validacao e seguir para atendimento humano para desbloqueio seguro.',
      tone: 'danger' as const,
    };
  }

  if (lookup.summary.estimatedBalance < latestFare || latestFailure?.type === 'saldo_insuficiente') {
    return {
      code: 'saldo',
      message:
        'O motivo mais provavel para a falha e saldo insuficiente no momento da tentativa, considerando o saldo estimado e a tarifa recente.',
      solution: 'Vale recarregar o cartao e tentar novamente. Se houve cobranca indevida, eu tambem posso avaliar reembolso.',
      tone: 'warning' as const,
    };
  }

  return {
    code: 'leitura',
    message:
      'Nao vi bloqueio ativo nem saldo claramente insuficiente. A causa mais provavel e uma falha pontual de leitura no validador.',
    solution: 'Sugiro tentar novamente em outro equipamento. Se a falha persistir, posso encaminhar seu caso para atendimento.',
    tone: 'warning' as const,
  };
}

function buildUsageHistoryMessage(channel: CopilotChannel, lookup: CardLookupResult) {
  const latestTransactions = lookup.transactions.slice(0, 5);

  const lines = latestTransactions.length
    ? latestTransactions
        .map(
          (transaction, index) =>
            `${index + 1}. ${formatDateTime(transaction.dateTime)} - ${transaction.locationLabel} - ${transaction.transportType || 'transporte nao informado'}`,
        )
        .join('\n')
    : 'Nenhuma transacao recente foi encontrada para esse cartao.';

  return createMessage(
    channel,
    'assistant',
    `Aqui estao as ultimas utilizacoes do cartao ${lookup.summary.maskedCardId}:\n\n${lines}`,
    'info',
    ['Quero reembolso', 'Meu bilhete nao funcionou', 'Falar com atendente'],
  );
}

function resolveRefund(
  channel: CopilotChannel,
  lookup: CardLookupResult,
  failure: CardFailure | null,
): CopilotTurnResult['messages'] {
  if (!failure) {
    return [
      createMessage(
        channel,
        'assistant',
        'Nao encontrei uma falha recente elegivel para reembolso. Se voce quiser, me diga a data aproximada da ocorrencia ou eu encaminho para um atendente.',
        'warning',
        ['Falar com atendente', 'Consultar ultimas transacoes'],
      ),
    ];
  }

  if (!failure.eligibleForRefund) {
    return [
      createMessage(
        channel,
        'assistant',
        `Verifiquei a tentativa de ${formatDateTime(
          failure.dateTime,
        )}. No momento ela nao e elegivel para reembolso porque o motivo mais provavel foi ${failure.type.replaceAll('_', ' ')}.`,
        'warning',
        ['Meu bilhete nao funcionou', 'Falar com atendente'],
      ),
    ];
  }

  const protocol = buildReferenceProtocol('RMB', lookup.cardId);

  return [
    createMessage(
      channel,
      'assistant',
      `Sua solicitacao de reembolso foi simulada com sucesso para a ocorrencia de ${formatDateTime(
        failure.dateTime,
      )}.\n\nProtocolo: ${protocol}\nMotivo registrado: ${failure.summary}`,
      'success',
      ['Consultar ultimas transacoes', 'Falar com atendente'],
    ),
  ];
}

function buildFraudMessage(channel: CopilotChannel, lookup: CardLookupResult, handoff = false) {
  const alertLines = explainAlertsForCustomer(lookup).map((reason) => `- ${reason}`);
  const content = alertLines.length
    ? `Identifiquei atividades incomuns no cartao:\n${alertLines.join(
        '\n',
      )}\n\nMinha recomendacao e bloquear o cartao e avaliar emissao de segunda via para sua seguranca.`
    : `Nao encontrei fraude evidente na base atual para o cartao ${lookup.summary.maskedCardId}, mas posso acompanhar ou encaminhar para validacao humana.`;

  return createMessage(
    channel,
    'assistant',
    content,
    handoff ? 'danger' : 'warning',
    handoff ? ['Quero segunda via', 'Status do atendimento'] : ['Bloquear cartao', 'Falar com atendente'],
  );
}

function handoffMessage(channel: CopilotChannel, lookup: CardLookupResult | null, reason: string) {
  const protocol = buildReferenceProtocol('ATD', lookup?.cardId ?? '0000');
  const cardLabel = lookup ? lookup.summary.maskedCardId : 'cartao informado';

  return createMessage(
    channel,
    'assistant',
    `Vou encaminhar o atendimento do ${cardLabel} para uma pessoa da equipe humana.\n\nMotivo: ${reason}\nProtocolo: ${protocol}\nEnquanto isso, evite novas tentativas se houver suspeita de fraude ou bloqueio.`,
    'danger',
    ['Status do atendimento', 'Consultar ultimas transacoes'],
  );
}

function handleRefundTargetReply(channel: CopilotChannel, lookup: CardLookupResult, input: string) {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('atendente') || normalized.includes('humano')) {
    return {
      messages: [handoffMessage(channel, lookup, 'Usuario pediu ajuda humana durante a triagem de reembolso.')],
      nextAwaiting: null,
      route: 'humano' as const,
      handoffRecommended: true,
    };
  }

  const matchedFailure =
    (normalized.includes('ultima') || normalized.includes('mais recente') ? lookup.failures[0] : null) ??
    lookup.failures.find((failure) => {
      const shortDate = new Intl.DateTimeFormat('pt-BR').format(new Date(failure.dateTime));
      return normalized.includes(shortDate);
    }) ??
    null;

  if (!matchedFailure) {
    return {
      messages: [
        createMessage(
          channel,
          'assistant',
          'Ainda preciso identificar qual tentativa voce quer revisar. Pode responder "ultima tentativa" ou informar a data aproximada.',
          'warning',
          ['Ultima tentativa', 'Falar com atendente'],
        ),
      ],
      nextAwaiting: 'refund_target' as const,
      route: 'coleta_dados' as const,
      handoffRecommended: false,
    };
  }

  return {
    messages: resolveRefund(channel, lookup, matchedFailure),
    nextAwaiting: null,
    route: 'automatico' as const,
    handoffRecommended: false,
  };
}

function answerResolvedIntent(channel: CopilotChannel, intent: CopilotIntent, lookup: CardLookupResult) {
  if (intent === 'usage_history') {
    return {
      messages: [buildUsageHistoryMessage(channel, lookup)],
      awaitingField: null,
      route: 'automatico' as const,
      handoffRecommended: false,
    };
  }

  if (intent === 'report_issue') {
    const issue = getIssueCause(lookup);

    return {
      messages: [
        createMessage(
          channel,
          'assistant',
          `${issue.message}\n\nUltima validacao encontrada: ${
            lookup.summary.lastValidation
              ? `${formatDateTime(lookup.summary.lastValidation)} em ${lookup.summary.lastLocation}`
              : 'nao identificada'
          }.\n\n${issue.solution}`,
          issue.tone,
          ['Quero reembolso', 'Falar com atendente', 'Consultar ultimas transacoes'],
        ),
      ],
      awaitingField: null,
      route: 'automatico' as const,
      handoffRecommended: false,
    };
  }

  if (intent === 'refund') {
    if (lookup.failures.length > 1) {
      return {
        messages: [
          createMessage(
            channel,
            'assistant',
            `Encontrei ${lookup.failures.length} falhas recentes nesse cartao. Voce quer revisar a ultima tentativa ou prefere informar a data aproximada da ocorrencia?`,
            'info',
            ['Ultima tentativa', 'Falar com atendente'],
          ),
        ],
        awaitingField: 'refund_target' as const,
        route: 'coleta_dados' as const,
        handoffRecommended: false,
      };
    }

    return {
      messages: resolveRefund(channel, lookup, lookup.failures[0] ?? null),
      awaitingField: null,
      route: 'automatico' as const,
      handoffRecommended: false,
    };
  }

  if (intent === 'fraud_suspicion') {
    return {
      messages: [buildFraudMessage(channel, lookup)],
      awaitingField: null,
      route: 'automatico' as const,
      handoffRecommended: false,
    };
  }

  if (intent === 'faq') {
    return {
      messages: [
        createMessage(
          channel,
          'assistant',
          'Posso ajudar com falha de bilhete, reembolso, consulta de uso e suspeita de fraude. Vou sempre explicar o motivo de forma simples, sem termos tecnicos, para voce entender o que aconteceu.',
          'info',
          ['Bilhete nao funcionou', 'Quero reembolso', 'Consultar uso', 'Suspeita de fraude'],
        ),
      ],
      awaitingField: null,
      route: 'automatico' as const,
      handoffRecommended: false,
    };
  }

  return {
    messages: [
      createMessage(
        channel,
        'assistant',
        'Quero ter certeza de que entendi direito. Voce precisa de ajuda com falha no bilhete, reembolso, historico de uso ou suspeita de fraude? Se houver alerta, eu vou explicar o motivo de forma simples.',
        'info',
        ['Bilhete nao funcionou', 'Quero reembolso', 'Consultar uso', 'Suspeita de fraude'],
      ),
    ],
    awaitingField: null,
    route: 'coleta_dados' as const,
    handoffRecommended: false,
  };
}

export function refreshSessionLookup(session: CopilotSessionState, dataset: UploadedDataset): CopilotSessionState {
  if (!session.cardId) {
    return session;
  }

  const refreshedLookup = lookupCard(dataset, session.cardId);

  return {
    ...session,
    lookup: refreshedLookup,
    selectedTransactionId:
      session.selectedTransactionId &&
      refreshedLookup?.transactions.some((transaction) => transaction.id === session.selectedTransactionId)
        ? session.selectedTransactionId
        : null,
    handoffRecommended: session.handoffRecommended || refreshedLookup?.summary.status === 'bloqueado',
  };
}

export function handleCopilotTurn({ channel, input, session, dataset }: CopilotTurnParams): CopilotTurnResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { session, messages: [] };
  }

  if (session.awaitingField === 'full_name') {
    return {
      session: {
        ...session,
        customer: {
          ...session.customer,
          fullName: trimmed,
        },
        awaitingField: 'cpf',
        lastRoute: 'coleta_dados',
      },
      messages: [
        createMessage(
          channel,
          'assistant',
          'Obrigada. Agora informe seu CPF.',
          'info',
        ),
      ],
    };
  }

  if (session.awaitingField === 'cpf') {
    if (!isValidCpf(trimmed)) {
      return {
        session,
        messages: [
          createMessage(
            channel,
            'assistant',
            'Nao consegui validar o CPF. Envie os 11 digitos ou o CPF formatado.',
            'warning',
          ),
        ],
      };
    }

    return {
      session: {
        ...session,
        customer: {
          ...session.customer,
          cpf: formatCpf(trimmed),
        },
        awaitingField: 'address',
        lastRoute: 'coleta_dados',
      },
      messages: [
        createMessage(
          channel,
          'assistant',
          'Perfeito. Agora informe seu endereco atual.',
          'info',
        ),
      ],
    };
  }

  if (session.awaitingField === 'address') {
    const nextSession = {
      ...session,
      customer: {
        ...session.customer,
        address: trimmed,
      },
      awaitingField: 'card_id' as const,
      lastRoute: 'coleta_dados' as const,
    };

    return {
      session: nextSession,
      messages: [buildCustomerConfirmation(channel, nextSession)],
    };
  }

  if (session.awaitingField === 'refund_target' && session.lookup) {
    const refundReply = handleRefundTargetReply(channel, session.lookup, trimmed);

    return {
      session: {
        ...session,
        awaitingField: refundReply.nextAwaiting,
        pendingIntent: refundReply.nextAwaiting ? 'refund' : null,
        handoffRecommended: refundReply.handoffRecommended,
        lastRoute: refundReply.route,
        lastIntent: 'refund',
      },
      messages: refundReply.messages,
    };
  }

  if (session.awaitingField === 'transaction_confirmation' && session.lookup && session.selectedTransactionId) {
    const normalized = normalizeText(trimmed);

    if (normalized.includes('sim')) {
      return {
        session: {
          ...session,
          awaitingField: null,
          lastRoute: 'coleta_dados',
        },
        messages: [
          createMessage(
            channel,
            'assistant',
            'Perfeito. Me diga agora se voce precisa de ajuda com falha no uso, reembolso, consulta ou suspeita de fraude nessa transacao.',
            'info',
            ['Bilhete nao funcionou', 'Quero reembolso', 'Consultar uso', 'Suspeita de fraude'],
          ),
        ],
      };
    }

    if (normalized.includes('nao')) {
      return {
        session: {
          ...session,
          awaitingField: null,
          selectedTransactionId: null,
          lastRoute: 'coleta_dados',
        },
        messages: [
          createMessage(
            channel,
            'assistant',
            'Sem problema. Pode me dizer por exemplo "transacao 1", "transacao 2" ou "transacao 3" para eu confirmar a operacao correta.',
            'info',
          ),
        ],
      };
    }
  }

  if (session.awaitingField === 'card_id' || !session.lookup) {
    const normalizedCardId = normalizeCardInput(trimmed);
    const directLookup = lookupCard(dataset, normalizedCardId);

    if (directLookup) {
      return {
        session: {
          ...session,
          cardId: directLookup.cardId,
          lookup: directLookup,
          selectedTransactionId: null,
          awaitingField: null,
          pendingIntent: null,
          handoffRecommended: directLookup.summary.status === 'bloqueado',
          lastRoute: 'automatico',
        },
        messages: buildLookupLoadedMessages(channel, directLookup),
      };
    }

    if (!isValidCardFormat(trimmed)) {
      return {
        session,
        messages: [
          createMessage(
            channel,
            'assistant',
            'Nao consegui identificar um numero de cartao valido na mensagem. Envie o numero exatamente como ele aparece no cadastro ou na base carregada.',
            'warning',
          ),
        ],
      };
    }

    const lookup = lookupCard(dataset, normalizedCardId);

    if (!lookup) {
      return {
        session,
        messages: [
          createMessage(
            channel,
            'assistant',
            `Nao encontrei esse cartao na base atual. Confira o numero informado ou carregue uma planilha que contenha esse cadastro.`,
            'warning',
            ['Tentar novamente', 'Falar com atendente'],
          ),
        ],
      };
    }

    return {
      session: {
        ...session,
        cardId: lookup.cardId,
        lookup,
        selectedTransactionId: null,
        awaitingField: null,
        pendingIntent: null,
        handoffRecommended: lookup.summary.status === 'bloqueado',
        lastRoute: 'automatico',
      },
      messages: buildLookupLoadedMessages(channel, lookup),
    };
  }

  if (isValidCardFormat(trimmed)) {
    const lookup = lookupCard(dataset, normalizeCardInput(trimmed));

    if (lookup) {
      return {
        session: {
          ...session,
          cardId: lookup.cardId,
          lookup,
          selectedTransactionId: null,
          awaitingField: null,
          pendingIntent: null,
          handoffRecommended: lookup.summary.status === 'bloqueado',
          lastRoute: 'automatico',
        },
        messages: buildLookupLoadedMessages(channel, lookup),
      };
    }
  }

  if (session.lookup) {
    const selectedTransaction = parseTransactionSelection(trimmed, session.lookup);

    if (selectedTransaction) {
      return {
        session: {
          ...session,
          selectedTransactionId: selectedTransaction.id,
          awaitingField: 'transaction_confirmation',
          lastRoute: 'coleta_dados',
        },
        messages: [buildTransactionConfirmationMessage(channel, selectedTransaction)],
      };
    }
  }

  const intent = interpretIntent(trimmed);
  const decision = decideCopilotAction({
    intent,
    lookup: session.lookup,
    input: trimmed,
    session,
  });

  if (decision === 'handoff') {
    return {
      session: {
        ...session,
        awaitingField: null,
        pendingIntent: null,
        handoffRecommended: true,
        lastIntent: intent,
        lastRoute: 'humano',
      },
      messages: [
        intent === 'fraud_suspicion'
          ? buildFraudMessage(channel, session.lookup, true)
          : handoffMessage(channel, session.lookup, 'Caso complexo, com risco elevado ou pedido explicito do usuario.'),
      ],
    };
  }

  if (decision === 'ask_info') {
    const message =
      intent === 'refund'
        ? createMessage(
            channel,
            'assistant',
            'Para avaliar reembolso, preciso localizar uma tentativa com problema. Se quiser, me diga a data aproximada da falha ou eu posso te encaminhar para atendimento humano.',
            'info',
            ['Ultima tentativa', 'Falar com atendente'],
          )
        : createMessage(
            channel,
            'assistant',
            'Me conte um pouco mais para eu seguir. Se voce nao reconhece esse uso, tambem posso tratar isso como suspeita de fraude e te explicar o motivo de forma simples.',
            'info',
            ['Bilhete nao funcionou', 'Quero reembolso', 'Consultar uso', 'Suspeita de fraude'],
          );

    return {
      session: {
        ...session,
        awaitingField: intent === 'refund' ? 'refund_target' : null,
        pendingIntent: intent === 'refund' ? 'refund' : null,
        handoffRecommended: false,
        lastIntent: intent,
        lastRoute: 'coleta_dados',
      },
      messages: [message],
    };
  }

  const resolution = answerResolvedIntent(channel, intent, session.lookup);

  return {
    session: {
      ...session,
      awaitingField: resolution.awaitingField,
      pendingIntent: resolution.awaitingField ? intent : null,
      handoffRecommended: resolution.handoffRecommended,
      lastIntent: intent,
      lastRoute: resolution.route,
    },
    messages: resolution.messages,
  };
}
