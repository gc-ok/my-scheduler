// src/views/wizard/steps/ConstraintsStep.tsx
import { useState } from "react";
import { COLORS } from "../../../utils/theme";
import { Btn, NumInput, Sel } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ConstraintsStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  const [cons, setCons] = useState<any[]>(c.constraints || []);
  const [avail, setAvail] = useState<any[]>(c.teacherAvailability || []);
  const [showCon, setShowCon] = useState(false);
  const [nc, setNc] = useState<{type: string, priority: string, courseId?: string, period?: number}>({ type: "lock_period", priority: "must" });
  
  const [showAvail, setShowAvail] = useState(false);
  const [na, setNa] = useState<{teacherId: string, blockedPeriods: number[]}>({ teacherId: "", blockedPeriods: [] });

  const [showTravel, setShowTravel] = useState(false);
  const [nt, setNt] = useState<{teacherId: string, minutes: number}>({ teacherId: "", minutes: 15 });

  const periods = c.periods || [];
  const teachers = c.teachers || [];

  const types = [{ value: "lock_period", label: "Lock Course to Period" }];

  const saveAvail = () => {
    if(!na.teacherId || na.blockedPeriods.length === 0) return;
    const filtered = avail.filter(a => a.teacherId !== na.teacherId);
    setAvail([...filtered, { teacherId: na.teacherId, blockedPeriods: na.blockedPeriods }]);
    setShowAvail(false);
    setNa({ teacherId: "", blockedPeriods: [] });
  };

  const saveTravel = () => {
    const updatedTeachers = teachers.map((t: any) => t.id === nt.teacherId ? { ...t, travelTime: nt.minutes } : t);
    setConfig({ ...c, teachers: updatedTeachers });
    setShowTravel(false);
  };

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Constraints & Part-Time Staff</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>Set hard scheduling rules and staff availability.</p>
      
      <div style={{ maxWidth: 700 }}>
        {/* --- SECTION 1: PART-TIME STAFF --- */}
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.lightGray}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 12px 0", color: COLORS.primaryDark }}>⏱️ Staff Availability (Part-Time)</h3>
          
          {avail.map(a => {
            const tName = teachers.find((t: any) => t.id === a.teacherId)?.name || "Unknown";
            const pLabels = a.blockedPeriods.map((pid: number) => periods.find((p: any) => p.id === pid)?.label || `P${pid}`).join(", ");
            return (
              <div key={a.teacherId} style={{ display: "flex", justifyContent: "space-between", padding: 8, background: "#FFF4E5", borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
                <div><strong>{tName}</strong> is UNAVAILABLE during: {pLabels}</div>
                <button aria-label={`Remove ${tName}`} onClick={() => setAvail(avail.filter(x => x.teacherId !== a.teacherId))} style={{ cursor: "pointer", color: COLORS.danger, background: "none", border: "none", fontSize: "inherit", fontFamily: "inherit" }}>✕</button>
              </div>
            );
          })}

          {showAvail ? (
            <div style={{ padding: 12, background: COLORS.offWhite, borderRadius: 8, marginTop: 10 }}>
              <Sel label="Select Teacher" value={na.teacherId} onChange={v => setNa({ ...na, teacherId: v })} options={[{ value: "", label: "Select..." }, ...teachers.map((t: any) => ({ value: t.id, label: t.name }))]} />
              
              {na.teacherId && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Select Blocked Periods:</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {periods.map((p: any) => {
                      const isBlocked = na.blockedPeriods.includes(p.id);
                      return (
                        <button key={p.id} aria-pressed={isBlocked} onClick={() => setNa({ ...na, blockedPeriods: isBlocked ? na.blockedPeriods.filter(id => id !== p.id) : [...na.blockedPeriods, p.id] })}
                          style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: `1px solid ${isBlocked ? COLORS.danger : COLORS.lightGray}`, background: isBlocked ? COLORS.danger : COLORS.white, color: isBlocked ? COLORS.white : COLORS.text, fontFamily: "inherit" }}>
                          {p.label} {isBlocked && "🚫"}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <Btn onClick={saveAvail} small>Save Availability</Btn>
                    <Btn variant="secondary" onClick={() => setShowAvail(false)} small>Cancel</Btn>
                  </div>
                </div>
              )}
            </div>
          ) : <Btn variant="ghost" onClick={() => setShowAvail(true)} small>+ Add Teacher Restriction</Btn>}
        </div>

        {/* --- SECTION 2: TRAVEL TIME --- */}
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.lightGray}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 12px 0", color: COLORS.primaryDark }}>🚗 Travel Time</h3>
          {teachers.filter((t: any) => t.travelTime).map((t: any) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: 8, background: "#E0F2FE", borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
              <div><strong>{t.name}</strong> needs {t.travelTime} mins between campuses.</div>
              <button aria-label={`Remove travel time for ${t.name}`} onClick={() => { const up = teachers.map((x: any) => x.id === t.id ? { ...x, travelTime: undefined } : x); setConfig({ ...c, teachers: up }); }} style={{ cursor: "pointer", color: COLORS.danger, background: "none", border: "none", fontSize: "inherit", fontFamily: "inherit" }}>✕</button>
            </div>
          ))}

          {showTravel ? (
            <div style={{ padding: 12, background: COLORS.offWhite, borderRadius: 8, marginTop: 10 }}>
              <Sel label="Select Teacher" value={nt.teacherId} onChange={v => setNt({ ...nt, teacherId: v })} options={[{ value: "", label: "Select..." }, ...teachers.map((t: any) => ({ value: t.id, label: t.name }))]} />
              <NumInput label="Minutes Needed" value={nt.minutes} onChange={v => setNt({ ...nt, minutes: v })} min={5} max={60} />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <Btn onClick={saveTravel} small>Save Travel</Btn>
                <Btn variant="secondary" onClick={() => setShowTravel(false)} small>Cancel</Btn>
              </div>
            </div>
          ) : <Btn variant="ghost" onClick={() => setShowTravel(true)} small>+ Add Travel Constraint</Btn>}
        </div>

        {/* --- SECTION 3: COURSE LOCKS --- */}
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.lightGray}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 12px 0", color: COLORS.primaryDark }}>🔒 Course Constraints</h3>
          {cons.map(con => (
            <div key={con.id} style={{ display: "flex", justifyContent: "space-between", padding: 8, background: COLORS.offWhite, borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
              <div><strong>{types.find(t => t.value === con.type)?.label}</strong>{con.courseId && ` — ${c.courses?.find((x: any)=>x.id===con.courseId)?.name}`}{con.period && ` — P${con.period}`}</div>
              <button aria-label="Remove constraint" onClick={() => setCons(cons.filter(x => x.id !== con.id))} style={{ cursor: "pointer", color: COLORS.danger, background: "none", border: "none", fontSize: "inherit", fontFamily: "inherit" }}>✕</button>
            </div>
          ))}

          {showCon ? (
            <div style={{ padding: 12, background: COLORS.offWhite, borderRadius: 8, marginTop: 10 }}>
              <Sel label="Type" value={nc.type} onChange={v => setNc({ ...nc, type: v })} options={types} />
              <Sel label="Course" value={nc.courseId || ""} onChange={v => setNc({ ...nc, courseId: v })} options={[{ value: "", label: "Select..." }, ...(c.courses || []).map((x: any) => ({ value: x.id, label: x.name }))]} />
              <NumInput label="Period" min={1} max={c.periodsCount || 7} value={nc.period || 1} onChange={v => setNc({ ...nc, period: v })} />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <Btn onClick={() => { setCons([...cons, { ...nc, id: `con_${Date.now()}` }]); setShowCon(false); }} small>Add</Btn>
                <Btn variant="secondary" onClick={() => setShowCon(false)} small>Cancel</Btn>
              </div>
            </div>
          ) : <Btn variant="ghost" onClick={() => setShowCon(true)} small>+ Add Course Lock</Btn>}
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={() => { setConfig({ ...c, constraints: cons, teacherAvailability: avail }); onNext(); }}>⚡ Generate Schedule →</Btn>
      </div>
    </div>
  );
}