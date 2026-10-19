import { useCallback, useEffect, useState } from "react";
import { compareExams } from "../lib/analytics.js";
import * as storage from "../lib/storage.js";

const ready = (exams) => ({ status: "ready", exams: exams.sort(compareExams), error: null });

/** Saved exams from IndexedDB, oldest first, plus mutations that keep the list in sync. */
export function useExams() {
  const [state, setState] = useState({ status: "loading", exams: [], error: null });

  useEffect(() => {
    let active = true;
    storage.listExams().then(
      (exams) => active && setState(ready(exams)),
      (error) => active && setState({ status: "error", exams: [], error }),
    );
    return () => {
      active = false;
    };
  }, []);

  const mutate = useCallback(async (operation) => {
    await operation();
    setState(ready(await storage.listExams()));
  }, []);

  const saveExams = useCallback((exams) => mutate(() => storage.saveExams(exams)), [mutate]);
  const deleteExams = useCallback(
    (examNumbers) => mutate(() => storage.deleteExams(examNumbers)),
    [mutate],
  );
  const clearExams = useCallback(() => mutate(storage.clearExams), [mutate]);

  return { ...state, saveExams, deleteExams, clearExams };
}
