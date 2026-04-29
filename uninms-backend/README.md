# UniNMS — Backend API

**National Intelligence Knowledge Management System**  
Node.js / Express / PostgreSQL / Redis

---

## Quick Start (5 minutes)

### 1. Prerequisites
- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- VS Code (recommended)

### 2. Start the database

```bash
docker compose up postgres redis -d
```

Wait ~15 seconds, then verify:
```bash
docker compose ps
```
Both `uninms_postgres` and `uninms_redis` should show **healthy**.

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and update the two JWT secrets:
```
JWT_ACCESS_SECRET=any-long-random-string-min-32-chars
JWT_REFRESH_SECRET=a-different-long-random-string-32-chars
```

Everything else works with the defaults for local development.

### 4. Install, migrate, seed

```bash
npm install
npm run migrate
npm run seed
```

### 5. Start the API

```bash
npm run dev
```

Open `http://localhost:3000/health` — you should see:
```json
{"status":"ok","database":"connected","redis":"connected"}
```

---

## Default Login

```
Email:    admin@uninms.edu.ng
Password: Admin@UniNMS2024!
```

**Change this immediately in any non-local environment.**

---

## Testing API calls

Open `test.http` in VS Code with the **REST Client** extension installed.  
Click **Send Request** above any block to fire it. After login, paste  
your `accessToken` into the `@token` variable at the top of the file.

---

## Available Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /api/v1/auth/register | Create account |
| POST | /api/v1/auth/login | Login |
| POST | /api/v1/auth/logout | Logout |
| POST | /api/v1/auth/refresh | Refresh token |
| GET | /api/v1/auth/me | Current user |
| GET | /api/v1/documents | List documents |
| GET | /api/v1/documents/:id | Get document |
| GET | /api/v1/documents/:id/download | Download link |
| GET | /api/v1/search | Full-text search |
| POST | /api/v1/search/semantic | Semantic search (requires OpenAI key) |
| GET | /api/v1/users/me | My profile |
| PATCH | /api/v1/users/me | Update profile |
| GET | /api/v1/users/:id/profile | Public profile |
| GET | /api/v1/users/:id/points | Points & level |
| GET | /api/v1/analytics/me | My stats |
| GET | /api/v1/analytics/university | University stats (admin) |
| GET | /api/v1/notifications | My notifications |
| PATCH | /api/v1/notifications/:id/read | Mark read |
| POST | /api/v1/notifications/read-all | Mark all read |
| GET | /api/v1/forums/threads | List threads |
| POST | /api/v1/forums/threads | Create thread |
| GET | /api/v1/forums/threads/:id | Get thread with posts |
| POST | /api/v1/forums/threads/:id/posts | Reply to thread |
| POST | /api/v1/forums/posts/:id/upvote | Upvote a post |
| GET | /api/v1/intelligence/gaps | Research gaps |
| POST | /api/v1/intelligence/gaps | Submit a gap |
| POST | /api/v1/intelligence/gaps/detect | Run gap detection (admin) |
| GET | /api/v1/intelligence/leaderboard | University rankings |
| GET | /api/v1/intelligence/collaborators | Suggested collaborators |
| GET | /api/v1/intelligence/recommendations | VC recommendations (admin) |

---

## Reset everything

```bash
docker compose down -v     # wipes all data
docker compose up postgres redis -d
npm run migrate
npm run seed
```

---

## Project Structure

```
src/
├── server.js          Main entry point — routes, middleware, error handler
├── config/
│   ├── database.js    PostgreSQL connection pool
│   └── redis.js       Redis client
├── middleware/
│   └── auth.js        JWT authentication, role checking
├── routes/
│   ├── auth.js        Register, login, logout, refresh, me
│   ├── documents.js   CRUD + download
│   ├── search.js      Full-text + semantic search
│   ├── users.js       Profile, points
│   ├── analytics.js   Personal + university stats
│   ├── notifications.js
│   ├── forums.js      Threads, posts, upvotes
│   └── intelligence.js Gaps, leaderboard, recommendations
└── utils/
    ├── AppError.js    Operational error class
    └── logger.js      Winston logger

migrations/
├── 001_initial_schema.sql   Users, documents, tags, points
└── 002_extended_schema.sql  Forums, mentorship, handover, intelligence

scripts/
├── migrate.js    Runs all pending migrations
└── seed.js       Creates admin user, university, tags
```
