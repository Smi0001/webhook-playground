// In-process SSE manager — maps webhook UUID → Set of active response objects
const clients = new Map();

function addClient(uuid, res) {
  if (!clients.has(uuid)) clients.set(uuid, new Set());
  clients.get(uuid).add(res);
}

function removeClient(uuid, res) {
  const set = clients.get(uuid);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(uuid);
}

function broadcast(uuid, data) {
  const set = clients.get(uuid);
  if (!set || set.size === 0) return;
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  set.forEach((res) => {
    try { res.write(msg); } catch (_) { /* client disconnected */ }
  });
}

module.exports = { addClient, removeClient, broadcast };
