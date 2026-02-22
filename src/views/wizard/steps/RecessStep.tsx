import { COLORS } from "../../../utils/theme";
import { Btn, NumInput, Toggle } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export function RecessStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  const pc = c.periodsCount || 7;
  const recess = c.recessConfig || {} as any;

  const update = (field: string, val: any) => {
    setConfig({ ...c, recessConfig: { ...recess, [field]: val } });
  };

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Recess & Breaks</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>Configure recess or nutrition breaks (Elementary/Middle).</p>
      
      <div style={{ maxWidth: 600 }}>
        <Toggle label="Include Recess?" checked={recess.enabled || false} onChange={v => update("enabled", v)} />
        
        {recess.enabled && (
          <div style={{ marginTop: 16, background: COLORS.offWhite, padding: 16, borderRadius: 8, border: `1px solid ${COLORS.lightGray}` }}>
            <NumInput label="Recess Duration (min)" min={10} max={60} value={recess.duration ?? 20} onChange={v => update("duration", v)} />
            <NumInput label="After which period?" min={1} max={pc} value={recess.afterPeriod ?? 2} onChange={v => update("afterPeriod", v)} helperText="Recess will be inserted immediately following this period." />
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext}>Continue →</Btn>
      </div>
    </div>
  );
}