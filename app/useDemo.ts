import { useCallback, useEffect, useRef, useState } from "react";
import { includeArchiveExamples, makeDemo, parseDemo, STORAGE_KEY, type Demo } from "./demo";

export function useDemo() {
  const [data, setData] = useState<Demo | null>(null);
  const [storageError, setStorageError] = useState(false);
  const current = useRef<Demo | null>(null);
  const unsaved = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? parseDemo(saved) : null;
      current.current = parsed ?? makeDemo();
      setStorageError(Boolean(saved && !parsed));
    } catch {
      current.current = makeDemo();
      unsaved.current = true;
      setStorageError(true);
    }
    setData(current.current);
    const sync = (event: StorageEvent) => {
      if ((event.key !== STORAGE_KEY && event.key !== null) || unsaved.current) return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const parsed = saved ? parseDemo(saved) : null;
        if (saved && !parsed) { setStorageError(true); return; }
        current.current = parsed ?? makeDemo();
        setData(current.current);
        setStorageError(false);
      } catch { setStorageError(true); }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const updateData = useCallback(async (update: (data: Demo) => Demo) => {
    const transaction = () => {
      if (!current.current) return;
      let base = current.current;
      try {
        // Читаем последнее состояние внутри блокировки, а не из снимка React.
        if (!unsaved.current) {
          const saved = localStorage.getItem(STORAGE_KEY);
          const parsed = saved ? parseDemo(saved) : null;
          if (parsed) base = parsed;
        }
        const next = update(base);
        current.current = next;
        setData(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        unsaved.current = false;
        setStorageError(false);
      } catch {
        if (current.current === base) {
          current.current = update(base);
          setData(current.current);
        }
        unsaved.current = true;
        setStorageError(true);
      }
    };
    if (navigator.locks) await navigator.locks.request(STORAGE_KEY, transaction);
    else transaction();
  }, []);
  // Не сбрасываем уже созданные пользователем размещения при добавлении примеров.
  const migrated = useRef(false);
  useEffect(() => {
    if (!data || migrated.current) return;
    migrated.current = true;
    void updateData(includeArchiveExamples);
  }, [data, updateData]);
  return { data, updateData, storageError };
}
