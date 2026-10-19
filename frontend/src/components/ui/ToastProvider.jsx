import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastContext } from "./useToast.js";

const TONES = {
  success: { Icon: CircleCheck, color: "text-green-600" },
  error: { Icon: CircleAlert, color: "text-red-600" },
  info: { Icon: Info, color: "text-blue-600" },
};

const MAX_VISIBLE = 3;

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, tone = "success") => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((list) => [...list.slice(1 - MAX_VISIBLE), { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), tone === "error" ? 9000 : 5000),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
      >
        {toasts.map(({ id, message, tone }) => {
          const { Icon, color } = TONES[tone] ?? TONES.info;
          return (
            <div
              key={id}
              role={tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200/50 bg-white p-4 shadow-lg"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} aria-hidden="true" />
              <p className="flex-1 text-sm text-slate-700">{message}</p>
              <button
                type="button"
                onClick={() => dismiss(id)}
                aria-label="Dismiss notification"
                className="rounded-lg p-0.5 text-slate-400 transition-colors hover:text-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}
