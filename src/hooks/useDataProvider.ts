import { useMemo } from "react";
import { DataProvider } from "../api/DataProvider";
import { MockDataProvider } from "../api/MockDataProvider";
import { ApiDataProvider } from "../api/ApiDataProvider";
import { useEnvStore } from "../store/env";

export const useDataProvider = (): DataProvider => {
  const provider = useEnvStore((state) => state.provider);
  return useMemo(() => {
    if (provider === "mock") {
      return MockDataProvider.getInstance();
    }
    return new ApiDataProvider();
  }, [provider]);
};
