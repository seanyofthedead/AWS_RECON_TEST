import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CaseStatus } from "../types/case";

export type ProviderMode = "mock" | "api";

interface EnvState {
  provider: ProviderMode;
  statusFilter: "all" | CaseStatus;
  searchTerm: string;
  setProvider: (provider: ProviderMode) => void;
  setStatusFilter: (value: "all" | CaseStatus) => void;
  setSearchTerm: (value: string) => void;
}

const defaultProvider: ProviderMode = import.meta.env.VITE_API_BASE_URL ? "api" : "mock";

export const useEnvStore = create<EnvState>()(
  persist(
    (set) => ({
      provider: defaultProvider,
      statusFilter: "all",
      searchTerm: "",
      setProvider: (provider) => set({ provider }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      setSearchTerm: (searchTerm) => set({ searchTerm })
    }),
    {
      name: "recon_env_store_v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ provider: state.provider })
    }
  )
);
