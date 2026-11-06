const STATUS_LABELS = {
  preparing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const $ = (id) => document.getElementById(id);
const users = new Map();
const products = new Map();
const orders = new Map();

function showMessage(text, isError = false) {
  $("message").textContent = text;
  $("message").classList.toggle("error", isError);
}

function cell(row, content) {
  const td = document.createElement("td");
  if (content instanceof Node) td.append(content);
  else td.textContent = content;
  row.append(td);
}

function button(label, onClick) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function renderProducts() {
  const tbody = $("products");
  const select = $("product-select");
  const selected = select.value;
  tbody.replaceChildren();
  select.replaceChildren();
  for (const p of [...products.values()].sort((a, b) => a.id - b.id)) {
    const row = document.createElement("tr");
    cell(row, p.id);
    cell(row, p.name);
    cell(row, p.stock);
    tbody.append(row);
    select.append(new Option(`${p.name} (stock ${p.stock})`, p.id));
  }
  if (selected) select.value = selected;
}

function renderUsers() {
  $("users").replaceChildren(...[...users.values()].map((u) => new Option(u.name, u.id)));
}

function renderOrders() {
  const tbody = $("orders");
  tbody.replaceChildren();
  for (const o of [...orders.values()].sort((a, b) => b.id - a.id)) {
    const row = document.createElement("tr");
    const status = document.createElement("span");
    status.className = `status ${o.status}`;
    status.textContent = STATUS_LABELS[o.status] ?? o.status;

    const actions = document.createElement("span");
    const link = document.createElement("a");
    link.href = `track.html?id=${o.id}`;
    link.target = "_blank";
    link.textContent = "Suivre";
    actions.append(link, " ");
    if (o.status === "preparing" || o.status === "shipped") {
      actions.append(button("Avancer", () => act(o.id, "advance")), " ");
    }
    if (o.status === "preparing") actions.append(button("Annuler", () => act(o.id, "cancel")));

    cell(row, o.id);
    cell(row, users.get(o.userId)?.name ?? `#${o.userId}`);
    cell(row, products.get(o.productId)?.name ?? `#${o.productId}`);
    cell(row, o.quantity);
    cell(row, status);
    cell(row, actions);
    tbody.append(row);
  }
}

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} — ${body.error}`);
  return body;
}

async function act(id, action) {
  try {
    await request(`/api/orders/${id}/${action}`, { method: "POST" });
    showMessage("");
  } catch (err) {
    showMessage(err.message, true);
  }
}

$("order-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  try {
    const order = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: Number(data.get("userId")),
        productId: Number(data.get("productId")),
        quantity: Number(data.get("quantity")),
      }),
    });
    showMessage(`Commande #${order.id} créée.`);
  } catch (err) {
    showMessage(err.message, true);
  }
});

function listen() {
  const source = new EventSource("/api/events");
  const onOrder = (event) => {
    const order = JSON.parse(event.data);
    orders.set(order.id, order);
    renderOrders();
  };
  source.addEventListener("order-created", onOrder);
  source.addEventListener("order-status", onOrder);
  source.addEventListener("order-cancelled", onOrder);
  source.addEventListener("stock-updated", (event) => {
    const product = JSON.parse(event.data);
    products.set(product.id, product);
    renderProducts();
    renderOrders();
  });
  addEventListener("pagehide", () => source.close());
}

async function start() {
  const [userList, productList, orderList] = await Promise.all([
    request("/api/users"),
    request("/api/products"),
    request("/api/orders"),
  ]);
  userList.forEach((u) => users.set(u.id, u));
  productList.forEach((p) => products.set(p.id, p));
  orderList.forEach((o) => orders.set(o.id, o));
  renderUsers();
  renderProducts();
  renderOrders();
  listen();
}

start().catch((err) => showMessage(err.message, true));
