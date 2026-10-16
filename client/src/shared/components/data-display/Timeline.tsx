export const Timeline = ({
  items,
}: {
  items: { title: string; description?: string; date?: string }[];
}): React.ReactElement => (
  <div className="space-y-5">
    {items.map((item) => (
      <div className="flex gap-3" key={`${item.title}-${item.date}`}>
        <div className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
        <div>
          <p className="font-medium">{item.title}</p>
          {item.description && <p className="text-sm text-muted">{item.description}</p>}
          {item.date && <p className="mt-1 text-xs text-muted">{item.date}</p>}
        </div>
      </div>
    ))}
  </div>
);
