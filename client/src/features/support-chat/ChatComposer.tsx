import type { FormEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "../../shared/components/ui/Button";

type ChatComposerProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export const ChatComposer = ({ value, disabled, onChange, onSubmit }: ChatComposerProps) => (
  <form className="border-t border-border bg-surface p-3 sm:p-4" onSubmit={onSubmit}>
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-background py-1.5 pl-4 pr-1.5 transition focus-within:border-accent focus-within:bg-surface focus-within:ring-4 focus-within:ring-accent/10">
      <input
        className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted/70 disabled:opacity-60"
        aria-label="Message"
        maxLength={4000}
        disabled={disabled}
        placeholder="Ask about an order, return, refund, or policy"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Button
        aria-label="Send message"
        title="Send message"
        disabled={disabled || !value.trim()}
        className="size-10 rounded-xl p-0"
        type="submit"
      >
        <SendHorizontal className="size-4" />
      </Button>
    </div>
    <p className="mt-2 px-1 text-[11px] text-muted">
      Answers use your account data and published policies. Account changes always need your
      confirmation.
    </p>
  </form>
);
