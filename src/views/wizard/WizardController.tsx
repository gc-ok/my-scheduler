// src/views/wizard/WizardController.tsx
import { COLORS } from "../../utils/theme";
import { Logo, Btn, Card } from "../../components/ui/CoreUI";

import { 
  SchoolTypeStep, ScheduleTypeStep, BellScheduleStep, LunchStep, 
  PlanPLCStep, WINTimeStep, RecessStep, DataInputStep, GenericInputStep, 
  CSVUploadStep, ConstraintsStep 
} from "./steps"; 

interface WizardControllerProps {
  step: number;
  setStep: (step: number) => void;
  config: any;
  setConfig: (config: any) => void;
  onComplete: () => void;
}

export default function WizardController({ step, setStep, config, setConfig, onComplete }: WizardControllerProps) {
  const showRecess = !["high", "6_12"].includes(config.schoolType);

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
      <div style={styles.header}>
        <Logo size={36} />
      </div>

      {step > 0 && (
        <div style={styles.navBar}>
          <div style={styles.navItems}>
            {allSteps.map((s, i) => (
              <div key={i} style={styles.navItemContainer}>
                <div onClick={() => s.id <= step && setStep(s.id)} style={{
                  ...styles.navPill,
                  cursor: s.id <= step ? "pointer" : "default",
                  background: s.id === step ? COLORS.primary : s.id < step ? COLORS.accentLight : COLORS.lightGray,
                  color: s.id === step ? COLORS.white : s.id < step ? COLORS.primary : COLORS.midGray,
                  fontWeight: s.id === step ? 700 : 500,
                }}>{s.label}</div>
                {i < allSteps.length - 1 && <div style={{ ...styles.navLine, background: s.id < step ? COLORS.accent : COLORS.lightGray }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.contentContainer}>
        {step === 0 && (
          <div style={styles.landingWrapper}>
            <div style={styles.landingLogo}><Logo size={80} /></div>
            <h1 style={styles.landingTitle}>K-12 Master Scheduler</h1>
            <p style={styles.landingDesc}>Build your master schedule in minutes. Configure, generate, and fine-tune.</p>
            <Btn onClick={() => setStep(1)} style={styles.landingBtn}>🚀 Start New Project</Btn>
            <div style={styles.landingGrid}>
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

const styles = {
  header: { background: COLORS.white, padding: "14px 24px", borderBottom: `1px solid ${COLORS.lightGray}`, display: "flex", justifyContent: "space-between", alignItems: "center" },
  navBar: { background: COLORS.white, padding: "10px 24px", borderBottom: `1px solid ${COLORS.lightGray}`, overflowX: "auto" as const },
  navItems: { display: "flex", gap: 4, alignItems: "center" },
  navItemContainer: { display: "flex", alignItems: "center" },
  navPill: { padding: "4px 10px", borderRadius: 20, fontSize: 12, whiteSpace: "nowrap" as const },
  navLine: { width: 12, height: 2, margin: "0 2px" },
  contentContainer: { maxWidth: 900, margin: "0 auto", padding: "30px 24px" },
  
  landingWrapper: { textAlign: "center" as const, paddingTop: 40 },
  landingLogo: { display: "flex", justifyContent: "center", marginBottom: 24 },
  landingTitle: { fontSize: 28, color: COLORS.primary, marginBottom: 8 },
  landingDesc: { fontSize: 15, color: COLORS.textLight, maxWidth: 480, margin: "0 auto 30px", lineHeight: 1.6 },
  landingBtn: { padding: "14px 32px", fontSize: 16 },
  landingGrid: { marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16, textAlign: "left" as const },
};