export const PageHeader = ({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}): React.ReactElement => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{eyebrow}</p>
      )}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
    </div>
    {action}
  </div>
);
