import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "failed";

interface Args<T> {
  values: T;
  serverValues: T | undefined;
  delayMs?: number;
  diff: (current: T, server: T) => Partial<T>;
  save: (changed: Partial<T>) => Promise<void>;
}

export function useDebouncedSave<T>({
  values,
  serverValues,
  delayMs = 1500,
  diff,
  save,
}: Args<T>) {
  const [saving, setSaving] = useState(false);
  const [lastError, setLastError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Capture latest deps in a ref so the timer callback always sees fresh values.
  const latest = useRef({ values, serverValues, diff, save });
  useEffect(() => {
    latest.current = { values, serverValues, diff, save };
  });

  const isDirty =
    serverValues !== undefined &&
    Object.keys(diff(values, serverValues)).length > 0;

  // Derive status during render — no setState-in-effect cascade.
  const status: SaveStatus = saving
    ? "saving"
    : isDirty
      ? "unsaved"
      : lastError
        ? "failed"
        : "saved";

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const { values: v, serverValues: s, diff: d, save: doSave } = latest.current;
    if (s === undefined) return;
    const payload = d(v, s);
    if (Object.keys(payload).length === 0) return;
    setSaving(true);
    setLastError(false);
    try {
      await doSave(payload);
    } catch {
      setLastError(true);
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [isDirty, values, delayMs, flush]);

  // Flush on unmount so navigating away doesn't drop the user's pending edit.
  useEffect(() => {
    return () => {
      void flush();
    };
  }, [flush]);

  return { status, flush };
}
