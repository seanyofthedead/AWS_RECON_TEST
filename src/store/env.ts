import { create } from "zustand";
import { CaseStatus } from "../types/case";

type ProviderMode = "mock";

interface EnvState {
  provider: ProviderMode;
  statusFilter: "all" | CaseStatus;
  searchTerm: string;
  setProvider: (provider: ProviderMode) => void;
  setStatusFilter: (value: "all" | CaseStatus) => void;
  setSearchTerm: (value: string) => void;
}

export const useEnvStore = create<EnvState>((set) => ({
  provider: "mock",
  statusFilter: "all",
  searchTerm: "",
  setProvider: (provider) => set({ provider }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSearchTerm: (searchTerm) => set({ searchTerm })
}));
