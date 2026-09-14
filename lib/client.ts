export type Client = {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  updatedAt: string;
};

const STORAGE_KEY = 'potolok-planner-clients';
const DELETED_STORAGE_KEY = 'potolok-planner-clients-deleted';
const CHANGE_EVENT = 'potolok:clients-changed';

export type DeletedClient = { id: string; deletedAt: string };

function isDeletedClient(value: unknown): value is DeletedClient {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<DeletedClient>;
  return typeof p.id === 'string' && typeof p.deletedAt === 'string' && !Number.isNaN(Date.parse(p.deletedAt));
}

function notifyClientsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function onClientsChanged(handler: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

export function isClient(value: unknown): value is Client {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<Client>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    c.name.trim().length > 0 &&
    typeof c.phone === 'string' &&
    typeof c.address === 'string' &&
    typeof c.notes === 'string' &&
    typeof c.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(c.updatedAt))
  );
}

export function loadClients(): Client[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isClient);
  } catch {
    return [];
  }
}

export function saveClients(clients: Client[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  } catch {
    // Storage can be unavailable or full; keep the current UI usable.
  }
  notifyClientsChanged();
}

export function loadDeletedClients(): DeletedClient[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DELETED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDeletedClient);
  } catch {
    return [];
  }
}

function saveDeletedClients(items: DeletedClient[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage can be unavailable or full; keep the current UI usable.
  }
}

export function clearDeletedClient(id: string) {
  saveDeletedClients(loadDeletedClients().filter((item) => item.id !== id));
}

export function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function upsertClient(client: Client, clients = loadClients()) {
  const next = [client, ...clients.filter((item) => item.id !== client.id)];
  saveClients(next);
  return next;
}

export function removeClientLocally(id: string, clients = loadClients()) {
  const next = clients.filter((client) => client.id !== id);
  saveClients(next);
  const deleted = loadDeletedClients().filter((item) => item.id !== id);
  deleted.push({ id, deletedAt: new Date().toISOString() });
  saveDeletedClients(deleted);
  return next;
}
