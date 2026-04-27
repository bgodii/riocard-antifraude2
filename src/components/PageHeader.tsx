interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="space-y-3">
      <span className="inline-flex rounded-full border border-[#b7d6f5] bg-[#eef6ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
        {eyebrow}
      </span>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-panel md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">{description}</p>
      </div>
    </div>
  );
}
