const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "$--";
  }
  return formatter.format(value);
};
