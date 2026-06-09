import { getItem, setItem } from 'lib/app-storage';

const QUEUE_KEY = 'inventory-cloud-sync-queue';

type QueuedState = {
  enqueuedAt: string;
  state: unknown;
};

async function loadQueue(): Promise<QueuedState[]> {
  try {
    const raw = await getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .map((entry) => ({
            enqueuedAt: String(entry.enqueuedAt ?? ''),
            state: entry.state,
          }))
          .filter((entry) => entry.enqueuedAt)
      : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedState[]) {
  try {
    await setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export async function enqueueCloudState(state: unknown) {
  const queue = await loadQueue();
  queue.push({ enqueuedAt: new Date().toISOString(), state });
  const trimmed = queue.slice(-5); // keep queue small
  await saveQueue(trimmed);
}

export async function flushCloudQueue(push: (state: unknown) => Promise<boolean>) {
  const queue = await loadQueue();
  if (!queue.length) return;
  const remaining: QueuedState[] = [];
  for (const entry of queue) {
    try {
      const ok = await push(entry.state);
      if (!ok) {
        remaining.push(entry);
      }
    } catch {
      remaining.push(entry);
    }
  }
  await saveQueue(remaining);
}

