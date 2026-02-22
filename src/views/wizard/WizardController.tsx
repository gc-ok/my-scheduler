// src/views/wizard/WizardController.tsx
import { COLORS } from "../../utils/theme";
import { Logo, Btn, Card } from "../../components/ui/CoreUI";

import {
  SchoolTypeStep, ScheduleTypeStep, BellScheduleStep, LunchStep,
  PlanPLCStep, WINTimeStep, RecessStep, DataInputStep, GenericInputStep,
  CSVUploadStep, ConstraintsStep
} from "./steps";

import { ScheduleConfig } from "../../types";
import css from "./WizardController.module.css";

interface WizardControllerProps {
  step: number;
  setStep: (step: number) => void;
  config: Partial<ScheduleConfig>;
  setConfig: (config: Partial<ScheduleConfig>) => void;
  onComplete: () => void;
}

export default function WizardController({ step, setStep, config, setConfig, onComplete }: WizardControllerProps) {
  const showRecess = !["high", "6_12"].includes(config.schoolType || "");

  const allSteps = [
    { id: 1, label: "School Type" }, { id: 2, label: "Schedule Type" }, { id: 3, label: "Bell Schedule" },
    { id: 4, label: "Lunch" }, { id: 5, label: "Plan & PLC" }, { id: 6, label: "WIN Time" },
    ...(showRecess ? [{ id: 7, label: "Recess" }] : []),
    { id: 8, label: "Data Input" },
    { id: 9, label: config.inputMode === "csv" ? "CSV Upload" : (config.schoolType === "elementary" || config.schoolType === "k8" ? "Cohort Setup" : "Quick Setup") },
    { id: 10, label: "Constraints" }
  ];

  return (
    <>
      <div className={css.header}>
        <Logo size={36} />
      </div>

      {step > 0 && (
        <nav className={css.navBar} aria-label="Wizard steps">
          <div className={css.navItems}>
            {allSteps.map((s, i) => (
              <div key={i} className={css.navItemContainer}>
                <button
                  className={css.navPill}
                  onClick={() => s.id <= step && setStep(s.id)}
                  disabled={s.id > step}
                  aria-current={s.id === step ? "step" : undefined}
                  style={{
                    cursor: s.id <= step ? "pointer" : "default",
                    background: s.id === step ? COLORS.primary : s.id < step ? COLORS.accentLight : COLORS.lightGray,
                    color: s.id === step ? COLORS.white : s.id < step ? COLORS.primary : COLORS.midGray,
                    fontWeight: s.id === step ? 700 : 500,
                  }}
                >{s.label}</button>
                {i < allSteps.length - 1 && (
                  <div className={css.navLine} style={{ background: s.id < step ? COLORS.accent : COLORS.lightGray }} />
                )}
              </div>
            ))}
          </div>
        </nav>
      )}

      <div className={css.contentContainer}>
        {step === 0 && (
          <div className={css.landingWrapper}>
            <div className={css.landingLogo}><Logo size={80} /></div>
            <h1 className={css.landingTitle}>K-12 Master Scheduler</h1>
            <p className={css.landingDesc}>Build your master schedule in minutes. Configure, generate, and fine-tune.</p>
            <Btn onClick={() => setStep(1)} style={{ padding: "14px 32px", fontSize: 16 }}>Start New Project</Btn>
            <div className={css.landingGrid}>
              {[
                { i: "🏫", t: "All School Types", d: "K-5 through 12" },
                { i: "⚡", t: "Smart Algorithm", d: "Home rooms, student accounting, capacity validation" },
                { i: "🔄", t: "Dynamic Models", d: "A/B Blocks, 4x4, and Traditional Schedules." },
                { i: "📊", t: "Detailed Analytics", d: "Period-by-period student coverage tracking" },
              ].map(f => (
                <Card key={f.t}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{f.i}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{f.t}</div>
                  <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.4 }}>{f.d}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* DYNAMIC ROUTING */}
        {step === 1 && <SchoolTypeStep config={config} setConfig={setConfig} onNext={() => setStep(2)} />}
        {step === 2 && <ScheduleTypeStep config={config} setConfig={setConfig} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <BellScheduleStep config={config} setConfig={setConfig} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <LunchStep config={config} setConfig={setConfig} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
        {step === 5 && <PlanPLCStep config={config} setConfig={setConfig} onNext={() => setStep(6)} onBack={() => setStep(4)} />}
        {step === 6 && <WINTimeStep config={config} setConfig={setConfig} onNext={() => setStep(showRecess ? 7 : 8)} onBack={() => setStep(5)} />}
        {step === 7 && showRecess && <RecessStep config={config} setConfig={setConfig} onNext={() => setStep(8)} onBack={() => setStep(6)} />}
        {step === 8 && <DataInputStep config={config} setConfig={setConfig} onNext={() => setStep(9)} onBack={() => setStep(showRecess ? 7 : 6)} />}
        {step === 9 && config.inputMode === "csv" && <CSVUploadStep config={config} setConfig={setConfig} onNext={() => setStep(10)} onBack={() => setStep(8)} />}
        {step === 9 && config.inputMode !== "csv" && <GenericInputStep config={config} setConfig={setConfig} onNext={() => setStep(10)} onBack={() => setStep(8)} />}
        {step === 10 && <ConstraintsStep config={config} setConfig={setConfig} onNext={onComplete} onBack={() => setStep(9)} />}
      </div>
    </>
  );
}
