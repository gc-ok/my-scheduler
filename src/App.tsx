import { useEffect, useCallback } from "react";
import useScheduleStore from "./store/useScheduleStore";
import ScheduleGridView from "./components/grid/ScheduleGridView";
import WizardController from "./views/wizard/WizardController";
import { Logo } from "./components/ui/CoreUI";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { saveToDB, saveToDBSync } from "./utils/db";
import { useScheduleWorker } from "./hooks/useScheduleWorker";
import { useSessionRestore } from "./hooks/useSessionRestore";
import { useScheduleExport } from "./hooks/useScheduleExport";
import css from "./App.module.css";

export default function App() {
  // Select state and actions from the Zustand store
  const {
    step,
    config,
    schedule,
    isGenerating,
    genProgress,
    errorState,
    pendingRestore,
    setStep,
    setConfig,
    setSchedule,
  } = useScheduleStore();

  // Hooks are now simpler and don't need props or return state
  const { isDataLoaded, acceptRestore, declineRestore } = useSessionRestore();
  const { generate, regenerate, clearError } = useScheduleWorker();
  const { exportCSV } = useScheduleExport(schedule);

  // Immediate save on step advancement — each step transition represents significant user
  // progress (completing a wizard screen) so we don't debounce it.
  useEffect(() => {
    if (!isDataLoaded) return;
    const { step, config } = useScheduleStore.getState();
    if (Object.keys(config).length > 0) {
      saveToDB("config", config);
      saveToDB("step", step);
    }
  }, [step, isDataLoaded]);

  // Debounced save for in-progress config edits (typing in fields, adjusting sliders, etc.)
  useEffect(() => {
    if (!isDataLoaded) return;
    const timer = setTimeout(() => {
      const { step, config } = useScheduleStore.getState();
      if (Object.keys(config).length > 0) {
        saveToDB("config", config);
        saveToDB("step", step);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [config, isDataLoaded]);

  // Flush pending saves synchronously before the browser destroys the page context.
  // Uses saveToDBSync (cached IDB connection) so the transaction starts in the same
  // call stack — async promise chains are not reliable inside beforeunload.
  useEffect(() => {
    const handleBeforeUnload = () => {
      const { step, config } = useScheduleStore.getState();
      if (Object.keys(config).length > 0) {
        saveToDBSync("config", config);
        saveToDBSync("step", step);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const regen = useCallback((activeVariantId = 'default') => {
    const currentSchedule = useScheduleStore.getState().schedule;
    if (currentSchedule) regenerate(currentSchedule, activeVariantId);
  }, [regenerate]);

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
            <button className={css.welcomeBtnPrimary} onClick={acceptRestore}>
              Continue Session
            </button>
            <button className={css.welcomeBtnSecondary} onClick={declineRestore}>
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 99 && schedule) {
    const firstVariantId = schedule.variantDefs?.[0]?.id || 'default';
    const firstVariant = schedule.variants[firstVariantId];

    return (
      <div className={css.root}>
        {errorState && <ErrorModal />}
        <div className={css.scheduleHeader}>
            <a href="/index.html" className={css.navBrand}>
                <Logo size={32} />
                <span className={css.navBrandText}>K-12 Master Scheduler</span>
            </a>
            <div className={css.scheduleHeaderRight}>
                <div className={css.scheduleHeaderInfo}>
                    {config.schoolType} · {config.scheduleType?.replace(/_/g, " ")} · {firstVariant?.periods?.length || config.periodsCount || 7} periods
                </div>
                <div className={css.scheduleHeaderStats}>
                    {firstVariant?.stats?.scheduledCount}/{firstVariant?.stats?.totalSections} scheduled · {firstVariant?.stats?.conflictCount} conflicts
                </div>
                <a href="/index.html" className={css.navLink}>&larr; Homepage</a>
            </div>
        </div>
        <ErrorBoundary>
          <ScheduleGridView schedule={schedule} config={config} setSchedule={setSchedule} onRegenerate={regen} onBackToConfig={() => setStep(9)} onExport={(fmt) => exportCSV(fmt)} />
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

