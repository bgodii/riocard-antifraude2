import clsx from 'clsx';
import { AlertTriangle, Bot, CheckCircle2, Info, Send, UserRound } from 'lucide-react';
import type { CopilotMessage } from '@/types/copilot';

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const toneStyles: Record<CopilotMessage['tone'], string> = {
  default: 'border-line bg-white text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-[#ffd768] bg-[#fff8df] text-slate-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-[#b7d6f5] bg-[#eef6ff] text-panel',
};

const userBubbleStyles = 'border-panel bg-panel text-white';

export function MessageBubble({ message, onSuggestionClick }: { message: CopilotMessage; onSuggestionClick: (value: string) => void }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[85%] space-y-2', isUser ? 'items-end' : 'items-start')}>
        <div className={clsx('flex items-center gap-2 text-xs text-slate-500', isUser ? 'justify-end' : 'justify-start')}>
          <span
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium',
              isUser ? 'bg-panel text-white' : 'bg-[#eef6ff] text-panel',
            )}
          >
            {isUser ? <UserRound size={12} /> : isSystem ? <Info size={12} /> : <Bot size={12} />}
            {isUser ? 'Voce' : isSystem ? 'Sistema' : message.channel === 'telegram' ? 'Copilot Telegram' : 'Copilot Web'}
          </span>
          <span>{formatTime(message.timestamp)}</span>
        </div>

        <div
          className={clsx(
            'rounded-[24px] border px-4 py-3 shadow-sm',
            isUser ? userBubbleStyles : toneStyles[message.tone],
            isUser && 'rounded-br-md',
            !isUser && 'rounded-bl-md',
          )}
        >
          <div className="whitespace-pre-line text-sm leading-6">{message.content}</div>
        </div>

        {message.suggestions?.length ? (
          <div className="flex flex-wrap gap-2">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick(suggestion)}
                className="inline-flex items-center gap-2 rounded-full border border-[#b7d6f5] bg-white px-3 py-2 text-xs font-medium text-panel transition hover:bg-[#eef6ff]"
              >
                {message.tone === 'danger' ? <AlertTriangle size={12} /> : message.tone === 'success' ? <CheckCircle2 size={12} /> : <Send size={12} />}
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
