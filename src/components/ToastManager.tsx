import { useEffect, useRef } from "react";
import { useToastStore } from "../store/toastStore";

const toastStyles: Record<string, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900"
};

export const ToastManager = () => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);
  const timersRef = useRef(new Map<string, number>());

  useEffect(() => {
    const activeIds = new Set(toasts.map((toast) => toast.id));
    toasts.forEach((toast) => {
      if (timersRef.current.has(toast.id)) {
        return;
      }
      const timeout = window.setTimeout(() => {
        timersRef.current.delete(toast.id);
        removeToast(toast.id);
      }, 4000);
      timersRef.current.set(toast.id, timeout);
    });

    timersRef.current.forEach((timeout, toastId) => {
      if (activeIds.has(toastId)) {
        return;
      }
      window.clearTimeout(timeout);
      timersRef.current.delete(toastId);
    });

    return () => {
      timersRef.current.forEach((timeout) => window.clearTimeout(timeout));
      timersRef.current.clear();
    };
  }, [toasts, removeToast]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed right-6 top-6 z-50 flex w-80 flex-col gap-3"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === "error" ? "alert" : "status"}
          className={`rounded-md border px-4 py-3 text-sm font-semibold shadow transition duration-200 ${toastStyles[toast.type]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900"
              aria-label="Dismiss toast"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
