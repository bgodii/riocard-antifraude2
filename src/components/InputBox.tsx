import { SendHorizonal, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface InputBoxProps {
  onSend: (value: string) => void;
  loading: boolean;
  placeholder?: string;
  quickActions: string[];
}

export function InputBox({ onSend, loading, placeholder, quickActions }: InputBoxProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const nextValue = value.trim();
    if (!nextValue || loading) {
      return;
    }

    onSend(nextValue);
    setValue('');
  };

  return (
    <div className="rounded-[28px] border border-line bg-white p-4 shadow-sm">
      {quickActions.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onSend(action)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-[#b7d6f5] bg-[#eef6ff] px-3 py-2 text-xs font-medium text-panel transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles size={12} />
              {action}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-3">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? 'Digite sua mensagem'}
          rows={3}
          className="min-h-[92px] flex-1 resize-none rounded-[24px] border border-line bg-[#f8fbff] px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent"
        />

        <button
          type="button"
          onClick={submit}
          disabled={loading || !value.trim()}
          className="inline-flex min-w-14 items-center justify-center self-end rounded-2xl bg-panel px-4 py-3 text-white transition hover:bg-panelSoft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizonal size={18} />
        </button>
      </div>
    </div>
  );
}
