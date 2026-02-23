import { COLORS } from "../../../utils/theme";
import { Btn, NumInput, Toggle } from "../../../components/ui/CoreUI";
import { WizardState, RecessConfig } from "../../../types";

interface StepProps {
  config: WizardState;
  setConfig: (config: WizardState) => void;
  onNext: () => void;
  onBack: () => void;
}

export function RecessStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  const pc = c.periodsCount || 7;
  const recess: Partial<RecessConfig> = c.recessConfig || {};

  const update = (field: keyof RecessConfig, val: boolean | number | string) => {
    setConfig({ ...c, recessConfig: { ...recess, [field]: val } as RecessConfig });
  };

  return (
    <div>
      <h2 style={styles.heading}>Recess & Breaks</h2>
      <p style={styles.subheading}>Configure recess or nutrition breaks (Elementary/Middle).</p>
      
      <div style={styles.container}>
        <Toggle label="Include Recess?" checked={recess.enabled || false} onChange={v => update("enabled", v)} />
        
        {recess.enabled && (
          <div style={styles.configBox}>
            <NumInput label="Recess Duration (min)" min={10} max={60} value={recess.duration ?? 20} onChange={v => update("duration", v)} />
            <NumInput label="After which period?" min={1} max={pc} value={recess.afterPeriod ?? 2} onChange={v => update("afterPeriod", v)} helperText="Recess will be inserted immediately following this period." />
          </div>
        )}
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
  subheading: { color: COLORS.textLight, marginBottom: 20, fontSize: 14 },
  container: { maxWidth: 600 },
  configBox: { marginTop: 16, background: COLORS.offWhite, padding: 16, borderRadius: 8, border: `1px solid ${COLORS.lightGray}` },
  footer: { marginTop: 24, display: "flex", justifyContent: "space-between" }
};