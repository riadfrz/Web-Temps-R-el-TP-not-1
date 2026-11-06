import { getProduct, getUser, nextOrderId, saveOrder, saveProduct } from "../db";
import { HttpError } from "../http";
import type { Order } from "../types";

type NewOrder = Pick<Order, "userId" | "productId" | "quantity">;

let queue: Promise<unknown> = Promise.resolve();

// Runs mutations one at a time so stock checks and updates cannot interleave.
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task);
  queue = result.catch(() => undefined);
  return result;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function parseNewOrder(body: unknown): NewOrder {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  const { userId, productId, quantity } = body as Record<string, unknown>;
  const invalid = Object.entries({ userId, productId, quantity })
    .filter(([, value]) => !isPositiveInt(value))
    .map(([key]) => key);
  if (invalid.length > 0) {
    throw new HttpError(400, `Missing or invalid fields (positive integers expected): ${invalid.join(", ")}`);
  }
  return { userId, productId, quantity } as NewOrder;
}

export function createOrder({ userId, productId, quantity }: NewOrder): Promise<Order> {
  return serialize(async () => {
    if (!(await getUser(userId))) throw new HttpError(404, `User ${userId} not found`);
    const product = await getProduct(productId);
    if (!product) throw new HttpError(404, `Product ${productId} not found`);
    if (product.stock < quantity) {
      throw new HttpError(409, `Insufficient stock for product ${productId}: ${product.stock} available`);
    }

    await saveProduct({ ...product, stock: product.stock - quantity });
    const order: Order = {
      id: await nextOrderId(),
      userId,
      productId,
      quantity,
      status: "preparing",
      createdAt: new Date().toISOString(),
    };
    await saveOrder(order);
    return order;
  });
}
