import { useState, useEffect, useRef } from "react";
import { COLORS } from "./utils/theme";
// Note: Removed the direct import of generateSchedule from here
import ScheduleGridView from "./components/grid/ScheduleGridView";
import WizardController from "./views/wizard/WizardController";
import { Logo } from "./components/ui/CoreUI"; 
import { ScheduleConfig, Section } from "./types";
import { buildScheduleConfig } from "./utils/scheduleConfig";

export default function App() {
  const [step, setStep] = useState<number>(0);
  const [config, setConfig] = useState<Partial<ScheduleConfig>>({});
  const [schedule, setSchedule] = useState<any>(null);
  
  // NEW: State to track when the worker is processing
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  // NEW: Ref to hold the worker instance
  const workerRef = useRef<Worker | null>(null);

  // NEW: Initialize the Web Worker on component mount
  useEffect(() => {
    workerRef.current = new Worker(new URL('./core/worker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      const { status, data, error } = e.data;
      setIsGenerating(false);

      if (status === 'SUCCESS') {
        setSchedule(data);
        setStep(99);
      } else {
        console.error("Scheduling Engine Error:", error);
        alert(`Gridlock or Engine Error: ${error}`);
      }
    };

    // Cleanup worker on unmount
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const gen = () => {
    setIsGenerating(true);
    const finalConfig = buildScheduleConfig(config);
    // Send message to the background worker
    workerRef.current?.postMessage({ action: 'GENERATE', config: finalConfig });
  };

  const regen = () => {
    if (!schedule) return;
    setIsGenerating(true);

    const lockedSections = schedule.sections.filter((s: Section) => s.locked);
    const manualSections = schedule.sections.filter((s: Section) => s.isManual && !s.locked);
    const sizeOverrides = schedule.sections
        .filter((s: Section) => s.enrollment !== s.maxSize && !s.isManual)
        .map((s: Section) => ({ sectionId: s.id, enrollment: s.enrollment }));

    const regenConfig = { ...buildScheduleConfig(config), lockedSections, manualSections };
    
    // Send the regeneration request to the worker
    workerRef.current?.postMessage({ 
      action: 'GENERATE_WITH_OVERRIDES', 
      config: regenConfig, 
      sizeOverrides 
    });
  };

  const rootStyle = { minHeight: "100vh", background: COLORS.offWhite, fontFamily: "'Segoe UI', system-ui, sans-serif", colorScheme: "light", color: COLORS.text };

  // NEW: Display a loading overlay while the background worker is running
  if (isGenerating) {
    return (
      <div style={{ ...rootStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <Logo size={60} />
        <h2 style={{ marginTop: 20, color: COLORS.primary }}>Generating Master Schedule...</h2>
        <p style={{ color: COLORS.textLight }}>This may take a few moments depending on constraints.</p>
      </div>
    );
  }

  if (step === 99 && schedule) {
    return (
      <div style={rootStyle}>
        <div style={{ background: COLORS.white, padding: "10px 20px", borderBottom: `1px solid ${COLORS.lightGray}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Logo size={30} />
            <div style={{ fontSize: 13, color: COLORS.textLight }}>
              {config.schoolType} · {config.scheduleType?.replace(/_/g, " ")} · {config.periodsCount || 7} periods
            </div>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textLight }}>
            {schedule.stats?.scheduledCount}/{schedule.stats?.totalSections} scheduled · {schedule.stats?.conflictCount} conflicts
          </div>
        </div>
        <ScheduleGridView schedule={schedule} config={config} setSchedule={setSchedule} onRegenerate={regen} onBackToConfig={() => setStep(9)} />
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <WizardController step={step} setStep={setStep} config={config} setConfig={setConfig} onComplete={gen} />
    </div>
  );
}