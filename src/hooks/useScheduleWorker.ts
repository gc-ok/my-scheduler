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
      const { status, data, error, message, percentage, variantId } = e.data;

      if (status === 'PROGRESS') {
        setState(prev => ({ ...prev, genProgress: { msg: message, pct: percentage } }));
        return;
      }

      setState(prev => ({ ...prev, isGenerating: false }));
      if (status === 'SUCCESS') {
        saveToDB("schedule", data);
        setSchedule(data);
        setStep(99);
      } else if (status === 'VARIANT_SUCCESS') {
        setSchedule((prevSchedule) => {
          if (!prevSchedule) return null;
          const newSchedule = {
            ...prevSchedule,
            variants: {
              ...prevSchedule.variants,
              [variantId]: data,
            }
          };
          saveToDB("schedule", newSchedule);
          return newSchedule;
        });
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
    const configPayload = buildScheduleConfig(config);
    workerRef.current?.postMessage({ action: 'GENERATE', configPayload });
  };

  const regenerate = (schedule: ScheduleResult, activeVariantId = 'default') => {
    setState(prev => ({ ...prev, isGenerating: true, genProgress: { msg: "Refactoring...", pct: 0 } }));

    const activeVariant = schedule.variants[activeVariantId];
    if (!activeVariant) {
      console.error("Could not find active variant in schedule to regenerate.");
      setState(prev => ({...prev, isGenerating: false}));
      return;
    }

    const lockedSections = activeVariant.sections.filter((s: Section) => s.locked);
    const manualSections = activeVariant.sections.filter((s: Section) => s.isManual && !s.locked);
    const sizeOverrides = activeVariant.sections
      .filter((s: Section) => s.enrollment !== s.maxSize && !s.isManual)
      .map((s: Section) => ({ sectionId: s.id, enrollment: s.enrollment }));

    // Rebuild the config payload, but only for the single variant we are regenerating
    const fullPayload = buildScheduleConfig(config);
    const regenTargetConfig = fullPayload.configs[activeVariantId];
    
    const singleVariantDef = schedule.variantDefs.find(v => v.id === activeVariantId) || { id: 'default', name: 'Default', assignedDays: []};

    const regenPayload = {
      structure: 'single',
      variantDefs: [singleVariantDef],
      configs: {
        'default': { ...regenTargetConfig, lockedSections, manualSections }
      }
    };

    workerRef.current?.postMessage({ action: 'GENERATE_WITH_OVERRIDES', configPayload: regenPayload, sizeOverrides, targetVariantId: activeVariantId });
  };

  const clearError = () => setState(prev => ({ ...prev, errorState: null }));

  return { ...state, generate, regenerate, clearError };
}
