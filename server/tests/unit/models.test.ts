import { describe, expect, it } from "vitest";
import {
  Conversation,
  Customer,
  Order,
  PolicyChunk,
  Product,
  Ticket,
  User,
} from "../../src/modules/models/index.js";

describe("domain model contracts", () => {
  it("registers the core commerce relations", () => {
    expect(Customer.schema.path("user").options.ref).toBe("User");
    expect(Order.schema.path("customer").options.ref).toBe("Customer");
    expect(Order.schema.path("items").schema?.path("product").options.ref).toBe("Product");
    expect(Conversation.schema.path("customer").options.ref).toBe("Customer");
  });

  it("exposes workflow enums and required identifiers", () => {
    expect((Order.schema.path("status") as unknown as { enumValues: string[] }).enumValues).toEqual(
      ["PENDING", "PAYMENT_CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
    );
    expect((User.schema.path("role") as unknown as { enumValues: string[] }).enumValues).toEqual([
      "CUSTOMER",
      "SUPPORT",
      "ADMIN",
    ]);
    expect(Ticket.schema.path("ticketNumber").isRequired).toBe(true);
    const productIndexes = Product.schema.indexes();
    expect(productIndexes).toHaveLength(3);
    expect(productIndexes).toContainEqual([
      { category: 1, isActive: 1 },
      expect.objectContaining({ background: true }),
    ]);
    expect(productIndexes).toContainEqual([
      { description: "text", name: "text", sku: "text" },
      expect.objectContaining({ background: true }),
    ]);
    expect(PolicyChunk.schema.indexes()).toContainEqual([
      { document: 1, version: 1, chunkIndex: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });
});
