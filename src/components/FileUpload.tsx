import { FileSpreadsheet, LoaderCircle, UploadCloud } from 'lucide-react';

interface FileUploadProps {
  onFileSelected: (file: File) => Promise<void>;
  onUseDemo: () => void;
  loading: boolean;
}

export function FileUpload({ onFileSelected, onUseDemo, loading }: FileUploadProps) {
  return (
    <div>
      <div className="rounded-[28px] border border-dashed border-[#b7d6f5] bg-[#f8fbff] p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-[#b7d6f5] bg-white p-3 text-accent">
            <UploadCloud size={22} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-panel">Upload de planilha</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Aceita arquivos <span className="font-semibold text-panel">.csv</span>, <span className="font-semibold text-panel">.xls</span> e{' '}
              <span className="font-semibold text-panel">.xlsx</span>. O sistema tenta mapear automaticamente nomes diferentes de colunas.
            </p>
          </div>
        </div>

        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-[26px] border border-line bg-white px-5 py-10 text-center transition hover:border-accent hover:bg-[#f7fbff]">
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onFileSelected(file);
              }
              event.currentTarget.value = '';
            }}
          />

          {loading ? <LoaderCircle className="animate-spin text-accent" size={28} /> : <FileSpreadsheet size={28} className="text-accent" />}
          <p className="mt-4 text-base font-medium text-panel">{loading ? 'Processando arquivo...' : 'Clique para selecionar a planilha'}</p>
          <p className="mt-2 text-sm text-slate-500">CSV para cargas rapidas e XLSX para planilhas completas.</p>
        </label>
      </div>

      <button
        type="button"
        onClick={onUseDemo}
        disabled={loading}
        className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[#ffd768] bg-[#fff8df] px-4 py-3 text-sm font-medium text-panel transition hover:bg-[#fff2b8] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FileSpreadsheet size={16} />
        Carregar base demonstrativa
      </button>
    </div>
  );
}
