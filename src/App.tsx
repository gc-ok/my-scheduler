import { useState, useEffect, useRef } from "react";
import ScheduleGridView from "./components/grid/ScheduleGridView";
import WizardController from "./views/wizard/WizardController";
import { Logo } from "./components/ui/CoreUI";
import { ScheduleConfig, ScheduleResult, Section } from "./types";
import { buildScheduleConfig } from "./utils/scheduleConfig";
import { saveToDB, loadFromDB, clearDB } from "./utils/db";
import { validateConfig } from "./utils/validator";
import css from "./App.module.css";

export default function App() {
  const [step, setStep] = useState<number>(0);
  const [config, setConfig] = useState<Partial<ScheduleConfig>>({});
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genProgress, setGenProgress] = useState({ msg: "Starting...", pct: 0 });
  const [errorState, setErrorState] = useState<{ title: string; messages: string[] } | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Welcome-back restore prompt
  const [pendingRestore, setPendingRestore] = useState<{
    config: Partial<ScheduleConfig>;
    step: number;
    schedule: ScheduleResult | null;
  } | null>(null);

  // --- PERSISTENCE LOGIC ---
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedConfig = await loadFromDB<Partial<ScheduleConfig>>("config");
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

  const handleContinueSession = () => {
    if (pendingRestore) {
      setConfig(pendingRestore.config);
      setStep(pendingRestore.step);
      if (pendingRestore.schedule) setSchedule(pendingRestore.schedule);
    }
    setPendingRestore(null);
  };

  const handleStartOver = async () => {
    setPendingRestore(null);
    setConfig({});
    setStep(0);
    setSchedule(null);
    await clearDB();
  };

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

  useEffect(() => {
    workerRef.current = new Worker(new URL('./core/worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { status, data, error, message, percentage } = e.data;

      if (status === 'PROGRESS') {
        setGenProgress({ msg: message, pct: percentage });
        return;
      }

      setIsGenerating(false);
      if (status === 'SUCCESS') {
        const { logs, placementHistory, ...leanSchedule } = data;
        saveToDB("schedule", leanSchedule);
        setSchedule(data);
        setStep(99);
      } else {
        console.error("Scheduling Engine Error:", error);
        setErrorState({ title: "Scheduling Engine Error", messages: [error || "An unknown error occurred."] });
      }
    };

    return () => { workerRef.current?.terminate(); };
  }, []);

  const gen = () => {
    setErrorState(null);
    const validationErrors = validateConfig(config);
    if (validationErrors.length > 0) {
      setErrorState({ title: "Configuration Error", messages: validationErrors });
      return;
    }

    setIsGenerating(true);
    const finalConfig = buildScheduleConfig(config);
    setGenProgress({ msg: "Initializing...", pct: 0 });
    workerRef.current?.postMessage({ action: 'GENERATE', config: finalConfig });
  };

  const regen = () => {
    if (!schedule) return;
    setIsGenerating(true);
    setGenProgress({ msg: "Refactoring...", pct: 0 });

    const lockedSections = schedule.sections.filter((s: Section) => s.locked);
    const manualSections = schedule.sections.filter((s: Section) => s.isManual && !s.locked);
    const sizeOverrides = schedule.sections
      .filter((s: Section) => s.enrollment !== s.maxSize && !s.isManual)
      .map((s: Section) => ({ sectionId: s.id, enrollment: s.enrollment }));

    const regenConfig = { ...buildScheduleConfig(config), lockedSections, manualSections };
    workerRef.current?.postMessage({ action: 'GENERATE_WITH_OVERRIDES', config: regenConfig, sizeOverrides });
  };

  const exportCSV = () => {
    if (!schedule?.sections) return;

    const headers = [
      "Course ID", "Course Name", "Section ID", "Section Number",
      "Teacher ID", "Teacher Name", "Room", "Period", "Term",
      "Enrollment", "Max Size"
    ];

    const safe = (val: string | number | null | undefined) => `"${String(val || '').replace(/"/g, '""')}"`;

    const rows = schedule.sections.map((s: Section) => [
      safe(s.courseId), safe(s.courseName), safe(s.id), s.sectionNum,
      safe(s.teacher), safe(s.teacherName), safe(s.room), safe(s.period),
      s.term || "FY", s.enrollment, s.maxSize
    ].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `master_schedule_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ErrorModal = () => (
    <div className={css.errorOverlay} role="dialog" aria-modal="true" aria-labelledby="error-title">
      <div className={css.errorModal}>
        <h3 id="error-title" className={css.errorTitle}>{errorState?.title}</h3>
        <ul className={css.errorList}>
          {errorState?.messages.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
        <button className={css.errorDismiss} onClick={() => setErrorState(null)}>
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
        <ScheduleGridView schedule={schedule} config={config} setSchedule={setSchedule} onRegenerate={regen} onBackToConfig={() => setStep(9)} onExport={exportCSV} />
      </div>
    );
  }

  return (
    <div className={css.root}>
      {errorState && <ErrorModal />}
      <WizardController step={step} setStep={setStep} config={config} setConfig={setConfig} onComplete={gen} />
    </div>
  );
}
