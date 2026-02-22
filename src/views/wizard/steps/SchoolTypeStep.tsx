// src/views/wizard/steps/SchoolTypeStep.tsx
import { COLORS } from "../../../utils/theme";
import { Btn, Card } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
}

export function SchoolTypeStep({ config: c, setConfig, onNext }: StepProps) {
  const types = [
    { id: "elementary", l: "Elementary School", i: "🏫", d: "Grades K-5/6. Self-contained classrooms with specials rotation." },
    { id: "middle", l: "Middle School", i: "🏛️", d: "Grades 6-8. Students rotate between classrooms." },
    { id: "high", l: "High School", i: "🎓", d: "Grades 9-12. Full departmentalized scheduling." },
    { id: "k8", l: "K-8 School", i: "📚", d: "Combined elementary and middle." },
    { id: "k12", l: "K-12 School", i: "🏫🎓", d: "All grades. Complex mixed structure." },
    { id: "6_12", l: "6-12 School", i: "🏛️🎓", d: "Combined middle and high school." },
  ];
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>What type of school?</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>Select what best describes your school.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
        {types.map(t => (
          <Card key={t.id} selected={c.schoolType === t.id} onClick={() => setConfig({ ...c, schoolType: t.id })}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{t.i}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{t.l}</div>
            <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.5 }}>{t.d}</div>
          </Card>
        ))}
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <Btn onClick={onNext} disabled={!c.schoolType}>Continue →</Btn>
      </div>
    </div>
  );
}