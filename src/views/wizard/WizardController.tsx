// src/views/wizard/WizardController.tsx
import { COLORS } from "../../utils/theme";
import { Logo, Btn, Card } from "../../components/ui/CoreUI";

import {
  MultiScheduleStepWrapper,
  SchoolTypeStep, ScheduleStructureStep, ScheduleTypeStep, BellScheduleStep, LunchStep,
  PlanPLCStep, WINTimeStep, RecessStep, DataInputStep, GenericInputStep,
  CSVUploadStep, CSVMappingStep, ConstraintsStep
} from "./steps";

import { WizardState } from "../../types";
import css from "./WizardController.module.css";

interface WizardControllerProps {
  step: number;
  setStep: (step: number) => void;
  config: WizardState;
  setConfig: (config: WizardState) => void;
  onComplete: () => void;
}

export default function WizardController({ step, setStep, config, setConfig, onComplete }: WizardControllerProps) {
  // For custom schools, check if the grade range includes elementary grades (K-5) to decide on recess
  const customRange = config.customGradeRange;
  const customHasElem = config.schoolType === "custom" && !!customRange &&
    ["K","1","2","3","4","5"].some(g => {
      const all = ["K","1","2","3","4","5","6","7","8","9","10","11","12"];
      const fi = all.indexOf(customRange.from);
      const ti = all.indexOf(customRange.to);
      const gi = all.indexOf(g);
      return fi !== -1 && ti !== -1 && gi >= fi && gi <= ti;
    });

  // Show recess for elementary-containing schools (not pure middle/high)
  const showRecess = !["high","6_12"].includes(config.schoolType || "") || customHasElem;

  const isElemType = config.schoolType === "elementary" || config.schoolType === "k8" || config.schoolType === "k12" || customHasElem;
  const stepLabel10 = config.inputMode === "csv" ? "CSV Upload" : (isElemType ? "Cohort Setup" : "Quick Setup");

  const isCsvMode = config.inputMode === "csv";
  const constraintsStep = isCsvMode ? 12 : 11;

  const allSteps = [
    { id: 1, label: "School Type" }, { id: 2, label: "Schedule Structure" }, { id: 3, label: "Schedule Type" }, { id: 4, label: "Bell Schedule" },
    { id: 5, label: "Lunch" }, { id: 6, label: "Plan & PLC" }, { id: 7, label: "WIN Time" },
    ...(showRecess ? [{ id: 8, label: "Recess" }] : []),
    { id: 9, label: "Data Input" },
    { id: 10, label: stepLabel10 },
    ...(isCsvMode ? [{ id: 11, label: "CSV Mapping" }] : []),
    { id: constraintsStep, label: "Constraints" },
  ];

  return (
    <>
      <div className={css.header}>
        <a href="/index.html" className={css.navBrand}>
          <Logo size={32} />
          <span>K-12 Master Scheduler</span>
        </a>
        <a href="/index.html" className={css.navLink}>&larr; Homepage</a>
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
        {step === 2 && <ScheduleStructureStep config={config} setConfig={setConfig} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && (config.scheduleStructure === 'multiple' ? (
          <MultiScheduleStepWrapper config={config} setConfig={setConfig}>
            <ScheduleTypeStep config={config} setConfig={setConfig} onNext={() => setStep(4)} onBack={() => setStep(2)} />
          </MultiScheduleStepWrapper>
        ) : (
          <ScheduleTypeStep config={config} setConfig={setConfig} onNext={() => setStep(4)} onBack={() => setStep(2)} />
        ))}
        {step === 4 && (config.scheduleStructure === 'multiple' ? (
          <MultiScheduleStepWrapper config={config} setConfig={setConfig}>
            <BellScheduleStep config={config} setConfig={setConfig} onNext={() => setStep(5)} onBack={() => setStep(3)} />
          </MultiScheduleStepWrapper>
        ) : (
          <BellScheduleStep config={config} setConfig={setConfig} onNext={() => setStep(5)} onBack={() => setStep(3)} />
        ))}
        {step === 5 && (config.scheduleStructure === 'multiple' ? (
          <MultiScheduleStepWrapper config={config} setConfig={setConfig}>
            <LunchStep config={config} setConfig={setConfig} onNext={() => setStep(6)} onBack={() => setStep(4)} />
          </MultiScheduleStepWrapper>
        ) : (
          <LunchStep config={config} setConfig={setConfig} onNext={() => setStep(6)} onBack={() => setStep(4)} />
        ))}
        {step === 6 && (config.scheduleStructure === 'multiple' ? (
          <MultiScheduleStepWrapper config={config} setConfig={setConfig}>
            <PlanPLCStep config={config} setConfig={setConfig} onNext={() => setStep(7)} onBack={() => setStep(5)} />
          </MultiScheduleStepWrapper>
        ) : (
          <PlanPLCStep config={config} setConfig={setConfig} onNext={() => setStep(7)} onBack={() => setStep(5)} />
        ))}
        {step === 7 && (config.scheduleStructure === 'multiple' ? (
          <MultiScheduleStepWrapper config={config} setConfig={setConfig}>
            <WINTimeStep config={config} setConfig={setConfig} onNext={() => setStep(showRecess ? 8 : 9)} onBack={() => setStep(6)} />
          </MultiScheduleStepWrapper>
        ) : (
          <WINTimeStep config={config} setConfig={setConfig} onNext={() => setStep(showRecess ? 8 : 9)} onBack={() => setStep(6)} />
        ))}
        {step === 8 && showRecess && (config.scheduleStructure === 'multiple' ? (
          <MultiScheduleStepWrapper config={config} setConfig={setConfig}>
            <RecessStep config={config} setConfig={setConfig} onNext={() => setStep(9)} onBack={() => setStep(7)} />
          </MultiScheduleStepWrapper>
        ) : (
          <RecessStep config={config} setConfig={setConfig} onNext={() => setStep(9)} onBack={() => setStep(7)} />
        ))}
        {step === 9 && <DataInputStep config={config} setConfig={setConfig} onNext={() => setStep(10)} onBack={() => setStep(showRecess ? 8 : 7)} />}
        {step === 10 && isCsvMode && <CSVUploadStep config={config} setConfig={setConfig} onNext={() => setStep(11)} onBack={() => setStep(9)} />}
        {step === 10 && !isCsvMode && <GenericInputStep config={config} setConfig={setConfig} onNext={() => setStep(11)} onBack={() => setStep(9)} />}
        {step === 11 && isCsvMode && <CSVMappingStep onNext={() => setStep(12)} onBack={() => setStep(10)} />}
        {step === 11 && !isCsvMode && <ConstraintsStep config={config} setConfig={setConfig} onNext={onComplete} onBack={() => setStep(10)} />}
        {step === 12 && isCsvMode && <ConstraintsStep config={config} setConfig={setConfig} onNext={onComplete} onBack={() => setStep(11)} />}
      </div>
    </>
  );
}
