import type { SupabaseClient } from '@supabase/supabase-js';

export type SyncableRecord = { id: string; name: string; updatedAt: string };
export type Tombstone = { id: string; deletedAt: string };

export type SyncConfig<T extends SyncableRecord> = {
  table: string;
  idColumn: string;
  loadLocal: () => T[];
  saveLocal: (items: T[]) => void;
  loadTombstones: () => Tombstone[];
  clearTombstone: (id: string) => void;
  isValid: (value: unknown) => value is T;
};

export type SyncResult = { count: number } | { error: string };

function mergeRecords<T extends SyncableRecord>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>(local.map((item) => [item.id, item]));
  for (const item of remote) {
    const current = byId.get(item.id);
    if (!current || new Date(item.updatedAt).getTime() > new Date(current.updatedAt).getTime()) byId.set(item.id, item);
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function syncTable<T extends SyncableRecord>(
  supabase: SupabaseClient,
  userId: string,
  config: SyncConfig<T>,
): Promise<SyncResult> {
  const { table, idColumn, loadLocal, saveLocal, loadTombstones, clearTombstone, isValid } = config;

  const { data: rows, error } = await supabase.from(table).select(`${idColumn},payload`).eq('user_id', userId);
  if (error) return { error: error.message };

  const remote = (rows ?? [])
    .map((row) => (row as unknown as { payload: unknown }).payload)
    .filter(isValid);
  const remoteById = new Map(remote.map((item) => [item.id, item]));

  const tombstones = loadTombstones();
  const idsToDeleteRemotely: string[] = [];
  for (const tombstone of tombstones) {
    const remoteItem = remoteById.get(tombstone.id);
    if (!remoteItem || Date.parse(remoteItem.updatedAt) <= Date.parse(tombstone.deletedAt)) {
      idsToDeleteRemotely.push(tombstone.id);
      remoteById.delete(tombstone.id);
    }
  }

  if (idsToDeleteRemotely.length) {
    const { error: deleteError } = await supabase.from(table).delete().eq('user_id', userId).in(idColumn, idsToDeleteRemotely);
    if (deleteError) return { error: deleteError.message };
  }
  for (const tombstone of tombstones) clearTombstone(tombstone.id);

  const local = loadLocal().filter((item) => !idsToDeleteRemotely.includes(item.id));
  const merged = mergeRecords(local, Array.from(remoteById.values()));
  const uploads = merged.map((item) => ({ user_id: userId, [idColumn]: item.id, name: item.name, updated_at: item.updatedAt, payload: item }));

  if (uploads.length) {
    const { error: uploadError } = await supabase.from(table).upsert(uploads, { onConflict: `user_id,${idColumn}` });
    if (uploadError) return { error: uploadError.message };
  }

  saveLocal(merged);
  return { count: merged.length };
}
