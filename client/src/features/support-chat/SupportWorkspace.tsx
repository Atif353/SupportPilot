import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import {
  Bot,
  Headset,
  MessageSquarePlus,
  Package,
  RotateCcw,
  ArrowDown,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../shared/api/apiClient";
import { Button } from "../../shared/components/ui/Button";
import { FormError, Select } from "../../shared/components/ui/Field";
import { StatusBadge, statusTone } from "../../shared/components/data-display/StatusBadge";
import { cn } from "../../shared/utils/cn";
import { relativeTime } from "../../shared/utils/time";
import { ChatComposer } from "./ChatComposer";
import { RichText } from "./RichText";
import { useStickToBottom } from "./useStickToBottom";
import { useSupportChat } from "./useSupportChat";

const guardNotes: Record<string, string> = {
  payment_card: "Card details were removed for your safety",
  government_id: "ID numbers were removed for your safety",
  api_secret: "A secret was removed for your safety",
  unverified_action_claim: "Rewritten: no account changes were made",
  prompt_extraction: "Request declined by safety checks",
  prompt_injection: "Safety checks applied to your request",
  ungrounded_policy: "No published policy covers this",
  instruction_leak: "Request declined by safety checks",
};
const guardNote = (metadata?: Record<string, string>): string | undefined => {
  const first = metadata?.guardrails?.split(",").find((guard) => guardNotes[guard]);
  return first ? guardNotes[first] : undefined;
};

const suggestions = [
  { icon: Package, text: "Where is my latest order?" },
  { icon: ScrollText, text: "What is your return policy?" },
  { icon: RotateCcw, text: "I want to return an item" },
  { icon: Headset, text: "I want to talk to a human" },
];

const dotColor = {
  success: "bg-emerald-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-indigo-500",
  neutral: "bg-slate-300",
};

function Avatar({ kind }: { kind: string }) {
  const human = kind === "AGENT";
  const system = kind === "SYSTEM";
  const Icon = human ? UserRound : system ? ScrollText : Bot;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full",
        human ? "bg-emerald-100 text-emerald-700" : "bg-accentSoft text-accent",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function SupportWorkspace() {
  const chat = useSupportChat();
  const cache = useQueryClient();
  const [input, setInput] = useState("");
  const escalate = useMutation({
    mutationFn: () =>
      apiClient("/tools/escalateToHuman", {
        method: "POST",
        body: JSON.stringify({ conversationId: chat.activeId }),
      }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["conversations"] }),
  });
  const closed = ["RESOLVED", "CLOSED"].includes(chat.active?.status ?? "");
  const messageCount = chat.messages.data?.length ?? 0;
  const lastMessageId = chat.messages.data?.at(-1)?._id;
  const { logRef, contentRef, pinned, onScroll, scrollToEnd } = useStickToBottom(
    `${lastMessageId}:${chat.send.isPending}`,
    chat.activeId,
  );
  const ask = (text: string) => chat.send.mutate(text);
  return (
    <section className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-card lg:self-start">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">Conversations</h1>
          <Button
            variant="secondary"
            size="sm"
            aria-label="New conversation"
            title="New conversation"
            busy={chat.create.isPending}
            disabled={chat.send.isPending}
            onClick={() => chat.create.mutate()}
          >
            <MessageSquarePlus className="size-4" />
          </Button>
        </div>
        <Select
          aria-label="Active conversation"
          className="lg:hidden"
          value={chat.activeId ?? ""}
          onChange={(event) => chat.setSelectedId(event.target.value)}
        >
          <option value="" disabled>
            Select conversation
          </option>
          {chat.conversations.data?.map((item) => (
            <option key={item._id} value={item._id}>
              {item.title} ({item.status})
            </option>
          ))}
        </Select>
        <div className="scroll-thin hidden max-h-[62vh] space-y-1 overflow-auto lg:block">
          {chat.conversations.data?.map((item) => {
            const selected = item._id === chat.activeId;
            return (
              <motion.button
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                type="button"
                key={item._id}
                onClick={() => chat.setSelectedId(item._id)}
                aria-current={selected}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition",
                  selected
                    ? "border-accent/30 bg-accentSoft"
                    : "border-transparent hover:bg-mutedSurface",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="shrink-0 text-[11px] text-muted">
                    {relativeTime(item.lastMessageAt ?? item.updatedAt)}
                  </span>
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className={cn("size-1.5 rounded-full", dotColor[statusTone(item.status)])}
                  />
                  {item.status}
                </span>
              </motion.button>
            );
          })}
        </div>
        <FormError error={chat.conversations.error ?? chat.create.error} />
        <Link
          to="/orders"
          className="flex items-center gap-2 border-t border-border pt-4 text-sm font-medium text-accent hover:text-accentStrong"
        >
          <Package className="size-4" />
          My orders
        </Link>
      </aside>
      <div className="flex h-[calc(100dvh-13rem)] min-h-[460px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold leading-tight">NovaStore Support</h2>
              <div className="mt-1">
                {chat.active && <StatusBadge status={chat.active.status} />}
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={!chat.activeId || closed || chat.active?.status === "WAITING"}
            busy={escalate.isPending}
            onClick={() => escalate.mutate()}
          >
            <Headset className="size-4" />
            Request an agent
          </Button>
        </header>
        <div className="relative min-h-0 flex-1">
          <div
            role="log"
            ref={logRef}
            onScroll={onScroll}
            aria-label="Conversation messages"
            className="scroll-thin h-full overflow-y-auto bg-gradient-to-b from-background/60 to-surface p-4 sm:p-6"
          >
            <div ref={contentRef} className="space-y-5">
              {chat.messages.isLoading && <p className="text-sm text-muted">Loading messages...</p>}
              {!messageCount && !chat.messages.isLoading && (
                <div className="mx-auto max-w-md py-10 text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accentSoft text-accent">
                    <Sparkles className="size-7" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">How can we help?</h3>
                  <p className="mt-1 text-sm text-muted">
                    Ask about an order or policy, or pick a suggestion.
                  </p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {suggestions.map(({ icon: Icon, text }) => (
                      <button
                        key={text}
                        type="button"
                        disabled={chat.send.isPending || closed}
                        onClick={() => ask(text)}
                        className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm font-medium transition hover:border-accent/40 hover:bg-accentSoft disabled:opacity-50"
                      >
                        <Icon className="size-4 shrink-0 text-accent" aria-hidden="true" />
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chat.messages.data?.map((message) => {
                const mine = message.senderType === "CUSTOMER";
                return (
                  <motion.article
                    key={message._id}
                    initial={{ opacity: 0, y: 12, x: mine ? 12 : -12 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className={cn("flex gap-3", mine && "flex-row-reverse")}
                  >
                    {!mine && <Avatar kind={message.senderType} />}
                    <div className={cn("max-w-[85%] sm:max-w-[75%]", mine && "text-right")}>
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-2 text-xs text-muted",
                          mine && "justify-end",
                        )}
                      >
                        <span className="font-semibold text-foreground">
                          {mine
                            ? "You"
                            : message.senderType === "AGENT"
                              ? "Support agent"
                              : message.senderType === "SYSTEM"
                                ? "Update"
                                : "NovaStore Assistant"}
                        </span>
                        <time>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <div
                        className={cn(
                          "mt-1.5 rounded-2xl px-4 py-3 text-left text-sm leading-6 shadow-sm",
                          mine
                            ? "rounded-tr-md bg-accent text-accentForeground"
                            : message.senderType === "AGENT"
                              ? "rounded-tl-md border border-emerald-200 bg-emerald-50"
                              : "rounded-tl-md border border-border bg-surface",
                        )}
                      >
                        <RichText text={message.content} />
                      </div>
                      {guardNote(message.metadata) && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-left text-[11px] text-muted">
                          <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden="true" />
                          {guardNote(message.metadata)}
                        </p>
                      )}
                      {message.citations && message.citations.length > 0 && (
                        <div className="mt-2 space-y-1.5 text-left">
                          {message.citations.map((citation, index) => (
                            <details
                              key={`${citation.source}-${index}`}
                              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                            >
                              <summary className="flex items-center gap-1.5 font-medium text-accent">
                                <ScrollText className="inline size-3.5" aria-hidden="true" />
                                {citation.title}
                              </summary>
                              <p className="mt-2 whitespace-pre-wrap text-muted">
                                {citation.content}
                              </p>
                            </details>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.article>
                );
              })}
              {chat.send.isPending && (
                <div className="flex items-start gap-3" role="status">
                  <Avatar kind="AI" />
                  {chat.live.text ? (
                    <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[75%]">
                      <RichText text={chat.live.text} />
                      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent align-middle" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3 shadow-sm">
                      <span className="flex items-center gap-1.5">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </span>
                      <span className="text-xs font-medium text-muted">
                        {chat.live.step || "Reviewing your request"}…
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <AnimatePresence>
            {!pinned && messageCount > 0 && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                onClick={() => scrollToEnd("smooth")}
                className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-medium shadow-pop hover:bg-accentSoft"
              >
                <ArrowDown className="size-3.5" aria-hidden="true" />
                Latest messages
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <div className="px-4">
          <FormError error={chat.messages.error ?? chat.send.error ?? escalate.error} />
        </div>
        {closed ? (
          <p className="border-t border-border bg-mutedSurface p-4 text-sm text-muted">
            Conversation resolved. Start a new conversation for further help.
          </p>
        ) : (
          <ChatComposer
            value={input}
            disabled={chat.send.isPending}
            onChange={setInput}
            onSubmit={(event) => {
              event.preventDefault();
              if (!input.trim()) return;
              chat.send.mutate(input.trim(), { onSuccess: () => setInput("") });
            }}
          />
        )}
      </div>
    </section>
  );
}
