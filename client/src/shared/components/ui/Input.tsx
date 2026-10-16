import type { InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "min-w-0 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/10",
      className,
    )}
    {...props}
  />
);
