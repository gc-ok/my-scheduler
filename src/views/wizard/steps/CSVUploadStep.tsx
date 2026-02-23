// src/views/wizard/steps/CSVUploadStep.tsx
import { useState, ChangeEvent } from "react";
import { COLORS } from "../../../utils/theme";
import { Btn, Tabs } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const SELECT_STYLE = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: `1px solid ${COLORS.lightGray}`, fontSize: 14, outline: "none",
  boxSizing: "border-box" as const, fontFamily: "'Segoe UI', system-ui, sans-serif",
  backgroundColor: COLORS.white, color: COLORS.text, colorScheme: "light" as const,
  appearance: "auto" as const
};

export function CSVUploadStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  const [af, setAf] = useState("teachers");
  const [fn, setFn] = useState<Record<string, string>>({});
  const [pd, setPd] = useState<Record<string, { headers: string[], rows: string[][] }>>({});
  const [cm, setCm] = useState<Record<string, Record<string, number | undefined> | undefined>>({});
  const fts = [
    { id: "teachers", label: "Teachers", fields: ["name","department","isFloater"] },
    { id: "courses", label: "Courses", fields: ["name","department","maxSize","sections","required"] },
    { id: "rooms", label: "Rooms", fields: ["name","type","capacity"] },
    { id: "cohorts", label: "Cohorts", fields: ["name","gradeLevel","teacherName","studentCount"] },
  ];
  const handleFile = (type: string, e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const result = ev.target?.result as string;
      const lines = result.split("\n").map(l => l.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
      if (lines.length > 1) {
        const h = lines[0]; const rows = lines.slice(1).filter(r => r.some(c => c));
        setPd(p => ({ ...p, [type]: { headers: h, rows } }));
        setFn(p => ({ ...p, [type]: f.name }));
        const ft = fts.find(x => x.id === type);
        const map: Record<string, number> = {};
        ft?.fields.forEach(field => { const idx = h.findIndex(hh => hh.toLowerCase().includes(field.toLowerCase())); if (idx >= 0) map[field] = idx; });
        setCm(x => ({ ...x, [type]: map }));
      }
    }; r.readAsText(f);
  };
  const cont = () => {
    const teachers: any[] = [], courses: any[] = [], rooms: any[] = [];
    const cohorts: any[] = [];

    if (pd.cohorts?.rows) pd.cohorts.rows.forEach((r, i) => {
      const m = cm.cohorts || {};
      cohorts.push({
        id: `coh_${i}`, name: m.name !== undefined ? r[m.name] : `Cohort ${i+1}`,
        gradeLevel: m.gradeLevel !== undefined ? r[m.gradeLevel] : "1",
        teacherName: m.teacherName !== undefined ? r[m.teacherName] : `Teacher ${i+1}`,
        studentCount: m.studentCount !== undefined ? parseInt(r[m.studentCount]) || 25 : 25
      });
    });

    if (pd.teachers?.rows) pd.teachers.rows.forEach((r, i) => { 
      const m = cm.teachers || {}; 
      teachers.push({ 
        id: `t_${i}`, 
        name: m.name !== undefined ? r[m.name] : `Teacher ${i+1}`, 
        departments: [m.department !== undefined ? r[m.department] : "general"], 
        isFloater: m.isFloater !== undefined ? (r[m.isFloater]?.toLowerCase() === "true" || r[m.isFloater]?.toLowerCase() === "yes") : false 
      }); 
    });
    if (pd.courses?.rows) pd.courses.rows.forEach((r, i) => { const m = cm.courses || {}; courses.push({ id: `c_${i}`, name: m.name !== undefined ? r[m.name] : `Course ${i+1}`, department: m.department !== undefined ? r[m.department] : "general", maxSize: m.maxSize !== undefined ? parseInt(r[m.maxSize]) || 30 : 30, sections: m.sections !== undefined ? parseInt(r[m.sections]) || 1 : 1, required: m.required !== undefined ? r[m.required]?.toLowerCase() === "yes" : true }); });
    if (pd.rooms?.rows) pd.rooms.rows.forEach((r, i) => { const m = cm.rooms || {}; rooms.push({ id: `r_${i}`, name: m.name !== undefined ? r[m.name] : `Room ${i+1}`, type: m.type !== undefined ? r[m.type] : "regular", capacity: m.capacity !== undefined ? parseInt(r[m.capacity]) || 30 : 30 }); });
    else { for (let i = 0; i < 20; i++) rooms.push({ id: `r_${i}`, name: `Room ${101+i}`, type: "regular", capacity: 30 }); rooms.push({ id: "lab_0", name: "Lab 1", type: "lab", capacity: 30 }); rooms.push({ id: "lab_1", name: "Lab 2", type: "lab", capacity: 30 }); }
    setConfig({ ...c, teachers, courses, rooms, cohorts, studentCountQuick: 300 }); onNext();
  };
  const ft = fts.find(f => f.id === af)!;
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Upload CSV Data</h2>
      <div style={{ background: COLORS.accentLight, borderRadius: 8, padding: "8px 14px", marginBottom: 18, fontSize: 13, color: COLORS.primaryDark }}>🔒 Processed in your browser only.</div>
      <Tabs tabs={fts.map(f => ({ id: f.id, label: `${f.label} ${fn[f.id] ? "✓" : ""}` }))} active={af} onChange={setAf} />
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "inline-block", padding: "10px 20px", borderRadius: 8, cursor: "pointer", background: COLORS.primary, color: COLORS.white, fontWeight: 600 }}>
          Choose {ft.label} CSV <input type="file" accept=".csv" onChange={e => handleFile(af, e)} style={{ display: "none" }} />
        </label>
        {fn[af] && <span style={{ marginLeft: 12, color: COLORS.success }}>✓ {fn[af]}</span>}
        {pd[af] && (
          <div style={{ marginTop: 14 }}>
            <h4 style={{ fontSize: 14, marginBottom: 8, color: COLORS.text }}>Map Columns</h4>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              {ft.fields.map(field => (
                <div key={field}><label style={{ fontSize: 12, display: "block", color: COLORS.text }}>{field}</label>
                  <select value={cm[af]?.[field] ?? ""} onChange={e => setCm({ ...cm, [af]: { ...(cm[af] || {}), [field]: e.target.value === "" ? undefined : parseInt(e.target.value) } })} style={{ ...SELECT_STYLE, width: "auto", padding: "4px 8px" }}>
                    <option value="">-- Skip --</option>
                    {pd[af].headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${COLORS.lightGray}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr>{pd[af].headers.map((h, i) => <th key={i} style={{ padding: "6px 8px", background: COLORS.offWhite, textAlign: "left", borderBottom: `1px solid ${COLORS.lightGray}`, color: COLORS.text }}>{h}</th>)}</tr></thead>
                <tbody>{pd[af].rows.slice(0, 5).map((row, ri) => <tr key={ri}>{row.map((cell, j) => <td key={j} style={{ padding: "4px 8px", borderBottom: `1px solid ${COLORS.lightGray}`, color: COLORS.text }}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={cont}>Continue →</Btn>
      </div>
    </div>
  );
}