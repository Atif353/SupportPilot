import { supportTools } from "./support.tools.js";

export const toolCatalog = [
  { name: "getCustomerOrders", description: "Read the authenticated customer's recent orders." },
  { name: "getOrderTracking", description: "Read authorized shipment history for an order." },
  {
    name: "searchKnowledgeBase",
    description: "Search published support policy using hybrid retrieval.",
  },
  { name: "cancelOrder", description: "Cancel an eligible order." },
  { name: "createReturnRequest", description: "Create a policy-eligible return request." },
  { name: "createRefundRequest", description: "Create a refund request pending human approval." },
  { name: "createSupportTicket", description: "Create a customer support ticket." },
] as const;

export type SupportToolName = (typeof toolCatalog)[number]["name"];

export const callSupportTool = async (
  name: SupportToolName,
  context: { userId: string; role: string },
  input: Record<string, unknown> = {},
): Promise<unknown> => {
  switch (name) {
    case "getCustomerOrders":
      return supportTools.getCustomerOrders(context.userId, context.role);
    case "getOrderTracking":
      return supportTools.getOrderTracking(context.userId, context.role, input);
    case "searchKnowledgeBase":
      return supportTools.searchKnowledgeBase(input);
    case "cancelOrder":
      return supportTools.cancelOrder(context.userId, context.role, input);
    case "createReturnRequest":
      return supportTools.createReturnRequest(context.userId, context.role, input);
    case "createRefundRequest":
      return supportTools.createRefundRequest(context.userId, context.role, input);
    case "createSupportTicket":
      return supportTools.createSupportTicket(context.userId, context.role, input);
  }
};
