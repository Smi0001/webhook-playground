# webhook-playground

Self-hosted microservice to use as webhook inspection and testing tool. Capture, inspect, and debug incoming HTTP requests in real time — like a private Webhook Collection that you run yourself.
<br/>
Built with Express.js, PostgreSQL, and Server-Sent Events (SSE) for live updates.

---

## 📋 Table of contents

- [✨ Features](#-features)
- [🔧 Requirements](#-requirements)
- [🗄️ Prerequisites: Set up a PostgreSQL database](#️-prerequisites-set-up-a-postgresql-database)
- [📦 Installation](#-installation)
- [🚀 Global install usage](#-global-install-usage)
- [⚙️ Usage](#️-usage)
- [🌐 Deploying behind a reverse proxy (Nginx)](#-deploying-behind-a-reverse-proxy-nginx)
- [💻 CLI reference](#-cli-reference)
- [📡 API reference](#-api-reference)
- [🪝 Webhook receiver](#-webhook-receiver)
- [🗂️ Project structure](#️-project-structure)
- [🆕 What's new](#-whats-new)
- [📄 License](#-license)

---

## ✨ Features

- Create named webhook endpoints with unique URLs
- Capture any HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
- Inspect headers, body, query params, and IP in real time via SSE
- Optional per-webhook Basic Auth protection
- Web dashboard UI included
- Stores request history (up to 200 per webhook)
- Forward incoming requests to any target URL and capture the response

---

## 🔧 Requirements

- Node.js >= 18
- PostgreSQL database

---

## 🗄️ Prerequisites: Set up a PostgreSQL database

Before running the app, create a dedicated database and user:

```bash
psql -U postgres
```

```sql
CREATE DATABASE webhook_db;
CREATE USER webhook_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE webhook_db TO webhook_user;
\q
```

Then use these credentials in your `.env`:

```env
DATABASE_URL=postgresql://webhook_user:yourpassword@localhost:5432/webhook_db
```

---

## 📦 Installation

### Global install (recommended for team/internal use)

```bash
npm install -g webhook-playground
```

### Or run without installing

```bash
npx webhook-playground
```

---

## 🚀 Global install usage

After installing globally, create a working directory, add your `.env` file there, and run all commands from that directory:

```bash
mkdir my-webhooks && cd my-webhooks
```

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/webhook_db
PORT=3000
BASE_URL=http://localhost:3000
```

> Replace `user`, `password`, and `webhook_db` with your actual PostgreSQL credentials.

Run migrations once:

```bash
webhook-play migrate
```

Start the server:

```bash
webhook-play
```

---

## ⚙️ Usage

### 1. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

```env
DATABASE_URL=postgresql://user:password@localhost:5432/webhook_db
PORT=3000
BASE_URL=http://localhost:3000
```

| Variable       | Required | Description                                              |
|----------------|----------|----------------------------------------------------------|
| `DATABASE_URL` | Yes      | PostgreSQL connection string                             |
| `PORT`         | No       | Port to listen on (default: `3000`)                      |
| `BASE_URL`     | No       | Public-facing URL shown in the dashboard for webhook URLs |
| `BASE_PATH`    | No       | Sub-path prefix when served under a nested route (e.g. `/webhook`). See [reverse proxy setup](#-deploying-behind-a-reverse-proxy-nginx). |
| `DB_SSL`       | No       | Set to `true` to enable SSL for the DB connection        |

### 2. Run database migrations

```bash
webhook-play migrate
```

This creates the required tables (`webhooks`, `webhook_requests`) in your database.

### 3. Start the server

```bash
webhook-play
# or
webhook-play start
```

To run on a custom port:

```bash
PORT=8080 webhook-play
```

```
Webhook microservice running at http://localhost:8080
```

Open `http://localhost:8080` in your browser to access the dashboard.

---

## 🌐 Deploying behind a reverse proxy (Nginx)

### Root deployment (app served at `/`)

Use this when webhook-playground is the only app on the domain or subdomain (e.g. `https://webhooks.example.com`).

The app runs on its internal port (default `3000`) and Nginx forwards all traffic to it.

```nginx
server {
    listen 80;
    server_name webhooks.example.com;

    location / {
        proxy_pass      http://127.0.0.1:3000;
        proxy_set_header Host $host;
        include proxy_params;
    }
}
```

No `BASE_PATH` needed in `.env` for this setup.

---

### Sub-path deployment (app served at a nested route)

Use this when webhook-playground shares a domain with another app — for example, your main app is already at `/` and you want webhook-playground accessible at `/webhook`.

**When to use:** The server already has an Nginx config routing `/` or `/api/` to a different application, and you need webhook-playground to live alongside it under its own path prefix.

**1. Add to your `.env`:**

```env
BASE_PATH=/webhook
```

**2. Add to your Nginx config** — place these blocks before any existing `location /api/` block, since Nginx matches more specific locations first:

```nginx
# Redirect /webhook to /webhook/ (trailing slash required)
location = /webhook {
    return 301 /webhook/;
}

# Proxy all /webhook/ traffic to the webhook-playground app
location /webhook/ {
    proxy_pass      http://127.0.0.1:3000/webhook/;
    proxy_set_header Host $host;
    include proxy_params;
}
```

**3. Reload Nginx:**

```bash
sudo nginx -t && sudo systemctl reload nginx
```

The app will then be accessible at `https://yourdomain.com/webhook/`.

> **Note:** The `BASE_PATH` value must match the Nginx `location` prefix exactly (e.g. both must be `/webhook`).

---

### 🩺 Health check endpoint

Useful for verifying a fresh install without needing any existing data:

```
GET /api/health
```

Returns `200 { "status": "ok", "db": "connected" }` when the app and database are both reachable. Returns `503` if the database is unreachable.

With a sub-path deployment: `GET /webhook/api/health`

---

## 💻 CLI reference

```
webhook-play              Start the server
webhook-play start        Start the server (explicit)
webhook-play migrate      Run database migrations
```

---

## 📡 API reference

| Method   | Endpoint                               | Description                        |
|----------|----------------------------------------|------------------------------------|
| `GET`    | `/api/health`                          | Health check (app + DB status)     |
| `POST`   | `/api/webhooks`                        | Create a new webhook               |
| `GET`    | `/api/webhooks`                        | List all webhooks                  |
| `GET`    | `/api/webhooks/:uuid`                  | Get a single webhook               |
| `PUT`    | `/api/webhooks/:uuid`                  | Update webhook name / auth         |
| `DELETE` | `/api/webhooks/:uuid`                  | Delete a webhook                   |
| `GET`    | `/api/webhooks/:uuid/requests`         | List captured requests (max 200)   |
| `GET`    | `/api/webhooks/:uuid/requests/:id`     | Get a single request               |
| `DELETE` | `/api/webhooks/:uuid/requests/:id`     | Delete a single request            |
| `DELETE` | `/api/webhooks/:uuid/requests`         | Clear all requests for a webhook   |
| `GET`    | `/api/webhooks/:uuid/stream`           | SSE stream for real-time updates   |
| `*`      | `/microservices/webhook/:uuid`         | Webhook receiver endpoint          |

> When using `BASE_PATH`, all endpoints are prefixed — e.g. `/webhook/api/health`, `/webhook/microservices/webhook/:uuid`.

---

## 🪝 Webhook receiver

Send any HTTP request to:

```
POST http://localhost:3000/microservices/webhook/<uuid>
```

The request is recorded immediately and pushed to any open dashboard via SSE.

If Basic Auth is enabled on the webhook, include credentials:

```bash
curl -u username:password \
  -X POST http://localhost:3000/microservices/webhook/<uuid> \
  -H "Content-Type: application/json" \
  -d '{"event": "order.created", "id": 42}'
```

---

## 🗂️ Project structure

```
webhook-microservice/
├── bin/
│   └── cli.js               # CLI entry point (webhook-play command)
├── migrations/
│   ├── migrate.js            # Migration runner
│   └── schema.sql            # Database schema
├── public/
│   ├── css/style.css
│   ├── js/
│   │   ├── dashboard.js      # Webhook dashboard UI logic
│   │   └── landing.js        # Landing page logic
│   ├── index.html            # Landing page
│   └── webhook.html          # Per-webhook dashboard
├── src/
│   ├── app.js                # Express app setup & server entry
│   ├── config/
│   │   └── database.js       # PostgreSQL pool
│   ├── routes/
│   │   ├── api.js            # REST API routes
│   │   └── webhookReceiver.js# Incoming webhook handler
│   └── sse.js                # Server-Sent Events manager
├── .env.example
└── package.json
```

---

## 🆕 What's new

### 2.1.2
- ➕ Added `BASE_PATH` environment variable support — serve the app under a sub-path (e.g. `/webhook`) when sharing a domain with another application
- 🔗 All frontend API calls and navigation use the base path automatically via injected `window.APP_BASE`
- 🛠️ HTML asset paths updated to be relative, resolving correctly at any prefix depth
- 📝 Added Nginx reverse proxy documentation for both root and sub-path deployments

### 2.1.1
- ➕ Added `GET /api/health` endpoint — returns app and database status without requiring any existing data; useful for verifying a fresh install

### 2.1.0
- ➕ Added request forwarding — forward incoming webhook requests to any destination URL and capture the response status
- 📡 Forward status shown in the dashboard in real time via SSE

### 2.0.1
- 📝 Documentation improvements: PostgreSQL setup prerequisites, credential placeholder notes

### 2.0.0
- 🎉 Rebranded package to `webhook-playground`
- 🔄 CLI command renamed to `webhook-play`
- 🚀 Added global install support with working directory workflow

### 1.0.2
- 🐛 Fixed README CLI command references

### 1.0.1
- 🔄 Renamed CLI command from `webhook-ms` to `webhook-play`

### 1.0.0
- 🎉 Initial release — webhook inspection microservice with Express.js, PostgreSQL, SSE real-time updates, Basic Auth support, and web dashboard UI

---

## 📄 License

MIT
