# webhook-microservice

Self-hosted webhook inspection and testing tool. Capture, inspect, and debug incoming HTTP requests in real time — like a private [webhook.site](https://webhook.site) you run yourself.

Built with Express.js, PostgreSQL, and Server-Sent Events (SSE) for live updates.

---

## Features

- Create named webhook endpoints with unique URLs
- Capture any HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
- Inspect headers, body, query params, and IP in real time via SSE
- Optional per-webhook Basic Auth protection
- Web dashboard UI included
- Stores request history (up to 200 per webhook)

---

## Requirements

- Node.js >= 18
- PostgreSQL database

---

## Installation

### Global install (recommended for team/internal use)

```bash
npm install -g webhook-microservice
```

### Or run without installing

```bash
npx webhook-microservice
```

---

## Usage after publishing

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
| `DB_SSL`       | No       | Set to `true` to enable SSL for the DB connection        |

### 2. Run database migrations

```bash
webhook-ms migrate
```

This creates the required tables (`webhooks`, `webhook_requests`) in your database.

### 3. Start the server

```bash
webhook-ms
# or
webhook-ms start
```

```
Webhook microservice running at http://localhost:3000
```

Open `http://localhost:3000` in your browser to access the dashboard.

---

## CLI reference

```
webhook-ms              Start the server
webhook-ms start        Start the server (explicit)
webhook-ms migrate      Run database migrations
```

---

## API reference

| Method   | Endpoint                               | Description                        |
|----------|----------------------------------------|------------------------------------|
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

---

## Webhook receiver

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

## Project structure

```
webhook-microservice/
├── bin/
│   └── cli.js               # CLI entry point (webhook-ms command)
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

## Publishing to npm

```bash
# Log in to npm
npm login

# Preview what will be published
npm publish --dry-run

# Publish
npm publish
```

To release a new version:

```bash
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
npm publish
```

---

## License

MIT
