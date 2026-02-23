import { useState, useEffect, useCallback } from "react";
import ScheduleGridView from "./components/grid/ScheduleGridView";
import WizardController from "./views/wizard/WizardController";
import { Logo } from "./components/ui/CoreUI";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WizardState, ScheduleResult } from "./types";
import { saveToDB } from "./utils/db";
import { useScheduleWorker } from "./hooks/useScheduleWorker";
import { useSessionRestore } from "./hooks/useSessionRestore";
import { useScheduleExport } from "./hooks/useScheduleExport";
import css from "./App.module.css";

export default function App() {
  const [step, setStep] = useState<number>(0);
  const [config, setConfig] = useState<WizardState>({});
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);

  const { isDataLoaded, pendingRestore, acceptRestore, declineRestore } = useSessionRestore();
  const { isGenerating, genProgress, errorState, generate, regenerate, clearError } = useScheduleWorker(config, setSchedule, setStep);
  const { exportCSV } = useScheduleExport(schedule);

  // Debounced persistence
  useEffect(() => {
    if (!isDataLoaded) return;
    const timer = setTimeout(() => {
      if (Object.keys(config).length > 0) {
        saveToDB("config", config);
        saveToDB("step", step);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [config, step, isDataLoaded]);

  const handleContinueSession = useCallback(() => {
    const data = acceptRestore();
    if (data) {
      setConfig(data.config);
      setStep(data.step);
      if (data.schedule) setSchedule(data.schedule);
    }
  }, [acceptRestore]);

  const handleStartOver = useCallback(async () => {
    await declineRestore();
    setConfig({});
    setStep(0);
    setSchedule(null);
  }, [declineRestore]);

  const regen = useCallback(() => {
    if (schedule) regenerate(schedule);
  }, [schedule, regenerate]);

  const ErrorModal = () => (
    <div className={css.errorOverlay} role="dialog" aria-modal="true" aria-labelledby="error-title">
      <div className={css.errorModal}>
        <h3 id="error-title" className={css.errorTitle}>{errorState?.title}</h3>
        <ul className={css.errorList}>
          {errorState?.messages.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
        <button className={css.errorDismiss} onClick={clearError}>
          Dismiss & Fix
        </button>
      </div>
    </div>
  );

  if (isGenerating) {
    return (
      <div className={css.loadingRoot}>
        <Logo size={60} />
        <h2 className={css.loadingTitle}>Generating Master Schedule...</h2>
        <div className={css.progressBar}>
          <div className={css.progressFill} style={{ width: `${genProgress.pct}%` }} />
        </div>
        <p className={css.progressText}>{genProgress.msg} ({genProgress.pct}%)</p>
      </div>
    );
  }

  if (pendingRestore) {
    const stepLabel = pendingRestore.step === 99 ? "a completed schedule" : `step ${pendingRestore.step} of 10`;
    return (
      <div className={css.loadingRoot}>
        <Logo size={60} />
        <div className={css.welcomeBack}>
          <h2 className={css.welcomeTitle}>Welcome Back!</h2>
          <p className={css.welcomeDesc}>
            You have a saved session at {stepLabel}. Would you like to pick up where you left off?
          </p>
          <div className={css.welcomeActions}>
            <button className={css.welcomeBtnPrimary} onClick={handleContinueSession}>
              Continue Session
            </button>
            <button className={css.welcomeBtnSecondary} onClick={handleStartOver}>
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 99 && schedule) {
    return (
      <div className={css.root}>
        {errorState && <ErrorModal />}
        <div className={css.scheduleHeader}>
          <div className={css.scheduleHeaderLeft}>
            <Logo size={30} />
            <div className={css.scheduleHeaderInfo}>
              {config.schoolType} · {config.scheduleType?.replace(/_/g, " ")} · {config.periodsCount || 7} periods
            </div>
          </div>
          <div className={css.scheduleHeaderStats}>
            {schedule.stats?.scheduledCount}/{schedule.stats?.totalSections} scheduled · {schedule.stats?.conflictCount} conflicts
          </div>
        </div>
        <ErrorBoundary>
          <ScheduleGridView schedule={schedule} config={config} setSchedule={setSchedule} onRegenerate={regen} onBackToConfig={() => setStep(9)} onExport={exportCSV} />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className={css.root}>
      {errorState && <ErrorModal />}
      <WizardController step={step} setStep={setStep} config={config} setConfig={setConfig} onComplete={generate} />
    </div>
  );
}
