import { useEffect, useRef, useState } from "react";
import { WizardState, ScheduleResult, Section } from "../types";
import { buildScheduleConfig } from "../utils/scheduleConfig";
import { validateConfig } from "../utils/validator";
import { saveToDB } from "../utils/db";

interface WorkerState {
  isGenerating: boolean;
  genProgress: { msg: string; pct: number };
  errorState: { title: string; messages: string[] } | null;
}

export function useScheduleWorker(
  config: WizardState,
  setSchedule: (s: ScheduleResult) => void,
  setStep: (step: number) => void,
) {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<WorkerState>({
    isGenerating: false,
    genProgress: { msg: "Starting...", pct: 0 },
    errorState: null,
  });

  useEffect(() => {
    workerRef.current = new Worker(new URL('../core/worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { status, data, error, message, percentage } = e.data;

      if (status === 'PROGRESS') {
        setState(prev => ({ ...prev, genProgress: { msg: message, pct: percentage } }));
        return;
      }

      setState(prev => ({ ...prev, isGenerating: false }));
      if (status === 'SUCCESS') {
        saveToDB("schedule", data);
        setSchedule(data);
        setStep(99);
      } else {
        console.error("Scheduling Engine Error:", error);
        setState(prev => ({
          ...prev,
          errorState: { title: "Scheduling Engine Error", messages: [error || "An unknown error occurred."] },
        }));
      }
    };

    return () => { workerRef.current?.terminate(); };
  }, [setSchedule, setStep]);

  const generate = () => {
    setState(prev => ({ ...prev, errorState: null }));
    const validationErrors = validateConfig(config);
    if (validationErrors.length > 0) {
      setState(prev => ({
        ...prev,
        errorState: { title: "Configuration Error", messages: validationErrors },
      }));
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true, genProgress: { msg: "Initializing...", pct: 0 } }));
    const finalConfig = buildScheduleConfig(config);
    workerRef.current?.postMessage({ action: 'GENERATE', config: finalConfig });
  };

  const regenerate = (schedule: ScheduleResult) => {
    setState(prev => ({ ...prev, isGenerating: true, genProgress: { msg: "Refactoring...", pct: 0 } }));

    const lockedSections = schedule.sections.filter((s: Section) => s.locked);
    const manualSections = schedule.sections.filter((s: Section) => s.isManual && !s.locked);
    const sizeOverrides = schedule.sections
      .filter((s: Section) => s.enrollment !== s.maxSize && !s.isManual)
      .map((s: Section) => ({ sectionId: s.id, enrollment: s.enrollment }));

    const regenConfig = { ...buildScheduleConfig(config), lockedSections, manualSections };
    workerRef.current?.postMessage({ action: 'GENERATE_WITH_OVERRIDES', config: regenConfig, sizeOverrides });
  };

  const clearError = () => setState(prev => ({ ...prev, errorState: null }));

  return { ...state, generate, regenerate, clearError };
}
