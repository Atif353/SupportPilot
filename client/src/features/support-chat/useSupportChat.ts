import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { apiClient } from "../../shared/api/apiClient";
import { readSession } from "../../shared/auth/auth";
import { clientEnv } from "../../app/config/env";

export type Conversation = {
  _id: string;
  title: string;
  status: string;
  assignedTo?: string;
  lastMessageAt?: string;
  updatedAt?: string;
};
export type ChatMessage = {
  _id: string;
  senderType: string;
  content: string;
  createdAt: string;
  citations?: { title: string; source: string; content: string }[];
  metadata?: Record<string, string>;
};
export type LiveRun = { step: string; text: string };
const idleRun: LiveRun = { step: "", text: "" };
type AgentEvent = { conversationId: string } & (
  | { type: "step"; label: string }
  | { type: "token"; text: string }
  | { type: "replace"; text: string }
  | { type: "reset" }
);

export function useSupportChat() {
  const cache = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [live, setLive] = useState<LiveRun>(idleRun);
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiClient<Conversation[]>("/conversations"),
    refetchInterval: 10000,
  });
  const activeId = selectedId ?? conversations.data?.[0]?._id;
  const active = conversations.data?.find((item) => item._id === activeId);
  const messages = useQuery({
    queryKey: ["conversation-messages", activeId],
    queryFn: () => apiClient<ChatMessage[]>(`/conversations/${activeId}/messages`),
    enabled: Boolean(activeId),
    refetchInterval: 5000,
  });
  const create = useMutation({
    mutationFn: () =>
      apiClient<Conversation>("/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "Support request" }),
      }),
    onSuccess: (conversation) => {
      cache.setQueryData<Conversation[]>(["conversations"], (current) => [
        conversation,
        ...(current ?? []),
      ]);
      cache.setQueryData(["conversation-messages", conversation._id], []);
      setSelectedId(conversation._id);
    },
  });
  const send = useMutation({
    mutationFn: async (content: string) => {
      const id = activeId ?? (await create.mutateAsync())._id;
      if (active?.status === "WAITING" || active?.assignedTo)
        await apiClient(`/conversations/${id}/messages`, {
          method: "POST",
          body: JSON.stringify({ content }),
        });
      else
        await apiClient("/agent/chat", {
          method: "POST",
          body: JSON.stringify({ message: content, conversationId: id }),
        });
      return id;
    },
    onSettled: async () => {
      await cache.invalidateQueries({ queryKey: ["conversation-messages"] });
      await cache.invalidateQueries({ queryKey: ["conversations"] });
      setLive(idleRun);
    },
  });
  useEffect(() => {
    const token = readSession()?.accessToken;
    if (!activeId || !token) return;
    const socket = io(clientEnv.VITE_API_URL.replace(/\/api\/v1$/, ""), { auth: { token } });
    socket.on("connect", () => socket.emit("conversation:join", activeId));
    socket.on("agent:event", (event: AgentEvent) => {
      if (event.conversationId !== activeId) return;
      setLive((current) =>
        event.type === "step"
          ? { ...current, step: event.label }
          : event.type === "token"
            ? { ...current, text: current.text + event.text }
            : event.type === "replace"
              ? { ...current, text: event.text }
              : { ...current, text: "" },
      );
    });
    socket.on("conversation:updated", () => {
      void cache.invalidateQueries({ queryKey: ["conversation-messages", activeId] });
      void cache.invalidateQueries({ queryKey: ["conversations"] });
    });
    return () => {
      socket.disconnect();
      setLive(idleRun);
    };
  }, [activeId, cache]);
  return { conversations, messages, active, activeId, setSelectedId, create, send, live };
}
