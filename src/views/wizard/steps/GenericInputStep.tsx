// src/views/wizard/steps/GenericInputStep.tsx
import { useState } from "react";
import { COLORS } from "../../../utils/theme";
import { Btn, NumInput, SMALL_INPUT } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const INPUT_STYLE = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: `1px solid ${COLORS.lightGray}`, fontSize: 14, outline: "none",
  boxSizing: "border-box" as const, fontFamily: "'Segoe UI', system-ui, sans-serif",
  backgroundColor: COLORS.white, color: COLORS.text, colorScheme: "light" as const,
};
const SELECT_STYLE = { ...INPUT_STYLE, appearance: "auto" as const };

export function GenericInputStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  const isBlock = c.scheduleType === "ab_block" || c.scheduleType === "4x4_block";
  const isTri = c.scheduleType === "trimester";
  
  const defaultLoad = isBlock ? 6 : (isTri ? 12 : 5);

  // DYNAMIC DEFAULTS BASED ON SCHOOL TYPE
  const getDefaults = () => {
    if (c.departments) return c.departments;
    
    if (c.schoolType === "elementary") {
      return [
        { id: "k", name: "Kindergarten", teacherCount: 3, required: true, roomType: "regular", teacherNames: [] },
        { id: "gr1", name: "Grade 1", teacherCount: 3, required: true, roomType: "regular", teacherNames: [] },
        { id: "gr2", name: "Grade 2", teacherCount: 3, required: true, roomType: "regular", teacherNames: [] },
        { id: "gr3", name: "Grade 3", teacherCount: 3, required: true, roomType: "regular", teacherNames: [] },
        { id: "gr4", name: "Grade 4", teacherCount: 3, required: true, roomType: "regular", teacherNames: [] },
        { id: "gr5", name: "Grade 5", teacherCount: 3, required: true, roomType: "regular", teacherNames: [] },
        { id: "specials", name: "Specials (Art/Music)", teacherCount: 2, required: false, roomType: "regular", teacherNames: [] },
        { id: "pe", name: "PE", teacherCount: 1, required: false, roomType: "gym", teacherNames: [] },
      ];
    }
    return [
      { id: "english", name: "English/ELA", teacherCount: 4, required: true, roomType: "regular", teacherNames: [] },
      { id: "math", name: "Math", teacherCount: 4, required: true, roomType: "regular", teacherNames: [] },
      { id: "science", name: "Science", teacherCount: 3, required: true, roomType: "lab", teacherNames: [] },
      { id: "social", name: "Social Studies", teacherCount: 3, required: true, roomType: "regular", teacherNames: [] },
      { id: "pe", name: "PE", teacherCount: 2, required: false, roomType: "gym", teacherNames: [] },
      { id: "elective", name: "Electives", teacherCount: 4, required: false, roomType: "regular", teacherNames: [] },
    ];
  };

  const [depts, setDepts] = useState<any[]>(getDefaults());
  const [sc, setSc] = useState(c.studentCount ?? 800);
  const [rc, setRc] = useState(c.roomCount ?? 25);
  const [lc, setLc] = useState(c.labCount ?? 2);
  const [gc, setGc] = useState(c.gymCount ?? 1);
  const [ms, setMs] = useState(c.maxClassSize ?? 30);
  
  const [tl, setTl] = useState(c.targetLoad ?? defaultLoad);
  const [expanded, setExpanded] = useState<number | null>(null);

  const upD = (i: number, f: string, v: any) => { const d = [...depts]; d[i] = { ...d[i], [f]: v }; setDepts(d); };

  const periodCount = c.periodsCount || (isBlock ? 4 : (isTri ? 5 : 7));
  const planP = c.planPeriodsPerDay ?? 1;
  const lunchConsumes = c.lunchModel !== "separate" ? 1 : 0;
  const winConsumes = c.winEnabled && c.winModel !== "separate" ? 1 : 0;
  
  const dailyTeachable = Math.max(1, periodCount - planP - lunchConsumes - winConsumes);
  
  let maxTeachable = dailyTeachable;
  if (isBlock) maxTeachable = dailyTeachable * 2; 
  if (isTri) maxTeachable = dailyTeachable * 3;   
  
  const validLoad = Math.min(tl, maxTeachable);
  
  const coreDepts = depts.filter(d => d.required);

  const cont = () => {
    const teachers: any[] = [], courses: any[] = [], rooms: any[] = [];
    depts.forEach(dept => {
      const tc = dept.teacherCount || 1;
      const names = dept.teacherNames || [];
      const floaters = dept.teacherFloaters || []; 
      
      for (let i = 0; i < tc; i++) {
        teachers.push({ 
          id: `${dept.id}_t${i + 1}`, 
          name: names[i] || `${dept.name} Teacher ${i + 1}`, 
          departments: [dept.id], 
          planPeriods: planP, 
          isFloater: floaters[i] || false 
        });
      }
      const isPE = dept.id === "pe" || dept.name.toLowerCase().includes("pe") || dept.name.toLowerCase().includes("physical");
      const sectionMax = isPE ? Math.max(ms, 40) : ms;
      const sectionsNeeded = dept.required ? Math.max(tc * validLoad, Math.ceil(sc / sectionMax)) : tc * validLoad;
      courses.push({ id: `${dept.id}_101`, name: dept.name, department: dept.id, sections: Math.max(1, sectionsNeeded), maxSize: sectionMax, required: dept.required, roomType: dept.roomType || "regular", gradeLevel: "all" });
    });
    for (let i = 0; i < rc; i++) rooms.push({ id: `room_${i + 1}`, name: `Room ${101 + i}`, type: "regular", capacity: ms });
    for (let i = 0; i < lc; i++) rooms.push({ id: `lab_${i + 1}`, name: `Lab ${i + 1}`, type: "lab", capacity: ms });
    for (let i = 0; i < gc; i++) rooms.push({ id: `gym_${i + 1}`, name: `Gym ${i + 1}`, type: "gym", capacity: ms * 2 });
    setConfig({ ...c, departments: depts, studentCount: sc, roomCount: rc, labCount: lc, gymCount: gc, maxClassSize: ms, targetLoad: validLoad, teachers, courses, rooms, students: { count: sc } });
    onNext();
  };

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Quick Setup</h2>
      <div style={{ maxWidth: 750 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
          <NumInput label="Total Students" min={10} max={5000} value={sc} onChange={setSc} />
          <NumInput label="Max Class Size" min={10} max={50} value={ms} onChange={setMs} />
          <NumInput label={isBlock || isTri ? "Total Sections per Teacher (Yearly)" : "Classes/Day per Teacher"} min={1} max={20} value={tl} onChange={setTl} helperText={`Max possible: ${maxTeachable}`} />
        </div>
        <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, background: COLORS.accentLight, color: COLORS.darkGray }}>
          <strong>Student Load:</strong> {coreDepts.length} core classes + {Math.max(0, ((isBlock ? periodCount * 2 : (isTri ? periodCount * 3 : periodCount))) - coreDepts.length - (c.lunchModel !== "separate" ? (isBlock ? 2 : (isTri ? 3 : 1)) : 0))} elective/PE slots to fill per student.
        </div>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>🏫 Rooms</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
          <NumInput label="Regular" min={1} max={100} value={rc} onChange={setRc} />
          <NumInput label="Labs" min={0} max={20} value={lc} onChange={setLc} />
          <NumInput label="Gyms" min={0} max={5} value={gc} onChange={setGc} />
        </div>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>👨‍🏫 Departments & Teachers</h3>
        {depts.map((d, i) => (
          <div key={d.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, padding: 10, background: COLORS.offWhite, borderRadius: expanded === i ? "8px 8px 0 0" : 8, flexWrap: "wrap", alignItems: "center" }}>
              <input value={d.name} onChange={e => upD(i, "name", e.target.value)} placeholder="Dept name" style={{ ...INPUT_STYLE, flex: 2, minWidth: 120, width: "auto" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="number" min={1} max={50} value={d.teacherCount} onChange={e => upD(i, "teacherCount", parseInt(e.target.value) || 1)} style={SMALL_INPUT} />
                <span style={{ fontSize: 12, color: COLORS.textLight }}>tchrs</span>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer", color: COLORS.text }}>
                <input type="checkbox" checked={d.required || false} onChange={e => upD(i, "required", e.target.checked)} /> Core
              </label>
              <select value={d.roomType || "regular"} onChange={e => upD(i, "roomType", e.target.value)} style={{ ...SELECT_STYLE, width: "auto", padding: "5px 8px", fontSize: 12 }}>
                <option value="regular">Room</option><option value="lab">Lab</option><option value="gym">Gym</option>
              </select>
              <div onClick={() => setExpanded(expanded === i ? null : i)} style={{ cursor: "pointer", fontSize: 13, color: COLORS.primary, fontWeight: 600, padding: "4px 8px" }}>
                {expanded === i ? "▲ Hide" : "✏️ Names"}
              </div>
              <div onClick={() => setDepts(depts.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: COLORS.danger, fontSize: 18, marginLeft: "auto" }}>×</div>
            </div>
            {expanded === i && (
              <div style={{ padding: 12, background: COLORS.white, border: `1px solid ${COLORS.lightGray}`, borderTop: "none", borderRadius: "0 0 8px 8px" }}>
                <p style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>Name teachers & assign floaters:</p>
                {Array.from({ length: d.teacherCount || 1 }, (_, ti) => (
                  <div key={ti} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: COLORS.textLight, width: 24 }}>{ti + 1}.</span>
                    <input value={(d.teacherNames || [])[ti] || ""} onChange={e => { const n = [...(d.teacherNames || [])]; n[ti] = e.target.value; upD(i, "teacherNames", n); }} placeholder={`${d.name} Teacher ${ti + 1}`} style={{ ...INPUT_STYLE, flex: 1, width: "auto" }} />
                    <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: COLORS.text }}>
                      <input type="checkbox" checked={(d.teacherFloaters || [])[ti] || false} onChange={e => { const f = [...(d.teacherFloaters || [])]; f[ti] = e.target.checked; upD(i, "teacherFloaters", f); }} /> Is Floater
                    </label>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: COLORS.textLight, padding: "4px 10px" }}>
              → {d.required ? `${Math.max((d.teacherCount || 1) * validLoad, Math.ceil(sc / ms))}` : `${(d.teacherCount || 1) * validLoad}`} sections
              {d.required ? " (core: every student takes 1)" : " (elective)"}
            </div>
          </div>
        ))}
        <Btn variant="ghost" small onClick={() => setDepts([...depts, { id: `d_${Date.now()}`, name: "", teacherCount: 1, required: false, roomType: "regular", teacherNames: [] }])}>+ Add Department</Btn>
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={cont}>Continue →</Btn>
      </div>
    </div>
  );
}