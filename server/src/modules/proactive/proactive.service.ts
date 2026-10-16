import { AuditLog } from "../models/audit-log.model.js";
import { Order } from "../models/order.model.js";
import { Ticket } from "../models/ticket.model.js";

export const runDelayedOrderSweep = async (): Promise<{ created: number }> => {
  const delayed = await Order.find({
    status: { $in: ["SHIPPED", "PROCESSING"] },
    estimatedDeliveryAt: { $lt: new Date() },
  }).lean();
  let created = 0;
  for (const order of delayed) {
    const existing = await Ticket.exists({ order: order._id, category: "PROACTIVE_DELAY" });
    if (existing) continue;
    const ticket = await Ticket.create({
      ticketNumber: `TKT-DELAY-${order.orderNumber}`,
      customer: order.customer,
      order: order._id,
      subject: `Delivery delay for ${order.orderNumber}`,
      description:
        "We noticed this order is past its estimated delivery date and created a proactive support case.",
      category: "PROACTIVE_DELAY",
      priority: "HIGH",
      status: "OPEN",
      tags: ["proactive", "delayed-order"],
    });
    await AuditLog.create({
      action: "PROACTIVE_DELAY_TICKET_CREATED",
      entityType: "Ticket",
      entityId: ticket.id,
      metadata: { orderNumber: order.orderNumber },
    });
    created += 1;
  }
  return { created };
};
