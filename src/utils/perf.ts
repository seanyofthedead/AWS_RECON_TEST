type PerfLog = {
  label: string;
  durationMs: number;
  at: number;
};

type PerfStore = {
  routeStart?: number;
  routeLabel?: string;
  logs: PerfLog[];
};

const isDev = import.meta.env.DEV;
const perfStore = (() => {
  if (!isDev) {
    return { logs: [] } as PerfStore;
  }
  const globalStore = globalThis as typeof globalThis & { __reconPerf?: PerfStore };
  if (!globalStore.__reconPerf) {
    globalStore.__reconPerf = { logs: [] };
  }
  return globalStore.__reconPerf;
})();

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export const markRouteStart = (label: string) => {
  if (!isDev) {
    return;
  }
  perfStore.routeStart = now();
  perfStore.routeLabel = label;
  console.debug(`[perf][route:start] ${label}`);
};

export const markRouteRender = (label: string) => {
  if (!isDev) {
    return;
  }
  const start = perfStore.routeStart ?? now();
  const duration = now() - start;
  perfStore.logs.push({ label: `route:${label}`, durationMs: duration, at: Date.now() });
  console.debug(`[perf][route:end] ${label} ${duration.toFixed(1)}ms`);
};

export const measureDev = <T,>(label: string, work: () => T): T => {
  if (!isDev) {
    return work();
  }
  const start = now();
  const result = work();
  const duration = now() - start;
  perfStore.logs.push({ label, durationMs: duration, at: Date.now() });
  console.debug(`[perf] ${label} ${duration.toFixed(1)}ms`);
  return result;
};

export const measureDevAsync = async <T,>(label: string, work: () => Promise<T>) => {
  if (!isDev) {
    return work();
  }
  const start = now();
  const result = await work();
  const duration = now() - start;
  perfStore.logs.push({ label, durationMs: duration, at: Date.now() });
  console.debug(`[perf] ${label} ${duration.toFixed(1)}ms`);
  return result;
};
