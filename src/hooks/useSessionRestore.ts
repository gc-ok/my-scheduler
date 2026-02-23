import { useEffect, useState } from "react";
import { WizardState, ScheduleResult } from "../types";
import { loadFromDB, clearDB } from "../utils/db";

interface PendingRestore {
  config: WizardState;
  step: number;
  schedule: ScheduleResult | null;
}

export function useSessionRestore() {
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);

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
  }, []);

  const acceptRestore = () => {
    const data = pendingRestore;
    setPendingRestore(null);
    return data;
  };

  const declineRestore = async () => {
    setPendingRestore(null);
    await clearDB();
  };

  return { isDataLoaded, pendingRestore, acceptRestore, declineRestore };
}
