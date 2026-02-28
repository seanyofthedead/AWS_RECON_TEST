import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CaseStatus, ConfidenceBand } from "../types/case";

interface InboxFiltersState {
  statuses: CaseStatus[];
  confidenceBands: ConfidenceBand[];
  vendorSearch: string;
  reviewedOnly: boolean;
  startDate: string;
  endDate: string;
  recommendedAction: string;
  hasBookingEntry: "all" | "yes" | "no";
  setStatuses: (statuses: CaseStatus[]) => void;
  setConfidenceBands: (bands: ConfidenceBand[]) => void;
  toggleStatus: (status: CaseStatus) => void;
  toggleConfidence: (band: ConfidenceBand) => void;
  setVendorSearch: (value: string) => void;
  setReviewedOnly: (value: boolean) => void;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  setRecommendedAction: (value: string) => void;
  setHasBookingEntry: (value: "all" | "yes" | "no") => void;
  resetFilters: () => void;
}

const defaultStatuses = [
  CaseStatus.ScreenedUnresolved,
  CaseStatus.Resolved,
  CaseStatus.Reviewed,
  CaseStatus.Escalated
];

const defaultBands = [ConfidenceBand.High, ConfidenceBand.Medium, ConfidenceBand.Low];

const normalizeConfidenceBand = (value: unknown): ConfidenceBand | null => {
  if (value === ConfidenceBand.High || value === ConfidenceBand.Medium || value === ConfidenceBand.Low) {
    return value;
  }
  if (typeof value === "string") {
    const upper = value.toUpperCase();
    if (upper === ConfidenceBand.High) {
      return ConfidenceBand.High;
    }
    if (upper === ConfidenceBand.Medium) {
      return ConfidenceBand.Medium;
    }
    if (upper === ConfidenceBand.Low) {
      return ConfidenceBand.Low;
    }
  }
  return null;
};

const normalizeConfidenceBands = (value: unknown): ConfidenceBand[] => {
  if (!Array.isArray(value)) {
    return defaultBands;
  }
  const normalized = value
    .map((item) => normalizeConfidenceBand(item))
    .filter((item): item is ConfidenceBand => Boolean(item));
  if (normalized.length === 0) {
    return defaultBands;
  }
  return Array.from(new Set(normalized));
};

export const useInboxFiltersStore = create<InboxFiltersState>()(
  persist(
    (set, get) => ({
      statuses: defaultStatuses,
      confidenceBands: defaultBands,
      vendorSearch: "",
      reviewedOnly: false,
      startDate: "",
      endDate: "",
      recommendedAction: "all",
      hasBookingEntry: "all",
      setStatuses: (statuses) => set({ statuses }),
      setConfidenceBands: (bands) => set({ confidenceBands: bands }),
      toggleStatus: (status) => {
        const current = get().statuses;
        const next = current.includes(status)
          ? current.filter((item) => item !== status)
          : [...current, status];
        set({ statuses: next });
      },
      toggleConfidence: (band) => {
        const current = get().confidenceBands;
        const next = current.includes(band)
          ? current.filter((item) => item !== band)
          : [...current, band];
        set({ confidenceBands: next });
      },
      setVendorSearch: (value) => set({ vendorSearch: value }),
      setReviewedOnly: (value) => set({ reviewedOnly: value }),
      setStartDate: (value) => set({ startDate: value }),
      setEndDate: (value) => set({ endDate: value }),
      setRecommendedAction: (value) => set({ recommendedAction: value }),
      setHasBookingEntry: (value) => set({ hasBookingEntry: value }),
      resetFilters: () =>
        set({
          statuses: defaultStatuses,
          confidenceBands: defaultBands,
          vendorSearch: "",
          reviewedOnly: false,
          startDate: "",
          endDate: "",
          recommendedAction: "all",
          hasBookingEntry: "all"
        })
    }),
    {
      name: "recon-inbox-filters-v1",
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }
        const normalizedBands = normalizeConfidenceBands(state.confidenceBands);
        if (normalizedBands !== state.confidenceBands) {
          state.setConfidenceBands(normalizedBands);
        }
      }
    }
  )
);
