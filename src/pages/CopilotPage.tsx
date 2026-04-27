import clsx from 'clsx';
import { Bot, MessageCircleMore, Send, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ChatWindow } from '@/components/ChatWindow';
import { CopilotCardSummary } from '@/components/CopilotCardSummary';
import { InputBox } from '@/components/InputBox';
import { PageHeader } from '@/components/PageHeader';
import { useMonitoringData } from '@/context/MonitoringDataContext';
import { createInitialMessages, createInitialSession, handleCopilotTurn, refreshSessionLookup } from '@/services/copilotService';
import type { CopilotChannel, CopilotMessage, CopilotSessionState } from '@/types/copilot';

function formatRelativeRoute(route: CopilotSessionState['lastRoute']) {
  if (route === 'automatico') {
    return 'Resolvido automaticamente';
  }

  if (route === 'humano') {
    return 'Encaminhado para humano';
  }

  return 'Coletando informacoes';
}

export function CopilotPage() {
  const { dataset } = useMonitoringData();
  const [activeChannel, setActiveChannel] = useState<CopilotChannel>('web');
  const [loading, setLoading] = useState(false);
  const [messagesByChannel, setMessagesByChannel] = useState<Record<CopilotChannel, CopilotMessage[]>>({
    web: createInitialMessages('web'),
    telegram: createInitialMessages('telegram'),
  });
  const [sessions, setSessions] = useState<Record<CopilotChannel, CopilotSessionState>>({
    web: createInitialSession('web'),
    telegram: createInitialSession('telegram'),
  });

  useEffect(() => {
    setSessions((current) => ({
      web: refreshSessionLookup(current.web, dataset),
      telegram: refreshSessionLookup(current.telegram, dataset),
    }));
  }, [dataset]);

  const activeMessages = messagesByChannel[activeChannel];
  const activeSession = sessions[activeChannel];
  const lastAssistantMessageWithSuggestions = [...activeMessages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.suggestions?.length);

  const quickActions = useMemo(
    () => {
      if (activeSession.awaitingField) {
        return [];
      }

      return (
        lastAssistantMessageWithSuggestions?.suggestions ?? [
          'Bilhete nao funcionou',
          'Quero reembolso',
          'Consultar uso',
          'Falar com atendente',
        ]
      );
    },
    [activeSession.awaitingField, lastAssistantMessageWithSuggestions],
  );

  const sendMessage = (value: string) => {
    if (loading) {
      return;
    }

    if (typeof value !== 'string') {
      return;
    }

    const nextValue = value.trim();

    if (!nextValue) {
      return;
    }

    const userMessage: CopilotMessage = {
      id: `${activeChannel}-user-${Date.now()}`,
      role: 'user',
      content: nextValue,
      tone: 'default',
      timestamp: new Date().toISOString(),
      channel: activeChannel,
    };

    setMessagesByChannel((current) => ({
      ...current,
      [activeChannel]: [...current[activeChannel], userMessage],
    }));
    setLoading(true);

    window.setTimeout(() => {
      const result = handleCopilotTurn({
        channel: activeChannel,
        input: nextValue,
        session: sessions[activeChannel],
        dataset,
      });

      setSessions((current) => ({
        ...current,
        [activeChannel]: result.session,
      }));
      setMessagesByChannel((current) => ({
        ...current,
        [activeChannel]: [...current[activeChannel], ...result.messages],
      }));
      setLoading(false);
    }, 320);
  };

  return (
    <section className="space-y-8">
      <div className="rounded-[28px] border border-line bg-gradient-to-r from-[#eef6ff] via-white to-[#fff8df] p-6">
        <PageHeader
          eyebrow="Copilot"
          title="Copilot de Atendimento Riocard"
          description="Um assistente conversacional para web e Telegram simulado, com consulta ao historico do cartao, analise de risco e encaminhamento inteligente para atendimento humano."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <section className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-panel">Aba Copilot</h2>
              <p className="text-sm text-slate-600">Chat estilo atendimento digital, com o mesmo fluxo para Web e Telegram simulado.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: 'web', label: 'Web', icon: MessageCircleMore },
                { id: 'telegram', label: 'Telegram simulado', icon: Send },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveChannel(id as CopilotChannel)}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition',
                    activeChannel === id
                      ? 'border-panel bg-panel text-white'
                      : 'border-line bg-[#f8fbff] text-panel hover:bg-white',
                  )}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ChatWindow messages={activeMessages} loading={loading} onSuggestionClick={sendMessage} />
          <InputBox
            onSend={sendMessage}
            loading={loading}
            placeholder={
              activeSession.awaitingField === 'full_name'
                ? 'Digite seu nome completo'
                : activeSession.awaitingField === 'cpf'
                  ? 'Digite seu CPF'
                  : activeSession.awaitingField === 'address'
                    ? 'Digite seu endereco atual'
                    : activeSession.awaitingField === 'card_id'
                      ? 'Digite o numero do cartao'
                      : 'Descreva seu problema ou sua duvida'
            }
            quickActions={quickActions}
          />
        </section>

        <div className="space-y-6">
          <CopilotCardSummary lookup={activeSession.lookup} />

          <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-[#b7d6f5] bg-[#eef6ff] p-3 text-accent">
                {activeChannel === 'telegram' ? <Smartphone size={20} /> : <Bot size={20} />}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-panel">Roteamento do atendimento</h2>
                <p className="text-sm text-slate-600">Estrutura pronta para canal web e integracao Telegram simulada com o mesmo motor de decisao.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Canal ativo</p>
                <p className="mt-2 text-xl font-semibold text-panel">{activeChannel === 'telegram' ? 'Telegram' : 'Web'}</p>
              </div>
              <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status da conversa</p>
                <p className="mt-2 text-xl font-semibold text-panel">{formatRelativeRoute(activeSession.lastRoute)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-[#f8fbff] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Payload do canal</p>
              <pre className="mt-3 overflow-x-auto text-xs leading-6 text-slate-700">
{`{
  "channel": "${activeChannel}",
  "card": "${activeSession.lookup?.summary.maskedCardId ?? 'aguardando cartao'}",
  "route": "${activeSession.lastRoute}",
  "handoffRecommended": ${activeSession.handoffRecommended},
  "lastIntent": "${activeSession.lastIntent ?? 'none'}"
}`}
              </pre>
            </div>
          </article>

          <article className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-panel">Casos tratados automaticamente</h2>
                <p className="text-sm text-slate-600">O Copilot foi configurado para resolver fluxos comuns antes de escalar para um atendente.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-700">
              <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">Bilhete nao funcionou: consulta ultima validacao, saldo estimado, bloqueio e sugere a melhor acao.</div>
              <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">Reembolso: identifica falha elegivel e simula abertura de protocolo quando possivel.</div>
              <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">Consulta de uso: mostra transacoes recentes com local e horario, sem expor dados sensiveis completos.</div>
              <div className="rounded-2xl border border-line bg-[#f8fbff] p-4">Fraude ou alto risco: sinaliza atividades incomuns e encaminha para atendimento humano quando necessario.</div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
