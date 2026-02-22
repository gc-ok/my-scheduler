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
  const stepsList = [
    "School Type", "Schedule Type", "Bell Schedule", "Lunch", 
    "Plan & PLC", "WIN Time", "Recess", "Data Input", 
    config.inputMode === "csv" ? "CSV Upload" : "Quick Setup", 
    "Constraints"
  ];

  return (
    <>
      <div style={{ background: COLORS.white, padding: "14px 24px", borderBottom: `1px solid ${COLORS.lightGray}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Logo size={36} />
      </div>

      {step > 0 && (
        <div style={{ background: COLORS.white, padding: "10px 24px", borderBottom: `1px solid ${COLORS.lightGray}`, overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {stepsList.map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                <div onClick={() => i + 1 <= step && setStep(i + 1)} style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 12, whiteSpace: "nowrap",
                  cursor: i + 1 <= step ? "pointer" : "default",
                  background: i + 1 === step ? COLORS.primary : i + 1 < step ? COLORS.accentLight : COLORS.lightGray,
                  color: i + 1 === step ? COLORS.white : i + 1 < step ? COLORS.primary : COLORS.midGray,
                  fontWeight: i + 1 === step ? 700 : 500,
                }}>{label}</div>
                {i < stepsList.length - 1 && <div style={{ width: 12, height: 2, background: i + 1 < step ? COLORS.accent : COLORS.lightGray, margin: "0 2px" }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "30px 24px" }}>
        {step === 0 && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}><Logo size={80} /></div>
            <h1 style={{ fontSize: 28, color: COLORS.primary, marginBottom: 8 }}>K-12 Master Scheduler</h1>
            <p style={{ fontSize: 15, color: COLORS.textLight, maxWidth: 480, margin: "0 auto 30px", lineHeight: 1.6 }}>Build your master schedule in minutes. Configure, generate, and fine-tune.</p>
            <Btn onClick={() => setStep(1)} style={{ padding: "14px 32px", fontSize: 16 }}>🚀 Start New Project</Btn>
            <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16, textAlign: "left" }}>
              {[
                { i: "🏫", t: "All School Types", d: "K-5 through 12" },
                { i: "⚡", t: "Smart Algorithm", d: "Home rooms, student accounting, capacity validation" },
                { i: "🔄", t: "Dynamic Models", d: "A/B Blocks, 4x4, and Traditional Schedules." },
                { i: "📊", t: "Detailed Analytics", d: "Period-by-period student coverage tracking" },
              ].map(f => <Card key={f.t}><div style={{ fontSize: 28, marginBottom: 8 }}>{f.i}</div><div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{f.t}</div><div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.4 }}>{f.d}</div></Card>)}
            </div>
          </div>
        )}

        {/* DYNAMIC ROUTING */}
        {step === 1 && <SchoolTypeStep config={config} setConfig={setConfig} onNext={() => setStep(2)} />}
        {step === 2 && <ScheduleTypeStep config={config} setConfig={setConfig} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <BellScheduleStep config={config} setConfig={setConfig} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <LunchStep config={config} setConfig={setConfig} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
        {step === 5 && <PlanPLCStep config={config} setConfig={setConfig} onNext={() => setStep(6)} onBack={() => setStep(4)} />}
        {step === 6 && <WINTimeStep config={config} setConfig={setConfig} onNext={() => setStep(7)} onBack={() => setStep(5)} />}
        {step === 7 && <RecessStep config={config} setConfig={setConfig} onNext={() => setStep(8)} onBack={() => setStep(6)} />}
        {step === 8 && <DataInputStep config={config} setConfig={setConfig} onNext={() => setStep(9)} onBack={() => setStep(7)} />}
        {step === 9 && config.inputMode === "csv" && <CSVUploadStep config={config} setConfig={setConfig} onNext={() => setStep(10)} onBack={() => setStep(8)} />}
        {step === 9 && config.inputMode !== "csv" && <GenericInputStep config={config} setConfig={setConfig} onNext={() => setStep(10)} onBack={() => setStep(8)} />}
        {step === 10 && <ConstraintsStep config={config} setConfig={setConfig} onNext={onComplete} onBack={() => setStep(9)} />}
      </div>
    </>
  );
}