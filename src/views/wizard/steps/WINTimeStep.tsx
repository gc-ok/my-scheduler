// src/views/wizard/steps/WINTimeStep.tsx
import { COLORS } from "../../../utils/theme";
import { Btn, Card, NumInput, Toggle } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export function WINTimeStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  const pc = c.periodsCount || 7;
  return (
    <div>
      <h2 style={styles.heading}>WIN Time (What I Need)</h2>
      <p style={styles.subheading}>Intervention/enrichment block.</p>
      <div style={styles.container}>
        <Toggle label="Include WIN time" checked={c.winEnabled || false} onChange={v => setConfig({ ...c, winEnabled: v })} />
        {c.winEnabled && (
          <>
            <div style={styles.cardGrid}>
              <Card selected={c.winModel !== "separate"} onClick={() => setConfig({ ...c, winModel: "uses_period" })}>
                <div style={styles.cardTitle}>📋 Uses a Period</div>
                <div style={styles.cardDesc}>WIN replaces a teaching period.</div>
              </Card>
              <Card selected={c.winModel === "separate"} onClick={() => setConfig({ ...c, winModel: "separate" })}>
                <div style={styles.cardTitle}>⏱️ Separate Block</div>
                <div style={styles.cardDesc}>Own time block (e.g., 30 min).</div>
              </Card>
            </div>
            {c.winModel === "separate" ? (
              <div style={styles.configBox}>
                <NumInput label="WIN after which period?" min={1} max={pc} value={c.winAfterPeriod ?? 1} onChange={v => setConfig({ ...c, winAfterPeriod: v })} />
                <NumInput label="WIN duration (min)" min={15} max={60} value={c.winDuration ?? 30} onChange={v => setConfig({ ...c, winDuration: v })} />
              </div>
            ) : (
              <NumInput label="Which period is WIN?" min={1} max={pc} value={c.winPeriod ?? 2} onChange={v => setConfig({ ...c, winPeriod: v })} />
            )}
          </>
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
  cardGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 },
  cardTitle: { fontWeight: 700, fontSize: 13 },
  cardDesc: { fontSize: 11, color: COLORS.textLight },
  configBox: { background: COLORS.offWhite, padding: 14, borderRadius: 8 },
  footer: { marginTop: 24, display: "flex", justifyContent: "space-between" }
};