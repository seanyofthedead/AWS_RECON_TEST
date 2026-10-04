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

// Only the mock provider exists in this build. Defaulting to "api" because a
// base URL is configured would label fixture data as live data.
const defaultProvider: ProviderMode = "mock";

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
      version: 2,
      // Discard a previously saved "api" selection; it was never served.
      migrate: () => ({ provider: defaultProvider }),
      partialize: (state) => ({ provider: state.provider })
    }
  )
);
