"use client";

import { useEffect, useState } from "react";
import type { SaveStatus } from "@/features/onboarding/shell/status";

type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

const RETRY_MS = 4000;

/**
 * Controlador de guardado automático: agrupa cambios con debounce, serializa los guardados
 * (nunca hay dos en paralelo) y reintenta si falla la conexión.
 */
function createAutosaveController(save: () => Promise<SaveResult>, onStatus: (status: SaveStatus) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;
  let queue: Promise<void> = Promise.resolve();
  let lastSavedAt: string | null = null;
  let disposed = false;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const run = async () => {
    if (!dirty || disposed) return;
    dirty = false;
    onStatus({ kind: "saving", savedAt: lastSavedAt });
    try {
      const result = await save();
      if (result.ok) {
        lastSavedAt = result.savedAt;
        onStatus(dirty ? { kind: "pending", savedAt: lastSavedAt } : { kind: "saved", savedAt: lastSavedAt });
      } else {
        dirty = true;
        onStatus({ kind: "error", savedAt: lastSavedAt, message: result.error });
        retryLater();
      }
    } catch {
      dirty = true;
      onStatus({ kind: "offline", savedAt: lastSavedAt });
      retryLater();
    }
  };

  const flush = (): Promise<void> => {
    clearTimer();
    queue = queue.then(run, run);
    return queue;
  };

  function retryLater() {
    if (disposed) return;
    clearTimer();
    timer = setTimeout(() => void flush(), RETRY_MS);
  }

  return {
    /** Marca cambios y guarda tras `delay` ms sin nuevos cambios. */
    schedule(delay = 700) {
      dirty = true;
      onStatus({ kind: "pending", savedAt: lastSavedAt });
      clearTimer();
      timer = setTimeout(() => void flush(), delay);
    },
    /** Guarda ya (si hay cambios) y espera a que terminen los guardados en curso. */
    flushNow(force = false): Promise<void> {
      if (force) dirty = true;
      return flush();
    },
    hasPending: () => dirty && !disposed,
    dispose() {
      disposed = true;
      clearTimer();
    },
  };
}

export type AutosaveController = ReturnType<typeof createAutosaveController>;

export function useAutosave(save: () => Promise<SaveResult>) {
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle", savedAt: null });
  const [controller] = useState(() => createAutosaveController(save, setStatus));

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (controller.hasPending()) {
        void controller.flushNow();
        event.preventDefault();
      }
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden" && controller.hasPending()) void controller.flushNow();
    };
    const onOnline = () => {
      if (controller.hasPending()) void controller.flushNow();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("online", onOnline);
    };
  }, [controller]);

  return { status, controller };
}
