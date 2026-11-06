import {
  deleteShippedAt,
  getOrder,
  getOrders,
  getProduct,
  getShippedAt,
  getUser,
  nextOrderId,
  saveOrder,
  saveProduct,
  setShippedAt,
} from "../db";
import { HttpError } from "../http";
import type { Order, Status } from "../types";

type NewOrder = Pick<Order, "userId" | "productId" | "quantity">;

const DELIVERY_DELAY_MS = 20_000;

const NEXT_STATUS: Partial<Record<Status, Status>> = {
  preparing: "shipped",
  shipped: "delivered",
};

const deliveryTimers = new Map<number, NodeJS.Timeout>();

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

async function loadOrder(id: number): Promise<Order> {
  const order = await getOrder(id);
  if (!order) throw new HttpError(404, `Order ${id} not found`);
  return order;
}

function clearDeliveryTimer(id: number): void {
  clearTimeout(deliveryTimers.get(id));
  deliveryTimers.delete(id);
}

function scheduleDelivery(id: number, delayMs: number): void {
  clearDeliveryTimer(id);
  const timer = setTimeout(() => {
    deliveryTimers.delete(id);
    autoDeliver(id).catch((err: unknown) => console.error(err));
  }, delayMs);
  deliveryTimers.set(id, timer);
}

// Single place where an order's status changes; must run inside serialize().
async function applyTransition(order: Order, next: Status): Promise<Order> {
  const updated: Order = { ...order, status: next };
  await saveOrder(updated);
  if (next === "shipped") {
    await setShippedAt(order.id, new Date().toISOString());
    scheduleDelivery(order.id, DELIVERY_DELAY_MS);
  } else {
    clearDeliveryTimer(order.id);
    await deleteShippedAt(order.id);
  }
  return updated;
}

export async function restoreDeliveries(): Promise<void> {
  const shipped = (await getOrders()).filter((order) => order.status === "shipped");
  for (const order of shipped) {
    const shippedAt = await getShippedAt(order.id);
    const elapsed = shippedAt ? Date.now() - Date.parse(shippedAt) : DELIVERY_DELAY_MS;
    scheduleDelivery(order.id, Math.max(0, DELIVERY_DELAY_MS - elapsed));
  }
  if (shipped.length > 0) console.log(`Rescheduled delivery of ${shipped.length} shipped order(s)`);
}

function autoDeliver(id: number): Promise<void> {
  return serialize(async () => {
    const order = await getOrder(id);
    // A manual advance may have delivered the order before the timer fired.
    if (order?.status !== "shipped") return;
    await applyTransition(order, "delivered");
  });
}

export function advanceOrder(id: number): Promise<Order> {
  return serialize(async () => {
    const order = await loadOrder(id);
    const next = NEXT_STATUS[order.status];
    if (!next) throw new HttpError(409, `Order ${id} is ${order.status} and cannot advance`);
    return applyTransition(order, next);
  });
}

export function cancelOrder(id: number): Promise<Order> {
  return serialize(async () => {
    const order = await loadOrder(id);
    if (order.status !== "preparing") {
      throw new HttpError(409, `Order ${id} is ${order.status} and cannot be cancelled`);
    }
    const product = await getProduct(order.productId);
    if (product) await saveProduct({ ...product, stock: product.stock + order.quantity });
    return applyTransition(order, "cancelled");
  });
}
