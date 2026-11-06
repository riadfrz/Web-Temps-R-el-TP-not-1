# Web Temps Réel — TP noté 1 : suivi de commandes (SSE)

Dépôt Git : https://github.com/riadfrz/Web-Temps-R-el-TP-not-1

## Lancement

```bash
docker compose up --build -d
```

- Boutique : http://localhost:3000/
- Suivi d'une commande : http://localhost:3000/track.html?id=1

Données persistées avec JsonDB dans le volume Docker `data` (réinitialiser : `docker compose down -v`).

## API REST

Les erreurs renvoient `{ "error": "message" }`.

| Verbe | Route | Succès | Erreurs |
|---|---|---|---|
| GET | `/api/users` | 200 | — |
| GET | `/api/products` | 200 | — |
| GET | `/api/orders` | 200 | — |
| GET | `/api/orders/:id` | 200 | 400 id invalide, 404 inconnue |
| POST | `/api/orders` `{ userId, productId, quantity }` | 201 | 400 champ manquant/invalide, 404 client ou produit inconnu, 409 stock insuffisant |
| POST | `/api/orders/:id/advance` | 200 | 400, 404, 409 commande livrée ou annulée |
| POST | `/api/orders/:id/cancel` | 200 | 400, 404, 409 commande expédiée, livrée ou déjà annulée |
| GET | `/api/events` | flux SSE global | — |
| GET | `/api/orders/:id/events` | flux SSE de la commande | 400, 404 |

## Événements SSE

| Événement | Données |
|---|---|
| `order-created` | `Order` |
| `order-status` | `Order` (changement de statut, état courant à la connexion) |
| `order-cancelled` | `Order` |
| `stock-updated` | `Product` |

`/api/orders/:id/events` ne reçoit que les événements de cette commande (tri côté serveur).

