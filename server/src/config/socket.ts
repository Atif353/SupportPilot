import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { env } from "./env.js";
import { assertConversationAccess } from "../modules/conversations/conversation.service.js";
import { conversationEvents } from "../modules/conversations/conversation.events.js";
import { authenticateSocket } from "../modules/auth/session.service.js";

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, { cors: { origin: env.CLIENT_URL, credentials: true } });
  io.use(async (socket, next) => {
    try {
      const auth = await authenticateSocket(String(socket.handshake.auth?.token ?? ""));
      if (!auth) return next(new Error("Authentication is required."));
      socket.data.auth = auth;
      next();
    } catch {
      next(new Error("Authentication is unavailable."));
    }
  });
  const updated = (id: string) =>
    io.to(`conversation:${id}`).emit("conversation:updated", { conversationId: id });
  const agentEvent = (event: { conversationId: string }) =>
    io.to(`conversation:${event.conversationId}`).emit("agent:event", event);
  conversationEvents.on("updated", updated);
  conversationEvents.on("agent", agentEvent);
  httpServer.once("close", () => {
    conversationEvents.off("updated", updated);
    conversationEvents.off("agent", agentEvent);
  });
  io.on("connection", (socket) => {
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, socket.data.auth.exp * 1000 - Date.now()),
    );
    const recheck = setInterval(() => {
      void authenticateSocket(String(socket.handshake.auth?.token ?? ""))
        .then((auth) => {
          if (!auth) socket.disconnect(true);
        })
        .catch(() => socket.disconnect(true));
    }, 30000);
    socket.once("disconnect", () => {
      clearTimeout(expiry);
      clearInterval(recheck);
    });
    socket.on("conversation:join", async (id: string) => {
      try {
        const auth = await authenticateSocket(String(socket.handshake.auth?.token ?? ""));
        if (!auth) {
          socket.disconnect();
          return;
        }
        await assertConversationAccess(auth.sub, auth.role, id);
        await socket.join(`conversation:${id}`);
      } catch {
        socket.emit("conversation:error", { message: "Conversation unavailable." });
      }
    });
    socket.on("conversation:typing", (id: string) => {
      if (socket.data.auth.exp * 1000 <= Date.now()) {
        socket.disconnect();
        return;
      }
      if (socket.rooms.has(`conversation:${id}`))
        socket.to(`conversation:${id}`).emit("conversation:typing");
    });
  });
  return io;
}
