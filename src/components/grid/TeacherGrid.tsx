import React, { useMemo } from "react";
import { COLORS } from "../../utils/theme";
import { Period, Section, Teacher } from "../../types";

const getDeptColor = (deptName: string) => {
  if (!deptName) return "#94a3b8";
  const hash = String(deptName).split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 45%)`;
};

export const PeriodHeader = ({ p, isLast }: { p: Period; isLast: boolean }) => {
  const bgMap: Record<string, string> = { class: COLORS.primary, split_lunch: COLORS.secondary, multi_lunch: COLORS.secondary, unit_lunch: COLORS.warning, win: COLORS.darkGray };
  const safeType = p.type || "class"; // Prevent .replace() crash
  return (
    <div style={{ padding: "6px 4px", textAlign: "center", fontWeight: 700, fontSize: 11, color: COLORS.white, borderRadius: isLast ? "0 8px 0 0" : 0, background: bgMap[safeType] || COLORS.primary, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 54 }}>
      <div>{p.label}</div>
      <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.9, marginTop: 2 }}>{p.startTime} – {p.endTime}</div>
      {safeType !== "class" && <div style={{ fontSize: 8, opacity: 0.8, textTransform: "uppercase", marginTop: 1 }}>{safeType.replace("_", " ")}</div>}
    </div>
  );
};

interface TeacherGridProps {
  schedule: any;
  config: any;
  fDept: string;
  setEditSection?: (section: any) => void;
  onTeacherClick?: (teacher: Teacher) => void;
  onEditTeacher?: (teacher: Teacher) => void;
}

export default function TeacherGrid({ schedule, config, fDept, setEditSection, onTeacherClick, onEditTeacher }: TeacherGridProps) {
  const { periodList: allP = [], teachers = [], sections: secs = [], teacherSchedule = {} } = schedule;
  const numWaves = Number(config?.lunchConfig?.numWaves) || 3; // Enforce Number type to prevent Array.from crash
  
  // OPTIMIZATION: Create a hash map for O(1) section lookup by teacher and period
  const sectionMap = useMemo(() => {
    const map: Record<string, Record<string, Section>> = {};
    (secs as Section[]).forEach(s => {
      const pid = s.period;
      if (!pid) return;
      
      if (s.teacher) {
        if (!map[s.teacher]) map[s.teacher] = {};
        if (!map[s.teacher][pid]) map[s.teacher][pid] = s;
      }
      if (s.coTeacher) {
        if (!map[s.coTeacher]) map[s.coTeacher] = {};
        if (!map[s.coTeacher][pid]) map[s.coTeacher][pid] = s;
      }
    });
    return map;
  }, [secs]);

  let terms = [""];
  if (config?.scheduleType === "ab_block") terms = ["A", "B"];
  if (config?.scheduleType === "4x4_block") terms = ["S1", "S2"];
  if (config?.scheduleType === "trimester") terms = ["T1", "T2", "T3"];

  const RenderCell = ({ s, status, p, t, dayLabel, termCount }: { s?: Section; status: string; p: Period; t: Teacher; dayLabel: string; termCount: number }) => {
    const isLunch = status === "LUNCH";
    const isPLC = status === "PLC";
    const isBlocked = status === "BLOCKED";
    const isNT = p.type === "unit_lunch" || p.type === "win";
    const isCoTeaching = s && s.coTeacher === t.id;

    const heightPct = termCount > 1 ? `${100 / termCount}%` : "100%";
    const baseStyle: React.CSSProperties = { width: "100%", height: heightPct, display: "flex", alignItems: "stretch", borderBottom: termCount > 1 && dayLabel !== terms[terms.length - 1] ? `1px dashed ${COLORS.lightGray}` : "none", background: isNT ? "#F1F5F9" : isLunch ? `${COLORS.warning}12` : COLORS.white };

    if (s && p.type === "split_lunch" && s.lunchWave) {
      return (
        <div style={{ ...baseStyle, gap: 4, padding: 2 }}>
          {Array.from({ length: numWaves }).map((_, wIdx) => {
            const waveNum = wIdx + 1;
            const isEatingNow = s.lunchWave === waveNum;
            return (
              <div key={wIdx} style={{ flex: 1, borderRadius: 3, padding: 1, background: isEatingNow ? `${COLORS.warning}20` : COLORS.accentLight, border: `1px solid ${isEatingNow ? COLORS.warning : COLORS.accent}`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                {isEatingNow ? <span style={{ fontSize: 8, color: COLORS.warning, fontWeight: 700 }}>W{waveNum}</span> : <span style={{ fontSize: 7, fontWeight: 600, color: COLORS.primaryDark }}>{s.courseName}</span>}
              </div>
            );
          })}
        </div>
      );
    }

    if (s) {
      return (
        <div onClick={() => setEditSection?.(s)} style={{ ...baseStyle, background: `${getDeptColor(s.department)}15`, borderLeft: `3px solid ${getDeptColor(s.department)}`, padding: "2px 6px", flexDirection: "column", justifyContent: "center", cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 10, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.courseName} {isCoTeaching && "🤝"}</span>
            {dayLabel && <span style={{ fontSize: 7, background: COLORS.darkGray, color: COLORS.white, padding: "1px 3px", borderRadius: 3 }}>{dayLabel}</span>}
          </div>
          <span style={{ fontSize: 8, fontWeight: 500, color: COLORS.textLight }}>{s.roomName} · 👥{s.enrollment}</span>
        </div>
      );
    }
    
    if (isBlocked) return <div style={{ ...baseStyle, color: COLORS.danger, fontSize: 9, fontWeight: 700, alignItems: "center", justifyContent: "center", background: `${COLORS.danger}15` }}>🚫 {dayLabel}</div>;
    if (isLunch) return <div style={{ ...baseStyle, color: COLORS.warning, fontWeight: 700, fontSize: 10, alignItems: "center", justifyContent: "center" }}>🥗 LUNCH</div>;
    if (isNT) return <div style={{ ...baseStyle, color: COLORS.midGray, fontSize: 9, alignItems: "center", justifyContent: "center" }}>{(p.type||"").toUpperCase()}</div>;
    if (isPLC) return <div style={{ ...baseStyle, color: COLORS.secondary, fontSize: 9, fontWeight: 600, alignItems: "center", justifyContent: "center", background: `${COLORS.secondary}15` }}>🤝 PLC {dayLabel}</div>;

    return (
      <div onClick={() => setEditSection?.({ id: `manual-${Date.now()}`, courseName: "New Class", teacher: t.id, period: dayLabel ? `${dayLabel}-${p.id}` : p.id, department: t.departments?.[0] || "General", enrollment: 25, maxSize: 30, locked: true })} style={{ ...baseStyle, cursor: "pointer", flexDirection: "column", alignItems: "center", justifyContent: "center" }} className="empty-slot-hover">
        <div style={{ color: COLORS.midGray, fontSize: 8, fontStyle: "italic" }}>Plan {dayLabel}</div>
      </div>
    );
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `160px repeat(${allP.length}, minmax(140px, 1fr))`, gap: 0, minWidth: 160 + allP.length * 140 }}>
        <div style={{ padding: 8, background: COLORS.primary, color: COLORS.white, fontWeight: 700, borderRadius: "8px 0 0 0", fontSize: 12 }}>Teacher</div>
        {allP.map((p: Period, i: number) => <PeriodHeader key={p.id} p={p} isLast={i === allP.length - 1} />)}
        
        {teachers.filter((t: Teacher) => fDept === "all" || (t.departments || []).includes(fDept)).map((t: Teacher) => (
          <React.Fragment key={t.id}>
            <div style={{ padding: "6px 8px", background: COLORS.offWhite, borderBottom: `1px solid ${COLORS.lightGray}`, fontSize: 12, fontWeight: 600, color: COLORS.text, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span 
                  onClick={() => onTeacherClick?.(t)}
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                  title="Manage Availability"
                >
                  {t.name} {t.isFloater && <span title="Floater">🎈</span>}
                </span>
                <span onClick={() => onEditTeacher?.(t)} style={{ cursor: "pointer", fontSize: 10, marginLeft: 4 }} title="Edit Teacher">
                  ✏️
                </span>
              </div>
              <div style={{ fontSize: 9, color: COLORS.textLight, marginTop: 2 }}>{(t.departments || []).join(", ")}</div>
            </div>
            
            {allP.map((p: Period) => {
              const isNT = p.type === "unit_lunch" || p.type === "win";
              return (
                <div key={`${t.id}-${p.id}`} style={{ borderBottom: `1px solid ${COLORS.lightGray}`, borderRight: `1px solid ${COLORS.lightGray}`, minHeight: 60, display: "flex", flexDirection: "column" }}>
                  {terms.map(term => {
                    const searchPid = term ? `${term}-${p.id}` : p.id;
                    const s = sectionMap[t.id]?.[searchPid];
                    const status = teacherSchedule?.[t.id]?.[searchPid];
                    
                    if (isNT && term !== terms[0]) return null; 
                    return <RenderCell key={term || "default"} s={s} status={status} p={p} t={t} dayLabel={term} termCount={isNT ? 1 : terms.length} />;
                  })}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}