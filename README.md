# Cost Manager – RESTful Web Services (Final Project)

Four independent Node.js microservices + shared MongoDB Atlas database.

| Process | Service | Default port | Endpoints |
|---------|---------|--------------|-----------|
| A | `logs-service` | 3001 | `GET /api/logs` |
| B | `users-service` | 3002 | `POST /api/add`, `GET /api/users`, `GET /api/users/:id` |
| C | `costs-service` | 3003 | `POST /api/add`, `GET /api/report` |
| D | `about-service` | 3004 | `GET /api/about` |

Stack: **Express.js**, **Mongoose**, **Pino**, **dotenv**, plain **JavaScript** (no TypeScript).

---

## 1. MongoDB Atlas

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user and allow network access (`0.0.0.0/0` for Railway).
3. Copy the connection string, e.g.  
   `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/cost_manager?retryWrites=true&w=majority`

---

## 2. Local setup

```bash
cd cost-manager
npm run install:all
```

Create a `.env` file in the **root** and inside **each** service folder (or copy from `.env.example`):

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/cost_manager?retryWrites=true&w=majority
TEAM_MEMBER_1_FIRST=Linoy
TEAM_MEMBER_1_LAST=Ezra
TEAM_MEMBER_2_FIRST=Dudu
TEAM_MEMBER_2_LAST=Dorani
```

Seed the submission user (empty DB + `mosh israeli`):

```bash
# from cost-manager root, with MONGODB_URI in .env
npm run seed
```

Run all four processes locally:

```bash
npm run start:all
```

Or start one service at a time:

```bash
npm run start:logs
npm run start:users
npm run start:costs
npm run start:about
```

---

## 3. Deploy on Railway (recommended: 4 services)

Create **four** Railway services from the same GitHub repo (or four separate deploys), each with a different **Root Directory**:

1. `cost-manager/logs-service`
2. `cost-manager/users-service`
3. `cost-manager/costs-service`
4. `cost-manager/about-service`

For **each** Railway service:

1. Settings → Root Directory → set as above.
2. Build: `npm install`
3. Start: `npm start` (Railway injects `PORT` automatically).
4. Variables:
   - `MONGODB_URI` = your Atlas URI (same for all four)
   - For about-service also set `TEAM_MEMBER_1_FIRST`, `TEAM_MEMBER_1_LAST`, `TEAM_MEMBER_2_FIRST`, `TEAM_MEMBER_2_LAST`
5. Generate a public domain for each service.

You will get four URLs, for example:

- `a` (logs)  → `https://logs-service-xxxx.up.railway.app`
- `b` (users) → `https://users-service-xxxx.up.railway.app`
- `c` (costs) → `https://costs-service-xxxx.up.railway.app`
- `d` (about) → `https://about-service-xxxx.up.railway.app`

Paste these into the course form and into `tests/grading_sample.py`.

Before submission, run `npm run seed` once more so the DB contains only user `123123`.

---

## 4. Quick manual checks

```bash
# About
curl https://YOUR-ABOUT/api/about/

# Users
curl https://YOUR-USERS/api/users
curl https://YOUR-USERS/api/users/123123

# Costs – add + report
curl -X POST https://YOUR-COSTS/api/add/ -H "Content-Type: application/json" -d "{\"userid\":123123,\"description\":\"milk 9\",\"category\":\"food\",\"sum\":8}"
curl "https://YOUR-COSTS/api/report/?id=123123&year=2026&month=1"

# Logs
curl https://YOUR-LOGS/api/logs
```

---

## 5. Tests

Node unit/integration tests (in-memory MongoDB):

```bash
npm run install:all
npm test
```

Course-style Python sample (services must be running):

```bash
pip install requests
python tests/grading_sample.py
```

---

## 6. Computed Design Pattern

Past-month reports are computed once, stored in the `reports` collection, and reused on later requests. Current/future months are always computed live. Adding a cost with a past date is rejected.

---

## 7. Team

- Linoy Ezra
- Dudu Dorani

Update names in `about-service/.env` if needed.
