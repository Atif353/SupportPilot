import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import {
  ApprovalRequest,
  AuditLog,
  Conversation,
  Customer,
  KnowledgeDocument,
  Message,
  Order,
  Product,
  RefundRequest,
  ReturnRequest,
  Ticket,
  User,
} from "../modules/models/index.js";
import { hashPassword } from "../modules/auth/auth.service.js";
import { processNextDocument } from "../modules/knowledge/knowledge.ingest.js";
import { env } from "../config/env.js";

const seedDate = new Date(Date.now() - 35 * 86400000);
const demoPasswordHash = hashPassword("demo-password");

const dateAt = (days: number, hours = 0): Date =>
  new Date(seedDate.getTime() + (days * 24 + hours) * 60 * 60 * 1000);

const getAt = <T>(items: T[], index: number): T => {
  const item = items[index];
  if (!item) throw new Error(`Seed fixture missing item at index ${index}.`);
  return item;
};

const runSeed = async (): Promise<void> => {
  if (env.NODE_ENV === "production") throw new Error("Demo seeding is disabled in production.");
  await connectDatabase();
  const database = mongoose.connection.db!;
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  let hasData = false;
  for (const collection of collections) {
    if (
      !collection.name.startsWith("system.") &&
      (await database.collection(collection.name).estimatedDocumentCount()) > 0
    ) {
      hasData = true;
      break;
    }
  }
  if (hasData && process.env.SEED_RESET_DATABASE !== database.databaseName)
    throw new Error(
      "Database is not empty. Use a separate demo database. An intentional reset requires SEED_RESET_DATABASE to equal the exact database name.",
    );
  if (hasData) await mongoose.connection.dropDatabase();
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection();
    await model.createIndexes();
  }

  const admin = await User.create({
    email: "admin@novastore.demo",
    passwordHash: demoPasswordHash,
    role: "ADMIN",
    firstName: "Avery",
    lastName: "Admin",
  });
  const support = await User.create({
    email: "support@novastore.demo",
    passwordHash: demoPasswordHash,
    role: "SUPPORT",
    firstName: "Sam",
    lastName: "Support",
  });
  const customerUsers = await User.insertMany(
    Array.from({ length: 50 }, (_, index) => ({
      email: `customer${String(index + 1).padStart(2, "0")}@novastore.demo`,
      passwordHash: demoPasswordHash,
      role: "CUSTOMER" as const,
      firstName: ["Jordan", "Taylor", "Morgan", "Riley", "Casey"][index % 5],
      lastName: `Customer${index + 1}`,
      phone: `+1-555-010-${String(index + 1).padStart(2, "0")}`,
    })),
  );

  const customers = await Customer.insertMany(
    customerUsers.map((user, index) => ({
      user: user._id,
      customerNumber: `CUS-${String(index + 1).padStart(5, "0")}`,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      addresses: [
        {
          label: "Home",
          line1: `${100 + index} Market Street`,
          city: ["Austin", "Seattle", "Boston", "Denver", "Chicago"][index % 5],
          state: ["TX", "WA", "MA", "CO", "IL"][index % 5],
          postalCode: `7${String(8000 + index).padStart(4, "0")}`,
          country: "US",
        },
      ],
      tags: index % 4 === 0 ? ["vip"] : [],
    })),
  );

  const products = await Product.insertMany(
    Array.from({ length: 25 }, (_, index) => ({
      sku: `NOVA-${String(index + 1).padStart(3, "0")}`,
      name:
        ["Wireless Headphones", "Smart Speaker", "USB-C Hub", "Mechanical Keyboard", "4K Monitor"][
          index % 5
        ] + ` ${index + 1}`,
      description: "A reliable NovaStore electronics product for everyday use.",
      category: ["Audio", "Smart Home", "Accessories", "Computing", "Displays"][index % 5],
      brand: ["NovaSound", "NovaHome", "NovaLink", "NovaType", "NovaView"][index % 5],
      price: 49 + index * 17,
      inventoryCount: 12 + index * 3,
      images: [`https://images.example.com/products/nova-${index + 1}.jpg`],
      specifications: { color: index % 2 === 0 ? "Black" : "Silver", warranty: "12 months" },
      isActive: index !== 24,
    })),
  );

  const orderStatuses = [
    "PENDING",
    "PAYMENT_CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
  ] as const;
  const orders = await Order.insertMany(
    Array.from({ length: 200 }, (_, index) => {
      const customer = getAt(customers, index % customers.length);
      const product = getAt(products, index % products.length);
      const quantity = (index % 3) + 1;
      const subtotal = product.price * quantity;
      const shippingCost = index % 4 === 0 ? 0 : 8.99;
      const tax = Number((subtotal * 0.08).toFixed(2));
      const status = getAt([...orderStatuses], index % orderStatuses.length);
      const shipmentHistory = [
        {
          status: "ORDER_PLACED",
          location: "NovaStore",
          description: "Order placed",
          occurredAt: dateAt(index % 30),
        },
      ];
      if (["SHIPPED", "DELIVERED"].includes(status)) {
        shipmentHistory.push(
          {
            status: "SHIPPED",
            location: "Austin Fulfillment Center",
            description: "Package shipped",
            occurredAt: dateAt((index % 30) + 1),
          },
          {
            status: status === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT",
            location: "Customer address",
            description: status === "DELIVERED" ? "Package delivered" : "Package in transit",
            occurredAt: dateAt((index % 30) + 3),
          },
        );
      }
      return {
        orderNumber: `ORD-${String(index + 1).padStart(6, "0")}`,
        customer: customer._id,
        items: [
          {
            product: product._id,
            sku: product.sku,
            name: product.name,
            quantity,
            unitPrice: product.price,
            lineTotal: subtotal,
          },
        ],
        subtotal,
        shippingCost,
        tax,
        total: Number((subtotal + shippingCost + tax).toFixed(2)),
        status,
        paymentStatus: status === "PENDING" ? "PENDING" : "PAID",
        shippingAddress: getAt(customer.addresses, 0),
        trackingNumber: ["SHIPPED", "DELIVERED"].includes(status)
          ? `NOVA${String(index + 1).padStart(10, "0")}`
          : undefined,
        carrier: ["SHIPPED", "DELIVERED"].includes(status) ? "NovaShip" : undefined,
        estimatedDeliveryAt: dateAt((index % 30) + 5),
        deliveredAt: status === "DELIVERED" ? dateAt((index % 30) + 3) : undefined,
        shipmentHistory,
        createdAt: dateAt(index % 30),
        updatedAt: dateAt(index % 30),
      };
    }),
  );

  const deliveredOrders = orders.filter((order) => order.status === "DELIVERED");
  await ReturnRequest.insertMany(
    deliveredOrders.slice(0, 20).map((order, index) => ({
      returnNumber: `RET-${String(index + 1).padStart(5, "0")}`,
      order: order._id,
      customer: order.customer,
      items: [{ product: getAt(order.items, 0).product, quantity: 1 }],
      reason: getAt(["Damaged on arrival", "Changed my mind", "Wrong item"], index % 3),
      status: getAt(["REQUESTED", "APPROVED", "RECEIVED", "COMPLETED"], index % 4),
      requestedAt: dateAt(10 + (index % 14)),
    })),
  );
  const refunds = await RefundRequest.insertMany(
    orders
      .filter((order) => order.status === "CANCELLED")
      .slice(0, 16)
      .map((order, index) => ({
        refundNumber: `REF-${String(index + 1).padStart(5, "0")}`,
        order: order._id,
        customer: order.customer,
        amount: order.total,
        reason: "Cancelled order refund",
        status: getAt(["REQUESTED", "APPROVED", "PROCESSING", "COMPLETED"], index % 4),
        paymentReference:
          index % 4 === 3 ? `DEMO-PAY-${String(index + 1).padStart(8, "0")}` : undefined,
        completedAt: index % 4 === 3 ? dateAt(30) : undefined,
        requestedAt: dateAt(10 + (index % 14)),
      })),
  );
  for (const refund of refunds.filter((refund) => refund.status === "COMPLETED"))
    await Order.updateOne({ _id: refund.order }, { paymentStatus: "REFUNDED" });

  const tickets = await Ticket.insertMany(
    Array.from({ length: 30 }, (_, index) => ({
      ticketNumber: `TKT-${String(index + 1).padStart(5, "0")}`,
      customer: getAt(customers, index % customers.length)._id,
      order: getAt(orders, index)._id,
      subject: getAt(
        ["Where is my order?", "I need help with a return", "Product question"],
        index % 3,
      ),
      description: "This seeded support ticket represents a realistic customer request.",
      category: getAt(["SHIPPING", "RETURNS", "PRODUCT"], index % 3),
      priority: getAt(["LOW", "MEDIUM", "HIGH", "URGENT"], index % 4),
      status: getAt(["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED"], index % 4),
      assignedTo: index % 3 === 0 ? support._id : undefined,
      tags: ["seeded", index % 2 === 0 ? "order" : "general"],
    })),
  );

  const conversations = await Conversation.insertMany(
    Array.from({ length: 40 }, (_, index) => ({
      customer: getAt(customers, index % customers.length)._id,
      ticket: index < tickets.length ? getAt(tickets, index)._id : undefined,
      channel: index % 3 === 0 ? "EMAIL" : "WEB",
      status: getAt(["OPEN", "WAITING", "RESOLVED", "CLOSED"], index % 4),
      assignedTo: index % 2 === 0 ? support._id : undefined,
      title: getAt(
        ["Order status help", "Return eligibility", "Product recommendation"],
        index % 3,
      ),
      lastMessageAt: dateAt(index % 34, 9.1),
    })),
  );
  await Message.insertMany(
    conversations.flatMap((conversation, index) => [
      {
        conversation: conversation._id,
        senderType: "CUSTOMER",
        sender: getAt(customerUsers, index % customerUsers.length)._id,
        content: "Hello, I need help with my order.",
        createdAt: dateAt(index % 34, 9),
      },
      {
        conversation: conversation._id,
        senderType: index % 2 === 0 ? "AGENT" : "AI",
        sender: index % 2 === 0 ? support._id : undefined,
        content: "I am reviewing the order details for you.",
        createdAt: dateAt(index % 34, 9.1),
      },
    ]),
  );

  await KnowledgeDocument.create({
    title: "NovaStore Returns and Refunds Policy",
    sourceType: "POLICY",
    content:
      "Customers may request a return within 30 days of delivery. Approved refunds are processed after inspection.",
    status: "DRAFT",
    indexStatus: "QUEUED",
    version: 1,
    tags: ["returns", "refunds"],
  });
  await processNextDocument();
  const pendingRefund = getAt(refunds, 0);
  await ApprovalRequest.create({
    requestType: "REFUND",
    requestedBy: getAt(customerUsers, 5)._id,
    order: pendingRefund.order,
    status: "PENDING",
    payload: {
      refundRequestId: pendingRefund.id,
      amount: String(pendingRefund.amount),
      currency: pendingRefund.currency,
      reason: pendingRefund.reason,
    },
  });
  await AuditLog.create({
    actor: admin._id,
    action: "SEED_DATABASE",
    entityType: "Database",
    entityId: "supportpilot-ai",
    metadata: { source: "day-2-seed" },
  });

  console.log(
    JSON.stringify(
      {
        customers: customers.length,
        products: products.length,
        orders: orders.length,
        tickets: tickets.length,
        conversations: conversations.length,
        demoAccounts: [admin.email, support.email, getAt(customerUsers, 0).email],
      },
      null,
      2,
    ),
  );
};

runSeed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
