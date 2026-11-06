import { getProducts, getUsers, saveProduct, saveUser } from "./db";
import type { Product, User } from "./types";

const users: User[] = [
  { id: 1, name: "Alice Martin", username: "alice", email: "alice@example.com" },
  { id: 2, name: "Bob Durand", username: "bob", email: "bob@example.com" },
];

const products: Product[] = [
  { id: 1, name: "Clavier mécanique", stock: 10 },
  { id: 2, name: "Souris sans fil", stock: 5 },
  { id: 3, name: "Écran 27 pouces", stock: 2 },
];

export async function seed(): Promise<void> {
  if ((await getUsers()).length === 0) {
    for (const user of users) await saveUser(user);
    console.log(`Seeded ${users.length} users`);
  }
  if ((await getProducts()).length === 0) {
    for (const product of products) await saveProduct(product);
    console.log(`Seeded ${products.length} products`);
  }
}
