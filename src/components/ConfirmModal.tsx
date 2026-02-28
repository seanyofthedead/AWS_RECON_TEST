import { useEffect, useRef } from "react";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  bullets: string[];
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  isConfirming?: boolean;
};

export const ConfirmModal = ({
  isOpen,
  title,
  bullets,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  isConfirming = false
}: ConfirmModalProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button");
    focusable?.[0]?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Enter") {
        const target = event.target as HTMLElement | null;
        if (target instanceof HTMLButtonElement) {
          return;
        }
        event.preventDefault();
        if (!isConfirming) {
          onConfirm();
        }
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button");
      if (!focusable || focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onConfirm, isConfirming]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="w-full max-w-md rounded-lg bg-white shadow-lg"
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 id="confirm-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
        </div>
        <div className="space-y-3 px-6 py-4 text-sm text-slate-700">
          <ul className="space-y-2">
            {bullets.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            disabled={isConfirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
