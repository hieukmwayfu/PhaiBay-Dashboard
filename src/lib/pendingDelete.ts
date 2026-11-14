import { useSyncExternalStore } from "react";
import { deleteEvents } from "./api";

/** Seconds between confirming a delete and actually calling the server (the user can cancel meanwhile). */
export const DELETE_DELAY_MS = 10_000;

export interface PendingDelete {
  id: number;
  appId: number;
  appName: string;
  names: string[];
  from?: string; // both empty = all time
  to?: string;
  total: number; // rows counted by the dry run
  deadline: number; // ms epoch when the request is sent
  state: "waiting" | "running" | "done" | "error";
  deleted?: number;
  error?: string;
}

let items: PendingDelete[] = [];
let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const patch = (id: number, p: Partial<PendingDelete>) => {
  items = items.map((x) => (x.id === id ? { ...x, ...p } : x));
  emit();
};
const drop = (id: number) => {
  clearTimeout(timers.get(id));
  timers.delete(id);
  items = items.filter((x) => x.id !== id);
  emit();
};

/** Fired on window after the server deleted rows: pages reload their data. */
export const EVENTS_DELETED = "pb-events-deleted";

async function run(id: number) {
  const it = items.find((x) => x.id === id);
  if (!it || it.state !== "waiting") return;
  patch(id, { state: "running" });
  try {
    const r = await deleteEvents({ app_id: it.appId, names: it.names, from: it.from, to: it.to });
    patch(id, { state: "done", deleted: r.total });
    window.dispatchEvent(new CustomEvent(EVENTS_DELETED, { detail: { appId: it.appId, names: it.names } }));
    timers.set(id, setTimeout(() => drop(id), 6000));
  } catch (e) {
    patch(id, { state: "error", error: (e as Error).message });
  }
}

export function scheduleDelete(p: Omit<PendingDelete, "id" | "deadline" | "state">) {
  const id = ++seq;
  items = [...items, { ...p, id, deadline: Date.now() + DELETE_DELAY_MS, state: "waiting" }];
  timers.set(id, setTimeout(() => run(id), DELETE_DELAY_MS));
  emit();
  return id;
}

/** Cancel while waiting (nothing was sent), or dismiss a finished / failed toast. */
export function cancelDelete(id: number) {
  const it = items.find((x) => x.id === id);
  if (it && it.state !== "running") drop(id);
}

export function usePendingDeletes() {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    () => items,
  );
}

// Leaving the page while a delete is counting down silently drops it: warn first.
window.addEventListener("beforeunload", (e) => {
  if (items.some((x) => x.state === "waiting" || x.state === "running")) e.preventDefault();
});
