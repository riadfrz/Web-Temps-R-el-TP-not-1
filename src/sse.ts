import type { Request, Response } from "express";

export type OrderEvent = "order-created" | "order-status" | "order-cancelled";
export type StockEvent = "stock-updated";
export type EventName = OrderEvent | StockEvent;

type Subscriber = {
  res: Response;
  orderId?: number;
};

const RETRY_MS = 5_000;

const subscribers = new Set<Subscriber>();

export function writeEvent(res: Response, event: EventName, data: unknown, id?: string): void {
  let frame = "";
  if (id !== undefined) frame += `id: ${id}\n`;
  frame += `event: ${event}\n`;
  frame += `data: ${JSON.stringify(data)}\n\n`;
  res.write(frame);
}

export function subscribe(req: Request, res: Response, orderId?: number): Subscriber {
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(`retry: ${RETRY_MS}\n\n`);

  const subscriber: Subscriber = { res, orderId };
  subscribers.add(subscriber);
  console.log(`SSE subscriber added (${subscribers.size} connected)`);

  req.on("close", () => {
    subscribers.delete(subscriber);
    console.log(`SSE subscriber removed (${subscribers.size} connected)`);
  });

  return subscriber;
}

// Unfiltered subscribers receive everything; filtered ones only their order's events.
export function broadcast(event: EventName, data: unknown, orderId?: number): void {
  for (const subscriber of subscribers) {
    if (subscriber.orderId === undefined || subscriber.orderId === orderId) {
      writeEvent(subscriber.res, event, data);
    }
  }
}
