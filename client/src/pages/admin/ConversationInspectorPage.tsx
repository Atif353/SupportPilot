import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowDownUp } from "lucide-react";
import { useParams } from "react-router-dom";
import { apiClient } from "../../shared/api/apiClient";
import { PageHeader } from "../../shared/components/layout/PageHeader";
import { Timeline } from "../../shared/components/data-display/Timeline";
import { ConversationActions } from "../../features/conversations/ConversationActions";
import { useAuth } from "../../app/providers/AuthProvider";
import { FormError } from "../../shared/components/ui/Field";
import { cn } from "../../shared/utils/cn";

type InspectorData = {
  conversation: {
    title: string;
    status: string;
    assignedTo?: { _id: string };
    channel: string;
    summary?: string;
    activeEntity?: string;
    customer?: { email?: string; firstName?: string; lastName?: string };
    ticket?: { ticketNumber?: string; subject?: string; order?: { orderNumber?: string } };
  } | null;
  messages: { content: string; senderType: string; createdAt: string }[];
  traces: {
    agentType: string;
    toolCalls: string[];
    latencyMs?: number;
    status: string;
    createdAt: string;
    sources?: string[];
    tokenUsage?: Record<string, number>;
  }[];
};
export const ConversationInspectorPage = (): React.ReactElement => {
  const { conversationId } = useParams();
  const [newestFirst, setNewestFirst] = useState(true);
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["conversation-inspector", conversationId],
    queryFn: () => apiClient<InspectorData>(`/admin/conversations/${conversationId}`),
    enabled: Boolean(conversationId),
    refetchInterval: 5000,
  });
  if (query.isLoading) return <p className="text-sm text-muted">Loading inspector...</p>;
  if (!query.data?.conversation)
    return <p className="text-sm text-muted">Conversation unavailable.</p>;
  const { conversation, traces } = query.data;
  const messages = newestFirst ? [...query.data.messages].reverse() : query.data.messages;
  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Conversation inspector"
        title={conversation.title}
        description={`${conversation.channel} · ${conversation.status} · ${conversation.customer?.email ?? "customer context unavailable"}`}
      />
      <FormError error={query.error} />
      <ConversationActions
        id={conversationId!}
        status={conversation.status}
        canReply={
          session?.user.role === "ADMIN" || conversation.assignedTo?._id === session?.user.id
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {(conversation.summary || conversation.activeEntity || conversation.ticket) && (
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card lg:col-span-2">
            <h2 className="font-semibold">Context</h2>
            <p className="mt-2 text-sm text-muted">
              {conversation.summary ?? "No summary recorded yet."}
            </p>
            <p className="mt-2 text-xs text-muted">
              Active entity: {conversation.activeEntity ?? "none"} · Ticket:{" "}
              {conversation.ticket?.ticketNumber ?? "none"} · Order:{" "}
              {conversation.ticket?.order?.orderNumber ?? "none"}
            </p>
          </div>
        )}
        <div className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Conversation</h2>
            <button
              type="button"
              onClick={() => setNewestFirst((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/40 hover:bg-accentSoft hover:text-accent"
            >
              <ArrowDownUp className="size-3.5" aria-hidden="true" />
              {newestFirst ? "Newest first" : "Oldest first"}
            </button>
          </div>
          <div className="mt-5 space-y-4">
            {messages.map((message) => {
              const customer = message.senderType === "CUSTOMER";
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  key={`${message.createdAt}-${message.senderType}-${message.content.slice(0, 24)}`}
                  className={cn("flex flex-col gap-1", customer ? "items-start" : "items-end")}
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    {message.senderType} · {new Date(message.createdAt).toLocaleString()}
                  </span>
                  <p
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-6",
                      customer
                        ? "rounded-tl-md bg-mutedSurface"
                        : message.senderType === "AGENT"
                          ? "rounded-tr-md border border-emerald-200 bg-emerald-50"
                          : "rounded-tr-md bg-accentSoft",
                    )}
                  >
                    {message.content}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card lg:self-start">
          <h2 className="font-semibold">Agent trace</h2>
          <div className="mt-5">
            {traces.length === 0 && (
              <p className="text-sm text-muted">No AI runs recorded for this conversation.</p>
            )}
            <Timeline
              items={traces.map((trace) => ({
                title: trace.agentType,
                description: `${trace.toolCalls.join(", ")} · ${trace.latencyMs ?? 0}ms · ${trace.status} · sources ${trace.sources?.length ?? 0} · tokens ${trace.tokenUsage?.totalTokens ?? "unavailable"}`,
                date: new Date(trace.createdAt).toLocaleString(),
              }))}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
