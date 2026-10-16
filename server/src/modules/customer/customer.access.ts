import { AppError } from "../../common/errors/AppError.js";
import { Customer } from "../models/customer.model.js";

export async function requireCustomer(userId: string) {
  const customer = await Customer.findOne({ user: userId }).lean();
  if (!customer)
    throw new AppError({
      message: "Customer profile not found.",
      code: "NOT_FOUND",
      statusCode: 404,
    });
  return customer;
}

export function requireStaff(role: string) {
  if (role !== "ADMIN" && role !== "SUPPORT")
    throw new AppError({
      message: "Staff access is required.",
      code: "FORBIDDEN",
      statusCode: 403,
    });
}
