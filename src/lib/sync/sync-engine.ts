import { apiRequest, createIdempotencyKey } from '@/lib/api/client';
import { mapCategory, mapMenuItem, mapOrder, mapTable } from '@/lib/api/mappers';
import { storage } from '@/lib/storage';
import { MenuItem, Table } from '@/types';

export type SyncActionType =
  | 'ORDER_CREATE'
  | 'ORDER_LINE_ADD'
  | 'ORDER_LINE_UPDATE'
  | 'ORDER_LINE_DELETE'
  | 'ORDER_DISCOUNT_APPLY'
  | 'ORDER_DISCOUNT_REMOVE'
  | 'KOT_CREATE'
  | 'ORDER_BILL'
  | 'ORDER_PAYMENT_ADD'
  | 'ORDER_CANCEL';

export interface SyncAction {
  actionId: string;
  type: SyncActionType;
  payload: Record<string, unknown>;
  baseVersion?: number;
  createdAt: string;
}

export interface SyncConflict {
  actionId: string;
  type: SyncActionType;
  code: string;
  message: string;
  orderId?: string;
  tableId?: string;
  serverVersion?: number;
  localVersion?: number;
  errorCode: string;
  errorMessage: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface SyncState {
  cursor: number;
  lastSyncedAt?: string;
}

let isFlushing = false;

async function readQueue(): Promise<SyncAction[]> {
  const queue = await storage.getSyncQueue<SyncAction[]>();
  return Array.isArray(queue) ? queue : [];
}

async function writeQueue(queue: SyncAction[]) {
  await storage.saveSyncQueue(queue);
}

async function readConflicts(): Promise<SyncConflict[]> {
  const conflicts = await storage.getSyncConflicts<SyncConflict[]>();
  return Array.isArray(conflicts) ? conflicts : [];
}

async function writeConflicts(conflicts: SyncConflict[]) {
  await storage.saveSyncConflicts(conflicts);
}

async function readSyncState(): Promise<SyncState> {
  const state = await storage.getSyncState<SyncState>();
  return {
    cursor: state?.cursor || 0,
    lastSyncedAt: state?.lastSyncedAt,
  };
}

async function writeSyncState(state: SyncState) {
  await storage.saveSyncState(state);
}

async function refreshLocalSnapshotsFromServer(): Promise<void> {
  const [remoteCategories, remoteMenuItems, remoteTables, remoteOrders] = await Promise.all([
    apiRequest<Record<string, unknown>[]>('/api/categories'),
    apiRequest<Record<string, unknown>[]>('/api/menu-items?active=true'),
    apiRequest<Record<string, unknown>[]>('/api/tables'),
    apiRequest<Record<string, unknown>[]>('/api/orders/active'),
  ]);

  const categories = remoteCategories.map(mapCategory);
  const menuItems = remoteMenuItems.map(mapMenuItem);
  const tables = remoteTables.map(mapTable);
  const activeOrders = remoteOrders.map((order) => mapOrder(order, menuItems, tables as Table[]));

  await Promise.all([
    storage.saveCategories(categories),
    storage.saveMenuItems(menuItems as MenuItem[]),
    storage.saveTables(tables),
    storage.saveActiveOrders(activeOrders),
  ]);
}

export async function enqueueSyncAction(type: SyncActionType, payload: Record<string, unknown>, baseVersion?: number) {
  const queue = await readQueue();
  queue.push({
    actionId: createIdempotencyKey(type.toLowerCase()),
    type,
    payload,
    baseVersion,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(queue);
}

export async function getSyncQueueSize(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export async function getSyncConflicts(): Promise<SyncConflict[]> {
  return readConflicts();
}

export async function clearSyncConflict(actionId: string): Promise<void> {
  const conflicts = await readConflicts();
  await writeConflicts(conflicts.filter((item) => item.actionId !== actionId));
}

export async function retrySyncConflict(actionId: string): Promise<void> {
  const conflicts = await readConflicts();
  const target = conflicts.find((item) => item.actionId === actionId);
  if (!target) {
    return;
  }

  const queue = await readQueue();
  queue.push({
    actionId: createIdempotencyKey(`${target.type.toLowerCase()}-retry`),
    type: target.type,
    payload: target.payload,
    createdAt: new Date().toISOString(),
  });

  await Promise.all([
    writeQueue(queue),
    writeConflicts(conflicts.filter((item) => item.actionId !== actionId)),
  ]);
}

export async function flushSyncQueue(): Promise<void> {
  if (isFlushing) {
    return;
  }
  if (!navigator.onLine) {
    return;
  }

  isFlushing = true;
  try {
    let iterations = 0;
    while (iterations < 10) {
      const queue = await readQueue();
      if (queue.length === 0) {
        break;
      }

      const batch = queue.slice(0, 20);
      const pushResult = await apiRequest<{
        results: Array<{
          actionId: string;
          status: 'processed' | 'conflict' | 'failed';
          errorCode?: string;
          errorMessage?: string;
          details?: Record<string, unknown>;
        }>;
      }>('/api/sync/push', {
        method: 'POST',
        body: JSON.stringify({ actions: batch }),
      });

      const removableIds = new Set(
        pushResult.results
          .filter((result) => result.status === 'processed' || result.status === 'conflict')
          .map((result) => result.actionId)
      );

      const conflictResults = pushResult.results.filter((result) => result.status === 'conflict');
      if (conflictResults.length > 0) {
        const existingConflicts = await readConflicts();
        const newConflicts: SyncConflict[] = conflictResults.map((result) => {
          const source = batch.find((action) => action.actionId === result.actionId)!;
          return {
            actionId: source.actionId,
            type: source.type,
            code: result.errorCode || 'SYNC_ERROR',
            message: result.errorMessage || 'Unable to sync action',
            orderId: typeof result.details?.orderId === 'string' ? result.details.orderId : undefined,
            tableId: typeof result.details?.tableId === 'string' ? result.details.tableId : undefined,
            serverVersion: typeof result.details?.serverVersion === 'number' ? result.details.serverVersion : undefined,
            localVersion: typeof result.details?.localVersion === 'number' ? result.details.localVersion : undefined,
            errorCode: result.errorCode || 'SYNC_ERROR',
            errorMessage: result.errorMessage || 'Unable to sync action',
            payload: source.payload,
            createdAt: source.createdAt,
          };
        });
        const merged = [...newConflicts, ...existingConflicts];
        const deduped = merged.filter((item, index, arr) =>
          arr.findIndex((candidate) => candidate.actionId === item.actionId) === index
        );
        await writeConflicts(deduped);
      }

      const remaining = queue.filter((action) => !removableIds.has(action.actionId));
      await writeQueue(remaining);
      iterations += 1;
    }

    let state = await readSyncState();
    let hasMore = true;
    let sawEvents = false;
    let pulls = 0;

    while (hasMore && pulls < 5) {
      const pullResult = await apiRequest<{
        cursor: number;
        events: Array<Record<string, unknown>>;
        hasMore: boolean;
      }>(`/api/sync/pull?cursor=${state.cursor}&limit=200`);

      sawEvents = sawEvents || pullResult.events.length > 0;
      state = {
        cursor: pullResult.cursor,
        lastSyncedAt: new Date().toISOString(),
      };
      await writeSyncState(state);
      hasMore = pullResult.hasMore;
      pulls += 1;
    }

    if (sawEvents) {
      try {
        await refreshLocalSnapshotsFromServer();
      } catch {
        // Snapshot refresh best-effort; cursor state is already updated.
      }
    }
  } finally {
    isFlushing = false;
  }
}
