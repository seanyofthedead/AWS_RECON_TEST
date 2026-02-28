import { useEffect } from "react";
import { markRouteRender } from "../utils/perf";

export const useRoutePerf = (label: string) => {
  useEffect(() => {
    markRouteRender(label);
  }, [label]);
};
