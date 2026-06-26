# Routes

## CRUD Resources

- **`/api/feeds`** GET | POST | GET/:id | DELETE/:id → Feed

## Other Routes

- `GET` `/` params() [auth, db]
- `GET` `/health` params() [auth, db]
- `GET` `/api/stats` params() [auth, db]
- `GET` `/api/timeline` params() [auth, db]
- `GET` `/api/posts` params() [auth, db]
- `GET` `/api/profiles/:pk` params(pk) [auth, db]
- `GET` `/api/nft` params() [auth, db]
- `GET` `/api/nft/:id` params(id) [auth, db]
- `GET` `/api/rss/youtube/:channelId` params(channelId) [auth, db]
- `POST` `/api/refresh` params() [auth, db]
- `POST` `/api/contrib` params() [auth, db]
- `GET` `/api/points/:pk` params(pk) [auth, db]
- `GET` `/api/leaderboard` params() [auth, db]
- `GET` `/api/whoami` params() [auth, db]
- `GET` `/api/node` params() [auth, db]
- `GET` `/api/consent` params() [auth, db]
- `GET` `/dashboard` params() [auth, db]
