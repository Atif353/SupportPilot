export type OrderSummary = {
  orderNumber: string;
  status: string;
  placedAt?: string | undefined;
  estimatedDeliveryAt?: string | undefined;
  deliveredAt?: string | undefined;
  trackingNumber?: string | undefined;
  carrier?: string | undefined;
  total?: number | undefined;
  items: string[];
};
type Source = { title: string; content: string };
export type ComposeInput = {
  intent: string;
  specialist: string;
  message: string;
  orders: OrderSummary[];
  sources: Source[];
};

const iso = (value: unknown): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
const date = (value?: string): string | undefined =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : undefined;
const label = (status: string): string =>
  status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());

/** Trims full order documents to the fields an answer needs; keeps prompts and answers small. */
export function summarizeOrders(orders: unknown[]): OrderSummary[] {
  return orders.map((entry) => {
    const order = entry as Record<string, unknown>;
    const items = Array.isArray(order.items)
      ? (order.items as { name?: string; quantity?: number }[])
      : [];
    return {
      orderNumber: String(order.orderNumber ?? ""),
      status: String(order.status ?? ""),
      placedAt: iso(order.createdAt),
      estimatedDeliveryAt: iso(order.estimatedDeliveryAt),
      deliveredAt: iso(order.deliveredAt),
      trackingNumber: order.trackingNumber ? String(order.trackingNumber) : undefined,
      carrier: order.carrier ? String(order.carrier) : undefined,
      total: typeof order.total === "number" ? order.total : undefined,
      items: items.map((item) => `${item.name ?? "Item"} x${item.quantity ?? 1}`),
    };
  });
}

const orderLine = (order: OrderSummary): string => {
  const parts = [label(order.status)];
  if (order.deliveredAt) parts.push(`delivered ${date(order.deliveredAt)}`);
  else if (order.estimatedDeliveryAt && !["CANCELLED", "REFUNDED"].includes(order.status))
    parts.push(`estimated delivery ${date(order.estimatedDeliveryAt)}`);
  if (order.trackingNumber)
    parts.push(`tracking ${order.trackingNumber}${order.carrier ? ` (${order.carrier})` : ""}`);
  if (order.items.length) parts.push(order.items.join(", "));
  return `- **${order.orderNumber}**: ${parts.join(" · ")}`;
};

const excerpt = (content: string, sentences = 3): string =>
  content
    .replace(/^#+\s.*\n+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .slice(0, sentences)
    .join(" ");

const policyBlock = (sources: Source[]): string =>
  sources
    .slice(0, 2)
    .map((source) => `**${source.title.replace(/^NovaStore\s+/, "")}**\n${excerpt(source.content)}`)
    .join("\n\n");

const agentHint =
  "If you'd like a person to look into it, choose **Request an agent** above and a support agent will take over this conversation.";

const wantsLatestOnly = /\b(latest|last|recent|newest)\b/i;
const trouble =
  /\b(damag|broken|defect|faulty|missing|lost|not (?:arrive|turn)|never (?:arrive|came)|turned up|late|delayed)/i;

/** The customer's real orders, formatted for an answer. Empty string when there are none. */
export function composeOrderSection(orders: OrderSummary[], message: string): string {
  if (!orders.length) return "";
  const shown = wantsLatestOnly.test(message) ? orders.slice(0, 1) : orders.slice(0, 3);
  const heading =
    shown.length === 1 ? "Here is your most recent order" : "Here are your most recent orders";
  return `${heading}:\n${shown.map(orderLine).join("\n")}`;
}

/**
 * Builds a complete, grounded answer from tool evidence alone. Used whenever no model can
 * answer, so the customer still gets order details, the relevant policy and clear next steps.
 */
export function composeAnswer(input: ComposeInput): string {
  const { intent, specialist, message, orders } = input;
  const sources = input.sources.filter(
    (source) => typeof source?.title === "string" && typeof source?.content === "string",
  );
  const sections: string[] = [];

  if (specialist === "ResolutionAgent") {
    const how =
      intent === "CANCEL"
        ? "I can't cancel orders from chat, and only orders that haven't entered processing can be cancelled. To request it, open the order under **Orders**, then **Review request** and **Confirm request**."
        : intent === "REFUND"
          ? "I can't issue refunds from chat. Refunds are requested on the order page, then reviewed and approved by our staff. To start one, open the order under **Orders**, then **Review request** and **Confirm request**."
          : "I can't start a return from chat. To request one, open the order under **Orders**, choose the item and quantity, then **Review request** and **Confirm request**.";
    sections.push(how);
    if (sources.length) sections.push(`Here's what our policy says:\n\n${policyBlock(sources)}`);
    sections.push("Nothing has been changed on your account yet.");
    return sections.join("\n\n");
  }

  if (orders.length) {
    sections.push(composeOrderSection(orders, message));
    if (trouble.test(message) && !sources.length)
      sections.push(
        "If something is damaged or hasn't arrived, tell me which order and a support agent can investigate.",
      );
  } else if (intent === "ORDER") {
    sections.push("I couldn't find any orders on your account yet.");
  }

  if (sources.length) {
    sections.push(
      `${orders.length ? "Relevant policy" : "Here's what our policy says"}:\n\n${policyBlock(sources)}`,
    );
  } else if (intent === "POLICY") {
    sections.push("I couldn't find a published policy that answers this.");
  }

  if (!sections.length)
    return "Hi! I can check your orders and tracking, explain our returns, shipping and refund policies, or connect you with a support agent. What would you like to know?";

  if (trouble.test(message) || intent === "POLICY" || !orders.length) sections.push(agentHint);
  else
    sections.push(
      "Need anything else? I can explain our policies or connect you with a support agent.",
    );
  return sections.join("\n\n");
}
