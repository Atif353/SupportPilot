import { Fragment } from "react";

const inline = (text: string): React.ReactNode[] =>
  text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );

/** Renders paragraphs, bullet lists and **bold** without ever injecting raw HTML. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: { type: "p" | "ul"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const bullet = /^\s*[*-]\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.type === "ul") last.lines.push(bullet[1] ?? "");
      else blocks.push({ type: "ul", lines: [bullet[1] ?? ""] });
    } else blocks.push({ type: "p", lines: [line.replace(/^#+\s+/, "")] });
  }
  return (
    <div className={className}>
      {blocks.map((block, index) =>
        block.type === "ul" ? (
          <ul key={index} className="my-1.5 list-disc space-y-1 pl-5">
            {block.lines.map((line, item) => (
              <li key={item}>{inline(line)}</li>
            ))}
          </ul>
        ) : (
          <p key={index} className="whitespace-pre-wrap [&:not(:first-child)]:mt-2">
            {inline(block.lines[0] ?? "")}
          </p>
        ),
      )}
    </div>
  );
}
