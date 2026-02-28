interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState = ({ title, message, onRetry }: ErrorStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-6 py-6 text-center">
      <div className="text-sm font-semibold text-rose-900">{title}</div>
      <div className="text-xs text-rose-700">{message}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-900 hover:bg-rose-100"
        >
          Retry
        </button>
      )}
    </div>
  );
};
