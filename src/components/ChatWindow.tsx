import { useEffect, useRef } from 'react';
import { LoaderCircle, MessageCircleMore } from 'lucide-react';
import { MessageBubble } from '@/components/MessageBubble';
import type { CopilotMessage } from '@/types/copilot';

interface ChatWindowProps {
  messages: CopilotMessage[];
  loading: boolean;
  onSuggestionClick: (value: string) => void;
}

export function ChatWindow({ messages, loading, onSuggestionClick }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="rounded-[28px] border border-line bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl border border-[#b7d6f5] bg-white p-3 text-accent">
          <MessageCircleMore size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-panel">Conversa</h2>
          <p className="text-sm text-slate-600">Atendimento em linguagem natural com historico visivel e respostas orientadas por regra.</p>
        </div>
      </div>

      <div className="h-[540px] overflow-y-auto rounded-[24px] border border-line bg-white px-4 py-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} onSuggestionClick={onSuggestionClick} />
          ))}

          {loading ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#b7d6f5] bg-[#eef6ff] px-4 py-2 text-sm text-panel">
                <LoaderCircle size={14} className="animate-spin" />
                Copilot digitando...
              </div>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
