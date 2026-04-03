const express = require('express');
const router = express.Router();
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const sse = require('../sse');

// Headers that must not be forwarded (hop-by-hop + host)
const HOP_BY_HOP = new Set([
  'host', 'connection', 'content-length', 'transfer-encoding',
  'keep-alive', 'upgrade', 'proxy-authorization', 'te', 'trailers', 'expect',
]);

// Fire-and-forget: forward the request to the configured destination URL
async function forwardWebhook(webhook, originalHeaders, method, rawBodyBuffer) {
  const uuid = webhook.uuid;

  // Strip hop-by-hop headers before forwarding
  const headers = {};
  for (const [key, val] of Object.entries(originalHeaders)) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers[key] = val;
  }

  const hasBody = rawBodyBuffer && rawBodyBuffer.length > 0
    && method !== 'GET' && method !== 'HEAD';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000); // 15 s timeout

    const response = await fetch(webhook.forward_url, {
      method,
      headers,
      body: hasBody ? rawBodyBuffer : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    await db.query(
      'UPDATE webhook_requests SET forward_status = $1 WHERE id = $2',
      [response.status, webhook._recorded_id]
    );

    sse.broadcast(uuid, {
      type: 'forward_status',
      request_id: webhook._recorded_id,
      forward_status: response.status,
      forward_error: null,
    });
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Timed out after 15 s' : err.message;
    await db.query(
      'UPDATE webhook_requests SET forward_error = $1 WHERE id = $2',
      [msg, webhook._recorded_id]
    );
    sse.broadcast(uuid, {
      type: 'forward_status',
      request_id: webhook._recorded_id,
      forward_status: null,
      forward_error: msg,
    });
  }
}

// All HTTP methods are captured at /microservices/webhook/:uuid
// Exception: GET with text/html Accept header → serve the dashboard UI
router.all('/:uuid', async (req, res) => {
  const { uuid } = req.params;

  // Browser detection — serve the dashboard page instead of recording
  const accept = req.headers['accept'] || '';
  if (req.method === 'GET' && accept.includes('text/html')) {
    return res.sendFile(path.join(__dirname, '../../public/webhook.html'));
  }

  try {
    // Load the webhook record
    const wResult = await db.query('SELECT * FROM webhooks WHERE uuid = $1', [uuid]);
    if (!wResult.rows.length) {
      return res.status(404).json({ error: 'Webhook URL not found' });
    }
    const webhook = wResult.rows[0];

    // Per-webhook basic auth check
    if (webhook.basic_auth_enabled) {
      const authHeader = req.headers['authorization'] || '';
      if (!authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Webhook"');
        return res.status(401).json({ error: 'Authentication required' });
      }
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
      const colonIdx = decoded.indexOf(':');
      const username = decoded.slice(0, colonIdx);
      const password = decoded.slice(colonIdx + 1);

      if (username !== webhook.basic_auth_username) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Webhook"');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const ok = await bcrypt.compare(password, webhook.basic_auth_password);
      if (!ok) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Webhook"');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Parse body — req.body is a Buffer (express.raw is applied upstream)
    const rawBodyBuffer = (req.body && Buffer.isBuffer(req.body) && req.body.length > 0)
      ? req.body : null;
    const rawBody = rawBodyBuffer ? rawBodyBuffer.toString('utf-8') : null;

    let parsedBody = null;
    const contentType = (req.headers['content-type'] || '').toLowerCase();
    if (rawBody) {
      if (contentType.includes('application/json')) {
        try { parsedBody = JSON.parse(rawBody); } catch (_) {}
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        try { parsedBody = Object.fromEntries(new URLSearchParams(rawBody)); } catch (_) {}
      }
    }

    // Determine client IP (handle proxies)
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      null;

    // Record the incoming request
    const { rows } = await db.query(
      `INSERT INTO webhook_requests
         (webhook_id, method, path, headers, body, body_parsed, query_params, ip_address, content_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        webhook.id,
        req.method,
        req.path === '/' ? null : req.path,
        JSON.stringify(req.headers),
        rawBody,
        parsedBody !== null ? JSON.stringify(parsedBody) : null,
        JSON.stringify(req.query),
        ip,
        contentType || null,
      ]
    );

    const recorded = rows[0];

    // Respond immediately — don't wait for forwarding
    sse.broadcast(uuid, { type: 'new_request', request: recorded });
    res.status(200).json({ success: true, id: recorded.id });

    // Kick off forwarding asynchronously (fire-and-forget)
    if (webhook.forward_enabled && webhook.forward_url) {
      webhook._recorded_id = recorded.id;
      forwardWebhook(webhook, req.headers, req.method, rawBodyBuffer).catch(() => {});
    }
  } catch (err) {
    console.error('Webhook receiver error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
