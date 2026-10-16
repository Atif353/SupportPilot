import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import { LoaderCircle } from "lucide-react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  busy?: boolean;
};

export const Button = ({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  busy = false,
  disabled,
  children,
  ...props
}: ButtonProps) => (
  <button
    className={cn(
      "inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
      size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
      variant === "primary" && "bg-accent text-accentForeground shadow-sm hover:bg-accentStrong",
      variant === "secondary" &&
        "border border-border bg-surface shadow-sm hover:border-accent/40 hover:bg-accentSoft",
      variant === "ghost" && "text-muted hover:bg-mutedSurface hover:text-foreground",
      variant === "danger" && "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
      className,
    )}
    {...props}
    type={type}
    disabled={disabled || busy}
    aria-busy={busy}
  >
    {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
    {children}
  </button>
);
