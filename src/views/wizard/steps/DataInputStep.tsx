// src/views/wizard/steps/DataInputStep.tsx
import { COLORS } from "../../../utils/theme";
import { Btn, Card } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DataInputStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>How to input data?</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600 }}>
        <Card selected={c.inputMode === "generic"} onClick={() => setConfig({ ...c, inputMode: "generic" })}>
          <div style={{ fontSize: 36, marginBottom: 10, textAlign: "center" }}>✏️</div>
          <div style={{ fontWeight: 700, fontSize: 15, textAlign: "center", marginBottom: 6 }}>Quick Setup</div>
          <div style={{ fontSize: 13, color: COLORS.textLight, textAlign: "center" }}>Enter departments, counts. Name teachers optionally.</div>
        </Card>
        <Card selected={c.inputMode === "csv"} onClick={() => setConfig({ ...c, inputMode: "csv" })}>
          <div style={{ fontSize: 36, marginBottom: 10, textAlign: "center" }}>📁</div>
          <div style={{ fontWeight: 700, fontSize: 15, textAlign: "center", marginBottom: 6 }}>CSV Upload</div>
          <div style={{ fontSize: 13, color: COLORS.textLight, textAlign: "center" }}>Upload teacher/course/room files.</div>
        </Card>
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext} disabled={!c.inputMode}>Continue →</Btn>
      </div>
    </div>
  );
}