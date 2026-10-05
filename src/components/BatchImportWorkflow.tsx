import { useEffect, useMemo, useRef, useState, type TransitionEvent } from "react";

type BatchImportWorkflowProps = {
  open: boolean;
  onClose: () => void;
  batchId: number;
  runId: number;
  onComplete: () => void;
  importedCount?: number | null;
  onViewInbox?: () => void;
};

type StepPhase = "entering" | "settled" | "exiting";

const isStepperDebugEnabled = () => {
  if (!import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  const win = window as any;
  if (win.__STEPPER_DEBUG__ === true) return true;
  try {
    return window.localStorage.getItem("__STEPPER_DEBUG__") === "true";
  } catch {
    return false;
  }
};

const BATCH_SIZE = 12;

const STEPS = [
  {
    label: "Connect to ERP",
    description: "Establishing secure ERP session and credentials."
  },
  {
    label: "Extract variance candidates",
    description: "Pulling latest variance candidates for the batch."
  },
  {
    label: "Normalize and enrich records",
    description: "Standardizing fields and enriching metadata."
  },
  {
    label: "Cross-system matching (3-way)",
    description: "Matching invoices, POs, and receipts."
  },
  {
    label: "Retrieve supporting evidence",
    description: "Collecting contracts, logs, and policy snapshots."
  },
  {
    label: "Validate controls and constraints",
    description: "Applying policy and audit constraints."
  },
  {
    label: "Generate case packets",
    description: "Assembling case files for review."
  },
  {
    label: "Publish to Inbox for review",
    description: "Publishing final packets to the Inbox."
  }
];

const COUNTER_STEPS = new Set([1, 2, 3, 4]);
const STEP_TOTAL = STEPS.length;
// TurboTax-like timing (ms). Keep total <= STEP_MAX_MS.
const ENTER_MS = 900; // slide in
const SETTLE_MS = 1200; // brief lock/polish (linger)
const EXIT_MS = 900; // slide out
const STEP_MAX_MS = 6000;
const COUNTER_LABELS: Record<number, string> = {
  1: "Pulled",
  2: "Enriched",
  3: "Matched",
  4: "Collected"
};

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    handleChange();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return prefersReducedMotion;
};

export const BatchImportWorkflow = ({
  open,
  onClose,
  batchId,
  runId,
  onComplete,
  importedCount,
  onViewInbox
}: BatchImportWorkflowProps) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<StepPhase>("entering");
  const [counterValue, setCounterValue] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const timeoutsRef = useRef<number[]>([]);
  const didCompleteRef = useRef(false);
  const lastRunIdRef = useRef<number | null>(null);
  const activeIndexRef = useRef(0);
  const enteringRef = useRef(false);
  const exitingRef = useRef(false);
  const phaseRef = useRef<StepPhase>(phase);
  const completedRef = useRef<number>(completedCount);
  const seqRef = useRef(0);
  const t0Ref = useRef(nowMs());
  const lastAdvanceAtRef = useRef(nowMs());
  const watchdogRef = useRef<number | null>(null);
  const startStepRef = useRef<((index: number) => void) | null>(null);
  const scheduleCounterRef = useRef<((index: number) => void) | null>(null);
  const stepStartAtRef = useRef<number | null>(null);
  const stepStartIndexRef = useRef<number | null>(null);

  const log = (event: string, hypothesisId: string, data?: Record<string, unknown>) => {
    if (!isStepperDebugEnabled()) return;
    seqRef.current += 1;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/46fdda1d-8e3a-47ea-90e2-1b619e07ea05", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix",
        hypothesisId,
        location: "BatchImportWorkflow.tsx",
        message: event,
        timestamp: Date.now(),
        data: {
          seq: seqRef.current,
          dtMs: Math.round(nowMs() - t0Ref.current),
          open,
          runIdProp: runId,
          batchId,
          activeIndex,
          phase,
          completedCount,
          isComplete,
          showCheck,
          stepLabel: STEPS[Math.min(activeIndex, STEP_TOTAL - 1)]?.label,
          ...data
        }
      })
    }).catch(() => {});
    // #endregion agent log
  };

  const progressMarks = useMemo(() => [0.3, 0.55, 0.8, 1], []);
  const effectiveCount = typeof importedCount === "number" ? importedCount : BATCH_SIZE;

  const clearTimers = () => {
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current = [];
  };

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    completedRef.current = completedCount;
  }, [completedCount]);

  useEffect(() => {
    log("RENDER", "H0");
  }, [open, runId, batchId, activeIndex, phase, completedCount, isComplete, showCheck]);

  useEffect(() => {
    if (!isStepperDebugEnabled()) return;
    if (watchdogRef.current) {
      window.clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    watchdogRef.current = window.setInterval(() => {
      const stallMs = Math.round(nowMs() - lastAdvanceAtRef.current);
      if (stallMs > 2000) {
        log("WATCHDOG_STALL", "H1", { stallMs });
      }
    }, 500);
    return () => {
      if (watchdogRef.current) {
        window.clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    clearTimers();
    didCompleteRef.current = false;
    enteringRef.current = false;
    exitingRef.current = false;
    log("RESET_EFFECT", "H5");

    if (!open) {
      setActiveIndex(0);
      setPhase("entering");
      setCounterValue(0);
      setCompletedCount(0);
      setIsComplete(false);
      setShowCheck(false);
      return;
    }

    if (lastRunIdRef.current === runId) {
      log("RUNID_GUARD_HIT", "H5");
      return;
    }
    lastRunIdRef.current = runId;

    const finishWorkflow = () => {
      setIsComplete(true);
      if (!didCompleteRef.current) {
        didCompleteRef.current = true;
        onComplete();
      }
    };

    if (prefersReducedMotion) {
      log("REDUCED_MOTION_COMPLETE", "H0");
      setActiveIndex(STEPS.length - 1);
      setPhase("settled");
      setCounterValue(BATCH_SIZE);
      setCompletedCount(STEPS.length);
      setShowCheck(true);
      finishWorkflow();
      return;
    }

    const startStep = (index: number) => {
      log("START_STEP", "H0", { index, label: STEPS[index]?.label });
      activeIndexRef.current = index;
      setActiveIndex(index);
      setCounterValue(0);
      setShowCheck(false);
      setPhase("entering");
      if (import.meta.env.DEV) {
        stepStartAtRef.current = nowMs();
        stepStartIndexRef.current = index;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          enteringRef.current = true;
          lastAdvanceAtRef.current = nowMs();
          setPhase("settled");
        });
      });
    };

    const scheduleCounter = (index: number) => {
      if (!COUNTER_STEPS.has(index)) {
        return;
      }
      progressMarks.forEach((mark) => {
        const timeout = window.setTimeout(() => {
          const nextValue = Math.min(
            BATCH_SIZE,
            Math.max(1, Math.round(BATCH_SIZE * mark))
          );
          setCounterValue(nextValue);
        }, Math.round(SETTLE_MS * mark));
        timeoutsRef.current.push(timeout);
      });
    };

    const runStep = (index: number) => {
      if (index >= STEPS.length) {
        finishWorkflow();
        return;
      }
      log("RUN_STEP", "H0", { index, label: STEPS[index]?.label });
      startStep(index);
      scheduleCounter(index);
    };

    startStepRef.current = startStep;
    scheduleCounterRef.current = scheduleCounter;

    setActiveIndex(0);
    setCompletedCount(0);
    setIsComplete(false);
    runStep(0);

    return () => {
      clearTimers();
    };
  }, [open, runId, batchId, onComplete, prefersReducedMotion, progressMarks]);

  const progressPercent = isComplete
    ? 100
    : Math.min(100, (completedCount / STEP_TOTAL) * 100);

  const stageIndex = activeIndex <= 1 ? 0 : activeIndex <= 4 ? 1 : activeIndex <= 6 ? 2 : 3;
  const counterLabel = COUNTER_LABELS[activeIndex] ?? "Processed";

  const handleCardTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== "transform") {
      return;
    }
    log("TRANSITION_END", "H1", {
      propertyName: event.propertyName,
      phaseAtCallback: phaseRef.current,
      enteringFlag: enteringRef.current,
      exitingFlag: exitingRef.current,
      activeIndexRef: activeIndexRef.current,
      completedRef: completedRef.current
    });
    if (phaseRef.current === "settled" && enteringRef.current) {
      enteringRef.current = false;
      setShowCheck(true);
      log("SETTLED_COMPLETE", "H2", {
        activeIndex: activeIndexRef.current,
        label: STEPS[activeIndexRef.current]?.label
      });
      const timeout = window.setTimeout(() => {
        exitingRef.current = true;
        setPhase("exiting");
      }, SETTLE_MS);
      timeoutsRef.current.push(timeout);
      return;
    }
    if (phaseRef.current === "exiting" && exitingRef.current) {
      exitingRef.current = false;
      log("EXIT_COMPLETE", "H3", {
        activeIndex: activeIndexRef.current,
        label: STEPS[activeIndexRef.current]?.label
      });
      if (import.meta.env.DEV) {
        const startAt = stepStartAtRef.current;
        const startedIndex = stepStartIndexRef.current;
        const elapsedMs = startAt ? Math.round(nowMs() - startAt) : null;
        // eslint-disable-next-line no-console
        console.log(
          `[STEPPER] step ${startedIndex ?? activeIndexRef.current} elapsed ${elapsedMs ?? "?"}ms`
        );
        if (elapsedMs !== null && elapsedMs > STEP_MAX_MS) {
          // eslint-disable-next-line no-console
          console.warn("[STEPPER] step exceeded STEP_MAX_MS", {
            elapsedMs,
            ENTER_MS,
            SETTLE_MS,
            EXIT_MS,
            STEP_MAX_MS,
            phaseAtEnd: phaseRef.current
          });
        }
      }
      setCompletedCount((prev) => {
        const next = prev + 1;
        if (next >= STEP_TOTAL) {
          setIsComplete(true);
          return next;
        }
        return next;
      });
      const nextIndex = activeIndexRef.current + 1;
      if (nextIndex < STEP_TOTAL) {
        log("ADVANCE_NEXT", "H4", { nextIndex, label: STEPS[nextIndex]?.label });
        startStepRef.current?.(nextIndex);
        scheduleCounterRef.current?.(nextIndex);
      }
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Batch import workflow"
    >
      <div className="w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
        <div className="sticky top-0 z-10 -mx-6 mb-4 bg-white px-6 pt-1">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Batch {batchId} • {effectiveCount} variances
              </div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Importing ERP Variance Batch
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Simulated walkthrough: the import already finished; these steps illustrate
                the pipeline and are not live processing events.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  isComplete
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {isComplete ? "Complete" : "Running"}
              </span>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wide">
                  Overall progress
                </span>
                <span>
                  {isComplete
                    ? "Complete"
                    : `Step ${Math.min(activeIndex + 1, STEP_TOTAL)} of ${STEP_TOTAL}`}
                </span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-slate-900 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {!isComplete ? (
              <div className="flex items-start gap-3">
                <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-600">
                  {showCheck ? "✓" : "•"}
                </div>
                <div className="relative flex-1 overflow-hidden">
                  <div
                    key={`step-${activeIndex}`}
                    className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition-[transform,opacity] ease-out"
                    style={{
                      transform:
                        phase === "entering"
                          ? "translateX(40px)"
                          : phase === "exiting"
                            ? "translateX(-40px)"
                            : "translateX(0)",
                      opacity: phase === "entering" || phase === "exiting" ? 0 : 1,
                      transitionProperty: "transform, opacity",
                      transitionDuration:
                        phase === "exiting"
                          ? `${EXIT_MS}ms`
                          : `${ENTER_MS}ms`
                    }}
                    onTransitionEnd={handleCardTransitionEnd}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Active step
                    </div>
                    <div className="mt-1 text-base font-semibold text-slate-900">
                      {STEPS[Math.min(activeIndex, STEP_TOTAL - 1)].label}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {STEPS[Math.min(activeIndex, STEP_TOTAL - 1)].description}
                    </div>
                    {COUNTER_STEPS.has(activeIndex) ? (
                      <div className="mt-2 text-xs font-semibold text-slate-600">
                        {counterLabel} {counterValue}/{BATCH_SIZE}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {isComplete ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700">
                    ✓
                  </span>
                  Ready for Human Review
                </div>
                <div className="mt-1 text-xs text-emerald-800">
                  {effectiveCount} cases published to Inbox.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                    onClick={onViewInbox}
                    disabled={!onViewInbox}
                  >
                    View Inbox
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pipeline
            </div>
            <div className="mt-3 space-y-3 text-xs text-slate-600">
              {["ERP", "Agent Pipeline", "Case Packets", "Inbox"].map((label, index) => (
                <div key={label} className="flex items-center gap-3">
                  <span
                    className={`flex h-3 w-3 items-center justify-center rounded-full border ${
                      stageIndex >= index
                        ? "border-slate-900 bg-slate-900"
                        : "border-slate-300 bg-white"
                    }`}
                  />
                  <span className={stageIndex >= index ? "text-slate-900" : "text-slate-500"}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-900">Status</div>
              <div className="mt-1">
                {isComplete
                  ? "Batch published to Inbox."
                  : "Running reconciliation workflow."}
              </div>
            </div>
            {!prefersReducedMotion ? (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                <span>Streaming ERP events</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
