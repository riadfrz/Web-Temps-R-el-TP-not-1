import path from "node:path";
import { Config, JsonDB } from "node-json-db";
import type { Order, Product, User } from "./types";

const DB_FILE = path.join(process.cwd(), "data", "db.json");

const db = new JsonDB(new Config(DB_FILE, true, true, "/"));

async function list<T>(collection: string): Promise<T[]> {
  const items = await db.getObjectDefault<Record<string, T>>(`/${collection}`, {});
  return Object.values(items);
}

async function find<T>(collection: string, id: number): Promise<T | undefined> {
  return db.getObjectDefault<T | undefined>(`/${collection}/${id}`, undefined);
}

async function save<T extends { id: number }>(collection: string, item: T): Promise<void> {
  await db.push(`/${collection}/${item.id}`, item, true);
}

export const getUsers = () => list<User>("users");
export const getUser = (id: number) => find<User>("users", id);
export const saveUser = (user: User) => save("users", user);

export const getProducts = () => list<Product>("products");
export const getProduct = (id: number) => find<Product>("products", id);
export const saveProduct = (product: Product) => save("products", product);

export const getOrders = () => list<Order>("orders");
export const getOrder = (id: number) => find<Order>("orders", id);
export const saveOrder = (order: Order) => save("orders", order);

export async function nextOrderId(): Promise<number> {
  const id = (await db.getObjectDefault<number>("/nextOrderId", 0)) + 1;
  await db.push("/nextOrderId", id, true);
  return id;
}
