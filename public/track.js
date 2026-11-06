const STATUS_LABELS = {
  preparing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const FINAL_STATUSES = ["delivered", "cancelled"];

const $ = (id) => document.getElementById(id);
const orderId = new URLSearchParams(location.search).get("id");

function setConnection(text, isError = false) {
  $("connection").textContent = text;
  $("connection").classList.toggle("error", isError);
}

function log(text) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString("fr-FR")} — ${text}`;
  $("log").prepend(item);
}

function render(order) {
  const status = $("status");
  status.textContent = STATUS_LABELS[order.status] ?? order.status;
  status.className = `status ${order.status}`;
  $("quantity").textContent = order.quantity;
  $("created-at").textContent = new Date(order.createdAt).toLocaleString("fr-FR");
}

async function showProductName(productId) {
  const response = await fetch("/api/products");
  if (!response.ok) return;
  const product = (await response.json()).find((p) => p.id === productId);
  $("product").textContent = product ? product.name : `#${productId}`;
}

function connect() {
  const source = new EventSource(`/api/orders/${encodeURIComponent(orderId)}/events`);
  let productLoaded = false;

  const onOrder = (event) => {
    const order = JSON.parse(event.data);
    render(order);
    log(`${event.type} : ${STATUS_LABELS[order.status] ?? order.status}`);
    if (!productLoaded) {
      productLoaded = true;
      showProductName(order.productId);
    }
    if (FINAL_STATUSES.includes(order.status)) {
      source.close();
      setConnection("Suivi terminé");
    }
  };

  source.addEventListener("order-status", onOrder);
  source.addEventListener("order-cancelled", onOrder);
  source.addEventListener("open", () => setConnection("Connecté — mises à jour en direct"));
  source.addEventListener("error", () => {
    if (source.readyState === EventSource.CLOSED) setConnection("Connexion fermée", true);
    else setConnection("Connexion perdue — reconnexion…", true);
  });

  addEventListener("pagehide", () => source.close());
}

async function start() {
  if (!orderId) {
    setConnection("Paramètre ?id manquant dans l'URL", true);
    return;
  }
  $("order-id").textContent = `#${orderId}`;

  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
  if (!response.ok) {
    const { error } = await response.json();
    setConnection(error, true);
    return;
  }
  connect();
}

start();
