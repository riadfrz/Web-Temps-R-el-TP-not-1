import path from "node:path";
import express from "express";
import { errorHandler } from "./http";
import { api } from "./routes/api";
import { seed } from "./seed";
import { restoreDeliveries } from "./services/orders";

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", api);
app.use(errorHandler);

async function start(): Promise<void> {
  await seed();
  await restoreDeliveries();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
