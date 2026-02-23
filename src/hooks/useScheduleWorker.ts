import { useEffect, useRef } from "react";
import useScheduleStore from "../store/useScheduleStore";
import { ScheduleResult, Section } from "../types";
import { buildScheduleConfig } from "../utils/scheduleConfig";
import { validateConfig } from "../utils/validator";
import { saveToDB } from "../utils/db";

export function useScheduleWorker() {
  const workerRef = useRef<Worker | null>(null);
  
  // Get state and actions from the Zustand store
  const { 
    config,
    setSchedule, 
    setStep, 
    setIsGenerating,
    setGenProgress,
    setErrorState 
  } = useScheduleStore();

  useEffect(() => {
    workerRef.current = new Worker(new URL('../core/worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { status, data, error, message, percentage, variantId } = e.data;

      if (status === 'PROGRESS') {
        setGenProgress({ msg: message, pct: percentage });
        return;
      }

      setIsGenerating(false);
      if (status === 'SUCCESS') {
        saveToDB("schedule", data);
        setSchedule(data);
        setStep(99);
      } else if (status === 'VARIANT_SUCCESS') {
        const currentSchedule = useScheduleStore.getState().schedule;
        if (!currentSchedule) return;
        
        const newSchedule = {
          ...currentSchedule,
          variants: {
            ...currentSchedule.variants,
            [variantId]: data,
          }
        };
        saveToDB("schedule", newSchedule);
        setSchedule(newSchedule);

      } else {
        console.error("Scheduling Engine Error:", error);
        setErrorState({ title: "Scheduling Engine Error", messages: [error || "An unknown error occurred."] });
      }
    };

    return () => { workerRef.current?.terminate(); };
  }, [setSchedule, setStep, setIsGenerating, setGenProgress, setErrorState]);

  const generate = () => {
    setErrorState(null);
    const validationErrors = validateConfig(config);
    if (validationErrors.length > 0) {
      setErrorState({ title: "Configuration Error", messages: validationErrors });
      return;
    }

    setIsGenerating(true);
    setGenProgress({ msg: "Initializing...", pct: 0 });
    const configPayload = buildScheduleConfig(config);
    workerRef.current?.postMessage({ action: 'GENERATE', configPayload });
  };

  const regenerate = (schedule: ScheduleResult, activeVariantId = 'default') => {
    setErrorState(null);
    setIsGenerating(true);
    setGenProgress({ msg: "Refactoring...", pct: 0 });

    const activeVariant = schedule.variants[activeVariantId];
    if (!activeVariant) {
      console.error("Could not find active variant in schedule to regenerate.");
      setIsGenerating(false);
      return;
    }

    // Calculate overrides from the current state of the schedule
    const lockedSections = activeVariant.sections.filter((s: Section) => s.locked);
    const manualSections = activeVariant.sections.filter((s: Section) => s.isManual && !s.locked);
    const sizeOverrides = activeVariant.sections
      .filter((s: Section) => s.enrollment !== s.maxSize && !s.isManual)
      .map((s: Section) => ({ sectionId: s.id, enrollment: s.enrollment }));

    // Rebuild the config payload, but only for the single variant we are regenerating
    const fullPayload = buildScheduleConfig(useScheduleStore.getState().config);
    const regenTargetConfig = fullPayload.configs[activeVariantId];
    
    const singleVariantDef = schedule.variantDefs.find(v => v.id === activeVariantId) || { id: 'default', name: 'Default', assignedDays: []};

    // This payload mimics a 'single' generation run, but with overrides added
    const regenPayload = {
      structure: 'single' as 'single',
      variantDefs: [singleVariantDef],
      configs: {
        'default': { ...regenTargetConfig, lockedSections, manualSections }
      }
    };

    workerRef.current?.postMessage({ 
      action: 'GENERATE_WITH_OVERRIDES', 
      configPayload: regenPayload, 
      sizeOverrides, 
      targetVariantId: activeVariantId 
    });
  };

  const clearError = () => setErrorState(null);

  // The hook now returns only the functions, as the state is global
  return { generate, regenerate, clearError };
}

