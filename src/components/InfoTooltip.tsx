type InfoTooltipProps = {
  label: string;
  text: string;
};

export const InfoTooltip = ({ label, text }: InfoTooltipProps) => {
  return (
    <button
      type="button"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
      aria-label={label}
      title={text}
    >
      ?
      <span className="sr-only">{text}</span>
    </button>
  );
};
