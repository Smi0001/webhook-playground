/* =============================================
   Webhook Dashboard — dashboard.js
   ============================================= */

// Extract UUID from path: /microservices/webhook/:uuid
const pathParts = window.location.pathname.split('/');
const UUID = pathParts[pathParts.length - 1];
const BASE_URL = `${window.location.origin}${window.APP_BASE || ''}/microservices/webhook/${UUID}`;

let activeRequestId = null;
let eventSource    = null;
let webhookMeta    = null;   // populated by loadWebhookMeta()

// ─── Utility ─────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + ' ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function methodBadge(method) {
  const m = (method || 'GET').toUpperCase();
  const known = ['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'];
  const cls = known.includes(m) ? `badge-${m}` : 'badge-default';
  return `<span class="badge ${cls}">${escapeHtml(m)}</span>`;
}

let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ─── Toggle collapsible sections ──────────────────────────────────────────────
function toggleSection(id) {
  document.getElementById(id)?.classList.toggle('open');
}

// ─── Sidebar request items ────────────────────────────────────────────────────

function fwdBadgeHtml(req) {
  if (!req.forward_status && !req.forward_error) return '';
  if (req.forward_error) {
    return `<span class="fwd-badge fwd-error" title="${escapeHtml(req.forward_error)}">ERR</span>`;
  }
  const s = req.forward_status;
  if (s >= 200 && s < 300) return `<span class="fwd-badge fwd-ok">${s}</span>`;
  return `<span class="fwd-badge fwd-warn">${s}</span>`;
}

function buildSidebarItem(req) {
  const ip = req.ip_address || '—';
  return `
    <div class="request-item" id="req-${req.id}" onclick="selectRequest(${req.id})">
      <div class="request-item-content">
        <div class="request-item-top">
          ${methodBadge(req.method)}
          <span class="request-item-meta" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${escapeHtml(req.path || '/')}
          </span>
          <span id="fwd-badge-${req.id}">${fwdBadgeHtml(req)}</span>
        </div>
        <div class="request-item-meta">
          <span class="request-item-ip">${escapeHtml(ip)}</span>
          &nbsp;·&nbsp;
          <span>${formatTime(req.received_at)}</span>
        </div>
      </div>
      <button class="delete-req-btn" onclick="deleteRequest(event, ${req.id})" title="Delete">✕</button>
    </div>`;
}

function prependSidebarItem(req) {
  const list = document.getElementById('sidebarList');
  document.getElementById('sidebarEmpty')?.remove();
  const tmp = document.createElement('div');
  tmp.innerHTML = buildSidebarItem(req);
  list.prepend(tmp.firstElementChild);
}

// ─── Load initial requests ────────────────────────────────────────────────────

async function loadRequests() {
  try {
    const res = await fetch(`${window.APP_BASE || ''}/api/webhooks/${UUID}/requests`);
    const list = await res.json();
    const sidebarList = document.getElementById('sidebarList');
    sidebarList.innerHTML = '';

    if (!list.length) {
      sidebarList.innerHTML = `
        <div class="sidebar-empty" id="sidebarEmpty">
          <div class="pulse-ring"></div>
          Waiting for first request…
        </div>`;
      return;
    }

    list.forEach((req) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = buildSidebarItem(req);
      sidebarList.appendChild(tmp.firstElementChild);
    });

    // Auto-select first
    if (list.length > 0) selectRequest(list[0].id);
  } catch (err) {
    console.error('Failed to load requests:', err);
  }
}

// ─── Select & render a request ────────────────────────────────────────────────

async function selectRequest(id) {
  // Highlight in sidebar
  document.querySelectorAll('.request-item').forEach((el) => el.classList.remove('active'));
  document.getElementById(`req-${id}`)?.classList.add('active');
  activeRequestId = id;

  // On mobile, close sidebar after selecting a request
  if (window.innerWidth <= 580) {
    document.querySelector('.sidebar')?.classList.remove('open');
    const toggle = document.getElementById('sidebarToggle');
    if (toggle) toggle.textContent = '☰';
  }

  try {
    const res = await fetch(`${window.APP_BASE || ''}/api/webhooks/${UUID}/requests/${id}`);
    if (!res.ok) throw new Error('Not found');
    const req = await res.json();
    renderDetail(req);
  } catch (err) {
    console.error('Failed to load request detail:', err);
  }
}

function renderDetail(req) {
  document.getElementById('detailEmpty').classList.add('hidden');
  document.getElementById('detailContent').classList.remove('hidden');

  // Summary bar
  const ts = new Date(req.received_at);
  document.getElementById('detailSummary').innerHTML = `
    <div class="detail-summary-field">
      <span class="detail-summary-label">Method</span>
      <span class="detail-summary-value">${methodBadge(req.method)}</span>
    </div>
    <div class="detail-summary-sep"></div>
    <div class="detail-summary-field">
      <span class="detail-summary-label">Path</span>
      <span class="detail-summary-value">${escapeHtml(req.path || '/')}</span>
    </div>
    <div class="detail-summary-sep"></div>
    <div class="detail-summary-field">
      <span class="detail-summary-label">Source IP</span>
      <span class="detail-summary-value">${escapeHtml(req.ip_address || '—')}</span>
    </div>
    <div class="detail-summary-sep"></div>
    <div class="detail-summary-field">
      <span class="detail-summary-label">Received</span>
      <span class="detail-summary-value">${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}</span>
    </div>
    <div class="detail-summary-sep"></div>
    <div class="detail-summary-field">
      <span class="detail-summary-label">Content-Type</span>
      <span class="detail-summary-value">${escapeHtml(req.content_type || '—')}</span>
    </div>`;

  // Headers
  const headers = tryParse(req.headers) || {};
  const headerKeys = Object.keys(headers);
  document.getElementById('headerCount').textContent = headerKeys.length;
  document.getElementById('headersTable').innerHTML = headerKeys.length
    ? headerKeys.map((k) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(headers[k])}</td></tr>`).join('')
    : `<tr><td colspan="2" class="no-data">No headers</td></tr>`;

  // Query params
  const query = tryParse(req.query_params) || {};
  const queryKeys = Object.keys(query);
  document.getElementById('queryCount').textContent = queryKeys.length;
  document.getElementById('queryTable').innerHTML = queryKeys.length
    ? queryKeys.map((k) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(query[k])}</td></tr>`).join('')
    : `<tr><td colspan="2" class="no-data">No query parameters</td></tr>`;

  // Forwarding
  renderForwarding(req);

  // Body
  renderBody(req);
}

function renderBody(req) {
  const block = document.getElementById('bodyBlock');
  if (!req.body) {
    block.innerHTML = `<p class="no-data">No body</p>`;
    return;
  }

  // Prefer pretty-printed parsed JSON; fall back to raw string
  let display = req.body;
  const parsed = tryParse(req.body_parsed ?? req.body);
  if (parsed !== null && typeof parsed === 'object') {
    display = JSON.stringify(parsed, null, 2);
  }

  block.innerHTML = `
    <button class="body-copy-btn" id="bodyCopyBtn">Copy</button>
    <pre>${escapeHtml(display)}</pre>`;
  document.getElementById('bodyCopyBtn').addEventListener('click', () => copyToClipboard(display));
}

function renderForwarding(req) {
  const section = document.getElementById('sectionForwarding');
  const badge   = document.getElementById('fwdStatusBadge');
  const detail  = document.getElementById('fwdDetail');

  // Only show section if this webhook has forwarding (check webhookMeta stored globally)
  if (!webhookMeta?.forward_enabled) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  if (req.forward_error) {
    badge.innerHTML = `<span class="fwd-badge fwd-error">Error</span>`;
    detail.innerHTML = `
      <div class="fwd-row"><span class="fwd-label">Destination</span><span class="fwd-value">${escapeHtml(webhookMeta.forward_url)}</span></div>
      <div class="fwd-row fwd-row-error"><span class="fwd-label">Error</span><span class="fwd-value">${escapeHtml(req.forward_error)}</span></div>`;
  } else if (req.forward_status) {
    const ok = req.forward_status >= 200 && req.forward_status < 300;
    badge.innerHTML = `<span class="fwd-badge ${ok ? 'fwd-ok' : 'fwd-warn'}">${req.forward_status}</span>`;
    detail.innerHTML = `
      <div class="fwd-row"><span class="fwd-label">Destination</span><span class="fwd-value">${escapeHtml(webhookMeta.forward_url)}</span></div>
      <div class="fwd-row"><span class="fwd-label">Response status</span><span class="fwd-value">${req.forward_status}</span></div>`;
  } else {
    badge.innerHTML = `<span class="fwd-badge fwd-pending">Pending…</span>`;
    detail.innerHTML = `
      <div class="fwd-row"><span class="fwd-label">Destination</span><span class="fwd-value">${escapeHtml(webhookMeta.forward_url)}</span></div>
      <div class="fwd-row"><span class="fwd-label">Status</span><span class="fwd-value" style="color:var(--text-muted)">Forwarding in progress…</span></div>`;
  }
}

function tryParse(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') return val; // already parsed (pg returns JSONB as object)
  try { return JSON.parse(val); } catch (_) { return null; }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => showToast('Copy failed.'));
}

// ─── Delete a single request ──────────────────────────────────────────────────

async function deleteRequest(event, id) {
  event.stopPropagation();
  try {
    await fetch(`${window.APP_BASE || ''}/api/webhooks/${UUID}/requests/${id}`, { method: 'DELETE' });
    document.getElementById(`req-${id}`)?.remove();
    if (activeRequestId === id) {
      document.getElementById('detailContent').classList.add('hidden');
      document.getElementById('detailEmpty').classList.remove('hidden');
      activeRequestId = null;
    }
    if (!document.querySelector('.request-item')) {
      document.getElementById('sidebarList').innerHTML = `
        <div class="sidebar-empty" id="sidebarEmpty">
          <div class="pulse-ring"></div>
          Waiting for first request…
        </div>`;
    }
    showToast('Request deleted.');
  } catch (err) {
    showToast('Failed to delete request.');
  }
}

// ─── Clear all requests ───────────────────────────────────────────────────────

async function clearAll() {
  if (!document.querySelector('.request-item')) return;
  if (!confirm('Clear all recorded requests for this webhook?')) return;
  try {
    await fetch(`${window.APP_BASE || ''}/api/webhooks/${UUID}/requests`, { method: 'DELETE' });
    document.getElementById('sidebarList').innerHTML = `
      <div class="sidebar-empty" id="sidebarEmpty">
        <div class="pulse-ring"></div>
        Waiting for first request…
      </div>`;
    document.getElementById('detailContent').classList.add('hidden');
    document.getElementById('detailEmpty').classList.remove('hidden');
    activeRequestId = null;
    showToast('All requests cleared.');
  } catch (err) {
    showToast('Failed to clear requests.');
  }
}

// ─── Delete the webhook itself ────────────────────────────────────────────────

async function deleteWebhook() {
  if (!confirm('Permanently delete this webhook URL and all its data?')) return;
  try {
    await fetch(`${window.APP_BASE || ''}/api/webhooks/${UUID}`, { method: 'DELETE' });
    window.location.href = (window.APP_BASE || '') + '/';
  } catch (err) {
    showToast('Failed to delete webhook.');
  }
}

// ─── SSE: real-time updates ───────────────────────────────────────────────────

function connectSSE() {
  const dot = document.getElementById('connDot');
  eventSource = new EventSource(`${window.APP_BASE || ''}/api/webhooks/${UUID}/stream`);

  eventSource.onopen = () => {
    dot.classList.add('live');
    dot.title = 'Live — receiving requests';
  };

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'new_request') {
        prependSidebarItem(data.request);
      } else if (data.type === 'forward_status') {
        // Update the forwarding badge in the sidebar
        const badgeEl = document.getElementById(`fwd-badge-${data.request_id}`);
        if (badgeEl) {
          const fakeReq = { forward_status: data.forward_status, forward_error: data.forward_error };
          badgeEl.innerHTML = fwdBadgeHtml(fakeReq);
        }
        // If this request is currently open, refresh its forwarding section
        if (activeRequestId === data.request_id) {
          const fakeReq = { forward_status: data.forward_status, forward_error: data.forward_error };
          renderForwarding(fakeReq);
        }
      }
    } catch (_) {}
  };

  eventSource.onerror = () => {
    dot.classList.remove('live');
    dot.title = 'Disconnected — reconnecting…';
  };
}

// ─── Load webhook meta (name, URL for topbar) ─────────────────────────────────

async function loadWebhookMeta() {
  try {
    const res = await fetch(`${window.APP_BASE || ''}/api/webhooks/${UUID}`);
    if (!res.ok) {
      document.title = 'Not Found — Webhook Inspector';
      return;
    }
    const wh = await res.json();
    webhookMeta = wh;
    document.getElementById('webhookName').textContent = wh.name;
    document.getElementById('webhookUrl').textContent = BASE_URL;
    document.title = `${wh.name} — Webhook Inspector`;
  } catch (_) {}
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadWebhookMeta();
  await loadRequests();
  connectSSE();

  // Mobile sidebar toggle
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');

  function updateToggleVisibility() {
    const isMobile = window.innerWidth <= 580;
    sidebarToggle.classList.toggle('hidden', !isMobile);
  }
  updateToggleVisibility();
  window.addEventListener('resize', updateToggleVisibility);

  sidebarToggle.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    sidebarToggle.textContent = isOpen ? '✕' : '☰';
  });

  document.getElementById('copyUrlBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(BASE_URL)
      .then(() => showToast('URL copied!'))
      .catch(() => showToast('Copy failed.'));
  });

  document.getElementById('deleteWebhookBtn').addEventListener('click', deleteWebhook);
  document.getElementById('clearAllBtn').addEventListener('click', clearAll);
});
