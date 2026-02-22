// src/views/wizard/steps/PlanPLCStep.tsx
import { COLORS } from "../../../utils/theme";
import { Btn, NumInput, Sel, Toggle } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PlanPLCStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  return (
    <div>
      <h2 style={styles.heading}>Plan Periods & PLC</h2>
      <div style={styles.container}>
        <NumInput label="Plan periods per day per teacher" min={0} max={3} value={c.planPeriodsPerDay ?? 1} onChange={v => setConfig({ ...c, planPeriodsPerDay: v })} helperText="Most schools: 1" />
        <div style={styles.section}>
          <Toggle label="Include PLC time" checked={c.plcEnabled || false} onChange={v => setConfig({ ...c, plcEnabled: v })} description="Collaborative teacher team time" />
          {c.plcEnabled && <Sel label="PLC frequency" value={c.plcFrequency || "weekly"} onChange={v => setConfig({ ...c, plcFrequency: v })} options={[{value:"daily",label:"Daily"},{value:"weekly",label:"Weekly"}]} />}
        </div>
      </div>
      <div style={styles.footer}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext}>Continue →</Btn>
      </div>
    </div>
  );
}

const styles = {
  heading: { color: COLORS.primary, marginBottom: 6 },
  container: { maxWidth: 650 },
  section: { marginTop: 20, borderTop: `1px solid ${COLORS.lightGray}`, paddingTop: 20 },
  footer: { marginTop: 24, display: "flex", justifyContent: "space-between" }
};