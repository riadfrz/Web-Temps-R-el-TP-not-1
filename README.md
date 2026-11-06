# Web Temps Réel — TP noté 1 : suivi de commandes (SSE)

Dépôt Git : https://github.com/riadfrz/Web-Temps-R-el-TP-not-1

## Lancement

```bash
docker compose up --build -d
```

- Boutique : http://localhost:3000/ (créer une commande, puis lien « Suivre »)
- Suivi d'une commande : `http://localhost:3000/track.html?id=<id>` avec l'id d'une commande existante (aucune commande au premier démarrage)

Données persistées avec JsonDB dans le volume Docker `data` (réinitialiser : `docker compose down -v`). Au premier démarrage : 2 utilisateurs, 3 produits.

## Livraison automatique

Une commande expédiée passe seule au statut `delivered` 20 secondes après son expédition, et l'événement est poussé en SSE. La date d'expédition est persistée : après un redémarrage du serveur, la livraison est reprogrammée avec le délai restant (immédiate si le délai est dépassé). Une livraison manuelle avant les 20 s annule le minuteur.

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

`/api/orders/:id/events` ne reçoit que les événements de cette commande (tri côté serveur). Un abonné est retiré dès que sa connexion se ferme.

Reconnexion : chaque flux commence par `retry: 5000`, le navigateur attend 5 s avant chaque tentative de reconnexion.

Fin de suivi : quand la commande est livrée ou annulée, le serveur termine le flux de la commande et la page de suivi ferme son `EventSource` : plus aucune reconnexion.

Heartbeat : un commentaire `: ping` est envoyé toutes les 15 s sur chaque flux, pour qu'un proxy coupant les connexions inactives au bout de 30 s ne ferme pas la connexion.

