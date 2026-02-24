import { useEffect, useState, useCallback } from "react";
import useScheduleStore from "../store/useScheduleStore";
import { WizardState, ScheduleResult } from "../types";
import { loadFromDB, clearDB } from "../utils/db";

export function useSessionRestore() {
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const { setPendingRestore, setConfig, setStep, setSchedule, reset } = useScheduleStore();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedConfig = await loadFromDB<WizardState>("config");
        const savedStep = await loadFromDB<number>("step");
        const savedSchedule = await loadFromDB<ScheduleResult>("schedule");

        if (savedConfig && savedStep !== null && savedStep > 0) {
          setPendingRestore({
            config: savedConfig,
            step: savedStep,
            schedule: savedSchedule,
          });
        }
      } catch (err) {
        console.warn("Could not restore session:", err);
      } finally {
        setIsDataLoaded(true);
      }
    };
    restoreSession();
  }, [setPendingRestore]);

  const acceptRestore = useCallback(() => {
    const data = useScheduleStore.getState().pendingRestore;
    if (data) {
      setConfig(data.config);
      setStep(data.step);
      if (data.schedule) {
        setSchedule(data.schedule);
      }
      setPendingRestore(null);
    }
  }, [setConfig, setStep, setSchedule, setPendingRestore]);

  const declineRestore = useCallback(async () => {
    setPendingRestore(null);
    await clearDB();
    reset();
  }, [setPendingRestore, reset]);

  return { isDataLoaded, acceptRestore, declineRestore };
}
