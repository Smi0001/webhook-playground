/* =============================================
   Landing Page — landing.js
   ============================================= */

const BASE   = window.location.origin;
const PREFIX = `${BASE}${window.APP_BASE || ''}/microservices/webhook/`;

let currentUuid  = '';
let allWebhooks  = [];        // full list from API
let selectedUuids = new Set(); // currently checked UUIDs

// ---------- UUID helpers ----------
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function refreshUuid() {
  currentUuid = generateUUID();
  document.getElementById('urlUuid').textContent   = currentUuid;
  document.getElementById('urlPrefix').textContent = PREFIX;
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- Escape ----------
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ---------- Render one webhook row ----------
function renderWebhookItem(wh) {
  const url      = `${PREFIX}${wh.uuid}`;
  const checked  = selectedUuids.has(wh.uuid) ? 'checked' : '';
  const authBadge = wh.basic_auth_enabled
    ? `<span style="font-size:10px;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 6px;font-weight:600;">AUTH</span>`
    : '';
  const fwdBadge = wh.forward_enabled
    ? `<span style="font-size:10px;background:#e0f2fe;color:#075985;border-radius:4px;padding:1px 6px;font-weight:600;">FWD</span>`
    : '';
  return `
    <div class="webhook-item" id="wh-${escapeHtml(wh.uuid)}">
      <label class="wh-check-wrap" title="Select">
        <input type="checkbox" class="wh-check" data-uuid="${escapeHtml(wh.uuid)}" ${checked}
               onchange="toggleSelect('${escapeHtml(wh.uuid)}', this.checked)">
      </label>
      <div class="webhook-item-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
        </svg>
      </div>
      <div class="webhook-item-info">
        <div class="webhook-item-name">${escapeHtml(wh.name)} ${authBadge}${fwdBadge}</div>
        <div class="webhook-item-url">${escapeHtml(url)}</div>
      </div>
      <div class="webhook-item-meta">
        <span>${formatDate(wh.created_at)}</span>
      </div>
      <div class="webhook-item-actions">
        <button class="btn btn-ghost" onclick="copyUrl('${escapeHtml(url)}')" title="Copy URL" style="padding:6px 10px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="btn btn-ghost" onclick="openDashboard('${escapeHtml(wh.uuid)}')" title="Open dashboard" style="padding:6px 10px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </button>
        <button class="btn btn-ghost" onclick="deleteWebhook('${escapeHtml(wh.uuid)}')" title="Delete" style="padding:6px 10px;color:var(--danger);border-color:transparent;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
}

// ---------- Render filtered list ----------
function renderList() {
  const q         = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  const container = document.getElementById('webhookList');
  const countEl   = document.getElementById('totalCount');

  const filtered = q
    ? allWebhooks.filter((wh) =>
        wh.name.toLowerCase().includes(q) ||
        wh.uuid.toLowerCase().includes(q)
      )
    : allWebhooks;

  countEl.textContent = allWebhooks.length
    ? `${allWebhooks.length} URL${allWebhooks.length !== 1 ? 's' : ''}${q ? ` · ${filtered.length} match${filtered.length !== 1 ? 'es' : ''}` : ''}`
    : '';

  if (!allWebhooks.length) {
    container.innerHTML = `<div class="webhook-list-empty">No webhook URLs yet — create one above.</div>`;
    return;
  }
  if (!filtered.length) {
    container.innerHTML = `<div class="webhook-list-empty">No results for "<strong>${escapeHtml(q)}</strong>".</div>`;
    return;
  }

  container.innerHTML = filtered.map(renderWebhookItem).join('');
}

// ---------- Selection state ----------
function toggleSelect(uuid, checked) {
  checked ? selectedUuids.add(uuid) : selectedUuids.delete(uuid);
  updateBulkToolbar();
}

function updateBulkToolbar() {
  const toolbar   = document.getElementById('bulkToolbar');
  const countSpan = document.getElementById('selectedCount');
  const selectAll = document.getElementById('selectAllChk');
  const n         = selectedUuids.size;

  toolbar.classList.toggle('hidden', n === 0);
  countSpan.textContent = `${n} selected`;

  // Reflect select-all state based on visible (filtered) items
  const visibleUuids = getVisibleUuids();
  selectAll.indeterminate = n > 0 && n < visibleUuids.length;
  selectAll.checked       = visibleUuids.length > 0 && visibleUuids.every((u) => selectedUuids.has(u));
}

function getVisibleUuids() {
  return [...document.querySelectorAll('.wh-check')].map((el) => el.dataset.uuid);
}

function handleSelectAll(checked) {
  const visibleUuids = getVisibleUuids();
  visibleUuids.forEach((u) => (checked ? selectedUuids.add(u) : selectedUuids.delete(u)));
  // Re-render to sync checkboxes (cheapest approach given the small list size)
  renderList();
  updateBulkToolbar();
}

// ---------- Load from API ----------
async function loadWebhooks() {
  try {
    const res  = await fetch(`${window.APP_BASE || ''}/api/webhooks`);
    allWebhooks = await res.json();
    selectedUuids.clear();
    updateBulkToolbar();
    renderList();
  } catch {
    document.getElementById('webhookList').innerHTML =
      `<div class="webhook-list-empty" style="color:var(--danger)">Failed to load webhooks.</div>`;
  }
}

// ---------- Create webhook ----------
async function createWebhook() {
  const name = document.getElementById('webhookName').value.trim();
  if (!name) {
    document.getElementById('webhookName').focus();
    showToast('Please enter a name for this URL.');
    return;
  }
  const forwardEnabled = document.getElementById('forwardToggle').checked;
  const forwardUrl     = document.getElementById('forwardUrl').value.trim();
  const basicAuthEnabled  = document.getElementById('basicAuthToggle').checked;
  const basicAuthUsername = document.getElementById('authUsername').value.trim();
  const basicAuthPassword = document.getElementById('authPassword').value;

  if (forwardEnabled && !forwardUrl) {
    showToast('Please enter a destination URL for forwarding.');
    document.getElementById('forwardUrl').focus();
    return;
  }
  if (basicAuthEnabled && (!basicAuthUsername || !basicAuthPassword)) {
    showToast('Please fill in both username and password for basic auth.');
    return;
  }

  const btn = document.getElementById('createBtn');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    const res  = await fetch(`${window.APP_BASE || ''}/api/webhooks`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name,
        forward_enabled:     forwardEnabled,
        forward_url:         forwardEnabled ? forwardUrl : undefined,
        basic_auth_enabled:  basicAuthEnabled,
        basic_auth_username: basicAuthEnabled ? basicAuthUsername : undefined,
        basic_auth_password: basicAuthEnabled ? basicAuthPassword : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    window.location.href = `${window.APP_BASE || ''}/microservices/webhook/${data.uuid}`;
  } catch (err) {
    showToast(`Error: ${err.message}`);
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Create &amp; Open Dashboard`;
  }
}

// ---------- Delete single ----------
async function deleteWebhook(uuid) {
  if (!confirm('Delete this webhook URL and all its recorded requests?')) return;
  try {
    const res = await fetch(`${window.APP_BASE || ''}/api/webhooks/${uuid}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    allWebhooks  = allWebhooks.filter((w) => w.uuid !== uuid);
    selectedUuids.delete(uuid);
    updateBulkToolbar();
    renderList();
    showToast('Webhook deleted.');
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

// ---------- Bulk delete ----------
async function bulkDelete() {
  const uuids = [...selectedUuids];
  if (!uuids.length) return;
  if (!confirm(`Delete ${uuids.length} webhook URL${uuids.length !== 1 ? 's' : ''} and all their recorded requests?`)) return;

  const btn = document.getElementById('bulkDeleteBtn');
  btn.disabled = true;
  btn.textContent = 'Deleting…';

  const results = await Promise.allSettled(
    uuids.map((uuid) => fetch(`${window.APP_BASE || ''}/api/webhooks/${uuid}`, { method: 'DELETE' }))
  );

  const failed = results.filter((r) => r.status === 'rejected' || !r.value?.ok).length;
  const deleted = uuids.length - failed;

  allWebhooks  = allWebhooks.filter((w) => !uuids.includes(w.uuid));
  selectedUuids.clear();
  updateBulkToolbar();
  renderList();

  btn.disabled = false;
  btn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
    Delete selected`;

  if (failed) showToast(`Deleted ${deleted}, failed ${failed}.`);
  else showToast(`${deleted} webhook${deleted !== 1 ? 's' : ''} deleted.`);
}

// ---------- Utils ----------
function copyUrl(url) {
  navigator.clipboard.writeText(url)
    .then(() => showToast('URL copied!'))
    .catch(() => showToast('Could not copy.'));
}

function openDashboard(uuid) {
  window.open(`${window.APP_BASE || ''}/microservices/webhook/${uuid}`, '_blank');
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  refreshUuid();
  loadWebhooks();

  document.getElementById('refreshBtn').addEventListener('click', refreshUuid);
  document.getElementById('createBtn').addEventListener('click', createWebhook);
  document.getElementById('bulkDeleteBtn').addEventListener('click', bulkDelete);
  document.getElementById('selectAllChk').addEventListener('change', (e) => handleSelectAll(e.target.checked));

  document.getElementById('webhookName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createWebhook();
  });

  document.getElementById('forwardToggle').addEventListener('change', (e) => {
    document.getElementById('forwardFields').classList.toggle('hidden', !e.target.checked);
  });

  document.getElementById('basicAuthToggle').addEventListener('change', (e) => {
    document.getElementById('authFields').classList.toggle('hidden', !e.target.checked);
  });

  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');

  searchInput.addEventListener('input', () => {
    searchClear.classList.toggle('hidden', !searchInput.value);
    renderList();
    updateBulkToolbar();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.add('hidden');
    searchInput.focus();
    renderList();
    updateBulkToolbar();
  });
});
