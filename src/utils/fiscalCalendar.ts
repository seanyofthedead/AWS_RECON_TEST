// Demo fiscal calendar. Federal fiscal years start in October. Which periods
// are closed is a demo setting, not an agency close schedule.
export const DEMO_CLOSED_THROUGH = "2025-09";

export const periodOf = (date: string) => date.slice(0, 7);

export const fiscalYearOf = (date: string) => {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= 10 ? year + 1 : year;
};

export const periodStatus = (period: string): "open" | "closed" =>
  period <= DEMO_CLOSED_THROUGH ? "closed" : "open";

const nextPeriod = (period: string) => {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, "0")}`;
};

export const firstOpenPeriodFrom = (period: string) => {
  let candidate = period;
  while (periodStatus(candidate) === "closed") {
    candidate = nextPeriod(candidate);
  }
  return candidate;
};

export interface PostingSchedule {
  servicePeriod: string;
  // Whether the service period comes from a source service date or is only
  // inferred from the posting date.
  servicePeriodBasis: "service date" | "posting date";
  period: string;
  effectiveDate: string;
  fiscalYear: number;
  priorPeriodAdjustment: boolean;
  reversal?: { period: string; date: string };
}

// Where an adjustment for activity on serviceDate posts. A closed service
// period is never backdated: the entry posts on the first day of the first
// open period and is flagged as a prior-period adjustment. Accruals carry a
// scheduled reversal on the first day of the following period.
export const schedulePosting = (
  serviceDate: string,
  accrual: boolean,
  servicePeriodBasis: PostingSchedule["servicePeriodBasis"] = "service date"
): PostingSchedule => {
  const servicePeriod = periodOf(serviceDate);
  const period = firstOpenPeriodFrom(servicePeriod);
  const priorPeriodAdjustment = period !== servicePeriod;
  const effectiveDate = priorPeriodAdjustment ? `${period}-01` : serviceDate.slice(0, 10);
  const reversalPeriod = nextPeriod(period);
  return {
    servicePeriod,
    servicePeriodBasis,
    period,
    effectiveDate,
    fiscalYear: fiscalYearOf(effectiveDate),
    priorPeriodAdjustment,
    ...(accrual ? { reversal: { period: reversalPeriod, date: `${reversalPeriod}-01` } } : {})
  };
};
