// src/views/wizard/steps/ScheduleTypeStep.tsx
import { COLORS } from "../../../utils/theme";
import { Btn, Card } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ScheduleTypeStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  const all = [
    { id: "traditional", l: "Traditional", i: "📋", d: "Same classes every day, 6-8 periods.", b: "Simplicity" },
    { id: "ab_block", l: "A/B Block", i: "🔄", d: "Alternating A/B days. Longer periods.", b: "Labs & Arts" },
    { id: "4x4_block", l: "4×4 Block", i: "4️⃣", d: "4 courses/semester. 90 min daily.", b: "Accelerated credits" },
    { id: "modified_block", l: "Modified Block", i: "🔀", d: "Mix of traditional and block days.", b: "Hybrid needs" },
    { id: "rotating_drop", l: "Rotating/Drop", i: "🔃", d: "Periods rotate. One drops daily.", b: "Equity" },
    { id: "elementary_self", l: "Self-Contained", i: "👩‍🏫", d: "Homeroom all day + specials.", b: "K-2" },
    { id: "elementary_dept", l: "Departmentalized", i: "🚶", d: "Upper elem rotation.", b: "Grades 3-5" },
    { id: "ms_team", l: "Team-Based", i: "👥", d: "Interdisciplinary teams.", b: "Collaboration" },
  ];
  const valid = all.filter(t => {
    if (c.schoolType === "elementary") return ["traditional","elementary_self","elementary_dept","rotating_drop"].includes(t.id);
    if (c.schoolType === "middle") return ["traditional","ab_block","ms_team","modified_block","rotating_drop"].includes(t.id);
    if (c.schoolType === "high") return ["traditional","ab_block","4x4_block","modified_block","rotating_drop"].includes(t.id);
    return true;
  });
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Choose schedule type</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
        {valid.map(t => (
          <Card key={t.id} selected={c.scheduleType === t.id} onClick={() => setConfig({ ...c, scheduleType: t.id })}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{t.i}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t.l}</div>
            <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.5, marginBottom: 6 }}>{t.d}</div>
            <div style={{ fontSize: 12, color: COLORS.primary, fontWeight: 600 }}>Best for: {t.b}</div>
          </Card>
        ))}
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext} disabled={!c.scheduleType}>Continue →</Btn>
      </div>
    </div>
  );
}