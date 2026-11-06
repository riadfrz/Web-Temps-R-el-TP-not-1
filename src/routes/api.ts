import { Router } from "express";
import { getOrder, getOrders, getProducts, getUsers } from "../db";
import { HttpError, parseId } from "../http";

export const api = Router();

api.get("/users", async (_req, res) => {
  res.json(await getUsers());
});

api.get("/products", async (_req, res) => {
  res.json(await getProducts());
});

api.get("/orders", async (_req, res) => {
  res.json(await getOrders());
});

api.get("/orders/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const order = await getOrder(id);
  if (!order) throw new HttpError(404, `Order ${id} not found`);
  res.json(order);
});
