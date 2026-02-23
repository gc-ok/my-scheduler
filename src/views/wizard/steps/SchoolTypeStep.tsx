// src/views/wizard/steps/SchoolTypeStep.tsx
import { useState } from "react";
import { COLORS } from "../../../utils/theme";
import { Btn, Card } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
}

// All K-12 grade labels in order
const ALL_GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

// Grades available for cohort-question multi-select, by school type
const COHORT_GRADES: Record<string, string[]> = {
  elementary: ["K","1","2","3","4","5","6"],
  middle:     ["6","7","8"],
  high:       ["9","10","11","12"],
  k8:         ["K","1","2","3","4","5","6","7","8"],
  "6_12":     ["6","7","8","9","10","11","12"],
  k12:        ["K","1","2","3","4","5","6","7","8","9","10","11","12"],
};

// Grades that should get the elementary-model question
const ELEM_TYPES = new Set(["elementary","k8","k12"]);
// Grades that should get the team question
const MS_TYPES   = new Set(["middle","k8","6_12","k12"]);
// Grades that should get the cohort question
const HS_TYPES   = new Set(["high","6_12","k12"]);

const INPUT = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: `1px solid ${COLORS.lightGray}`, fontSize: 14, outline: "none",
  boxSizing: "border-box" as const, fontFamily: "'Segoe UI', system-ui, sans-serif",
  backgroundColor: COLORS.white, color: COLORS.text,
};
const SELECT = { ...INPUT, appearance: "auto" as const };

export function SchoolTypeStep({ config: c, setConfig, onNext }: StepProps) {
  const types = [
    { id: "elementary", l: "Elementary",   i: "🏫",   d: "K-5 or K-6. Self-contained or departmentalized classrooms." },
    { id: "middle",     l: "Middle School", i: "🏛️",  d: "Grades 6-8. Students rotate between subject classrooms." },
    { id: "high",       l: "High School",   i: "🎓",   d: "Grades 9-12. Course-based scheduling with multiple term options." },
    { id: "k8",         l: "K-8",           i: "📚",   d: "Combined K through 8. Elementary + middle school in one building." },
    { id: "k12",        l: "K-12",          i: "🏫🎓", d: "All grades in one building. Full configuration across all levels." },
    { id: "6_12",       l: "6-12",          i: "🏛️🎓", d: "Combined middle + high. Common for rural or charter schools." },
    { id: "custom",     l: "Custom",        i: "⚙️",  d: "Set your own grade range — 5-8, 7-8, PK-5, and any other configuration." },
  ];

  const schoolType: string = c.schoolType || "";

  // Derive available cohort grades from school type OR custom range
  const availCohortGrades: string[] = (() => {
    if (schoolType === "custom") {
      if (!c.customGradeRange?.from || !c.customGradeRange?.to) return [];
      const fi = ALL_GRADES.indexOf(c.customGradeRange.from);
      const ti = ALL_GRADES.indexOf(c.customGradeRange.to);
      if (fi === -1 || ti === -1 || ti < fi) return [];
      return ALL_GRADES.slice(fi, ti + 1);
    }
    return COHORT_GRADES[schoolType] || [];
  })();

  // For custom schools, derive which capability questions to show based on grade range
  const customHasElem = schoolType === "custom" && availCohortGrades.some(g => ["K","1","2","3","4","5"].includes(g));
  const customHasMS   = schoolType === "custom" && availCohortGrades.some(g => ["6","7","8"].includes(g));

  const showElemQ   = ELEM_TYPES.has(schoolType) || customHasElem;
  const showTeamQ   = MS_TYPES.has(schoolType)   || customHasMS;
  const showCohortQ = (HS_TYPES.has(schoolType) || MS_TYPES.has(schoolType) || customHasMS || availCohortGrades.length > 0) && availCohortGrades.length > 0;

  // The continue button requires:
  // 1. A school type selected
  // 2. If custom: a valid grade range
  // 3. Any shown follow-up answered
  const customValid = schoolType !== "custom" || (!!c.customGradeRange?.from && !!c.customGradeRange?.to);
  const elemAnswered  = !showElemQ  || !!c.elementaryModel;
  const teamAnswered  = !showTeamQ  || c.useTeams !== undefined;
  const canContinue = !!schoolType && customValid && elemAnswered && teamAnswered;

  const [customFrom, setCustomFrom] = useState<string>(c.customGradeRange?.from || "");
  const [customTo,   setCustomTo]   = useState<string>(c.customGradeRange?.to   || "");

  const updateCustomRange = (from: string, to: string) => {
    setCustomFrom(from); setCustomTo(to);
    setConfig({ ...c, customGradeRange: { from, to }, schoolType: "custom" });
  };

  const toggleCohortGrade = (grade: string) => {
    const current: string[] = c.cohortGrades || [];
    const next = current.includes(grade) ? current.filter(g => g !== grade) : [...current, grade];
    setConfig({ ...c, cohortGrades: next });
  };

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>What type of school?</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>
        Select your school configuration. The wizard adapts — recess for elementary, block options for high school, and custom grade ranges for non-standard configurations.
      </p>

      {/* ── School type cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12, marginBottom: 24 }}>
        {types.map(t => (
          <Card
            key={t.id}
            selected={c.schoolType === t.id}
            onClick={() => {
              // Clear follow-up answers when switching school type
              setConfig({
                ...c,
                schoolType: t.id,
                elementaryModel: undefined,
                useTeams: undefined,
                cohortGrades: [],
                customGradeRange: t.id === "custom" ? c.customGradeRange : undefined,
              });
            }}
          >
            <div style={{ fontSize: 26, marginBottom: 6 }}>{t.i}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t.l}</div>
            <div style={{ fontSize: 12, color: COLORS.textLight, lineHeight: 1.5 }}>{t.d}</div>
          </Card>
        ))}
      </div>

      {/* ── Custom grade range ── */}
      {schoolType === "custom" && (
        <div style={{ padding: "16px 20px", background: COLORS.offWhite, borderRadius: 10, marginBottom: 20 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: COLORS.primary, marginBottom: 12 }}>
            What grades does your school serve?
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Lowest Grade</label>
              <select value={customFrom} onChange={e => updateCustomRange(e.target.value, customTo)} style={{ ...SELECT, width: 100 }}>
                <option value="">— pick —</option>
                {ALL_GRADES.map(g => <option key={g} value={g}>{g === "K" ? "Kindergarten" : `Grade ${g}`}</option>)}
              </select>
            </div>
            <span style={{ fontSize: 18, color: COLORS.textLight, marginTop: 18 }}>→</span>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Highest Grade</label>
              <select value={customTo} onChange={e => updateCustomRange(customFrom, e.target.value)} style={{ ...SELECT, width: 100 }}>
                <option value="">— pick —</option>
                {ALL_GRADES.map(g => <option key={g} value={g}>{`Grade ${g}`}</option>)}
              </select>
            </div>
            {availCohortGrades.length > 0 && (
              <div style={{ marginTop: 18, padding: "4px 10px", background: COLORS.accentLight, borderRadius: 6, fontSize: 12, color: COLORS.primary }}>
                {availCohortGrades.join(", ")} detected
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Elementary model question ── */}
      {showElemQ && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: COLORS.primary, marginBottom: 10 }}>
            How are elementary classes structured?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
            {[
              { value: "unified_self", label: "All Self-Contained",       desc: "One homeroom teacher covers all subjects." },
              { value: "unified_dept", label: "All Departmentalized",     desc: "Subject specialists rotate through grades." },
              { value: "split_band",   label: "Split Band (K-2 / 3-5)",   desc: "K-2 self-contained, grades 3-5 departmentalized." },
            ].map(opt => (
              <Card key={opt.value} selected={c.elementaryModel === opt.value} onClick={() => setConfig({ ...c, elementaryModel: opt.value })}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: COLORS.textLight, lineHeight: 1.4 }}>{opt.desc}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Team question ── */}
      {showTeamQ && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: COLORS.primary, marginBottom: 10 }}>
            Do middle school teachers work in interdisciplinary teams?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 480 }}>
            {[
              { value: true,  label: "Yes — Team-Based",  desc: "Teachers share a common student group and plan together." },
              { value: false, label: "No — Departmental", desc: "Standard department scheduling, no shared teams." },
            ].map(opt => (
              <Card key={String(opt.value)} selected={c.useTeams === opt.value} onClick={() => setConfig({ ...c, useTeams: opt.value })}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: COLORS.textLight, lineHeight: 1.4 }}>{opt.desc}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Cohort grade selector — multi-select checkboxes ── */}
      {showCohortQ && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: COLORS.primary, marginBottom: 4 }}>
            Which grade(s) use student cohort tracking? <span style={{ fontWeight: 400, fontSize: 12, color: COLORS.textLight }}>(optional)</span>
          </p>
          <p style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 10, lineHeight: 1.5 }}>
            Cohorts are fixed student groups that travel together. The engine prevents two sections from the same cohort landing in the same period — great for freshmen academies, team scheduling, or advisory groups.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {availCohortGrades.map(grade => {
              const selected = (c.cohortGrades || []).includes(grade);
              return (
                <button
                  key={grade}
                  onClick={() => toggleCohortGrade(grade)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: `2px solid ${selected ? COLORS.primary : COLORS.lightGray}`,
                    background: selected ? COLORS.primary : COLORS.white,
                    color: selected ? COLORS.white : COLORS.text,
                    fontWeight: selected ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {grade === "K" ? "Kinder" : `Gr ${grade}`}
                </button>
              );
            })}
          </div>
          {(c.cohortGrades || []).length > 0 && (
            <p style={{ fontSize: 11, color: COLORS.accent, marginTop: 6 }}>
              Cohort tracking active for: Grade(s) {(c.cohortGrades as string[]).join(", ")}
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
        <Btn onClick={onNext} disabled={!canContinue}>Continue →</Btn>
      </div>
    </div>
  );
}
