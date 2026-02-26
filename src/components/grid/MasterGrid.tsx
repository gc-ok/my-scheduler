// src/components/grid/MasterGrid.tsx
import React, { useMemo } from "react";
import { COLORS, PERIOD_COLORS } from "../../utils/theme";
import { PeriodHeader } from "./TeacherGrid";
import { Section, Period, ScheduleConfig } from "../../types";

const getDeptColor = (deptName: string) => {
  if (!deptName) return "#94a3b8"; 
  const hash = String(deptName).split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 45%)`;
};

interface SecCardProps {
  section: Section;
  dragItem: Section | null;
  onDragStart: (s: Section) => void;
  togLock: (id: string) => void;
  setEditSection: (s: Section) => void;
  onConflictClick: (s: Section) => void;
}

export const SecCard = ({ section: s, dragItem, onDragStart, togLock, setEditSection, onConflictClick }: SecCardProps) => {
  const deptColor = getDeptColor(s.department);
  const bg = s.hasConflict ? "#FFF0F0" : `${deptColor}15`;
  const borderLeftColor = s.hasConflict ? COLORS.danger : deptColor;
  const borderOtherColor = s.hasConflict ? COLORS.danger : s.locked ? COLORS.accent : "transparent";

  // Dynamic Badge parsing for A/B, S1/S2, and T1/T2/T3
  const pStr = s.period?.toString() || "";
  let dayBadge = null;
  if (pStr.startsWith('A-') || pStr.startsWith('B-') || pStr.startsWith('S1-') || pStr.startsWith('S2-') || pStr.startsWith('T1-') || pStr.startsWith('T2-') || pStr.startsWith('T3-')) {
     dayBadge = pStr.split('-')[0]; // Grabs "A", "S1", "T2", etc.
  }

  return (
    <div onClick={(e) => { e.stopPropagation(); setEditSection(s); }} draggable={!s.locked} onDragStart={() => onDragStart(s)} 
      style={{ padding: "4px 6px", marginBottom: 2, borderRadius: "0 4px 4px 0", border: `1px solid ${borderOtherColor}`, borderLeft: `4px solid ${borderLeftColor}`, background: bg, cursor: "pointer", fontSize: 10, opacity: dragItem?.id === s.id ? 0.3 : 1, color: COLORS.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{s.courseName}</span>
        <div style={{ display: "flex", gap: 2, flexShrink: 0, alignItems: "center" }}>
          {s.isSingleton && <span title="Singleton Section" style={{ fontSize: 8, cursor: "help" }}>1️⃣</span>}
          {dayBadge && <span style={{ fontSize: 7, background: COLORS.darkGray, color: COLORS.white, padding: "1px 3px", borderRadius: 3, marginRight: 2 }}>{dayBadge}</span>}
          {s.lunchWave && <span style={{ fontSize: 7, background: COLORS.warning, color: COLORS.text, padding: "1px 3px", borderRadius: 3 }}>W{s.lunchWave}</span>}
          {s.hasConflict && <button onClick={(e) => { e.stopPropagation(); onConflictClick(s); }} title={s.conflictReason} style={{ cursor: "help", background: 'none', border: 'none', padding: 0, margin: 0, fontSize: 'inherit' }}>⚠️</button>}
          <span onClick={e => { e.stopPropagation(); togLock(s.id); }} style={{ cursor: "pointer", fontSize: 9, marginLeft: 2 }}>{s.locked ? "🔒" : "🔓"}</span>
        </div>
      </div>
      <div style={{ color: COLORS.textLight, fontSize: 9, marginTop: 1 }}>{s.teacherName || "TBD"} {s.coTeacherName ? `& ${s.coTeacherName}` : ""} · {s.roomName || "—"}</div>
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, color: COLORS.primary, fontWeight: 600 }}>👥 {s.enrollment}/{s.maxSize}</span>
        {s.cohortId && (
          <span title={`Cohort: ${s.cohortId}`} style={{ fontSize: 7, background: "#D1FAE5", color: "#065F46", padding: "1px 4px", borderRadius: 3, fontWeight: 700 }}>
            🏠 {s.cohortId}
          </span>
        )}
        {s.parallelGroupId && (
          <span title={`Parallel Group: ${s.parallelGroupId}`} style={{ fontSize: 7, background: "#EDE9FE", color: "#5B21B6", padding: "1px 4px", borderRadius: 3, fontWeight: 700 }}>
            ⟷ {s.parallelGroupId}
          </span>
        )}
        {s.gradeLevel && s.gradeLevel !== "all" && (
          <span title={`Grade: ${s.gradeLevel}`} style={{ fontSize: 7, background: "#FEF3C7", color: "#92400E", padding: "1px 4px", borderRadius: 3 }}>
            Gr {s.gradeLevel}
          </span>
        )}
      </div>
    </div>
  );
};

interface MasterGridProps {
  schedule: any;
  config: ScheduleConfig;
  fSecs: Section[];
  dragItem: Section | null;
  onDragStart: (s: Section) => void;
  onDrop: (pid: string | number) => void;
  togLock: (id: string) => void;
  setEditSection: (s: Section) => void;
  onPeriodTimeChange: (id: string | number, part: 'start' | 'end', value: string) => void;
  onConflictClick: (s: Section) => void;
}

export default function MasterGrid({ schedule, config, fSecs, dragItem, onDragStart, onDrop, togLock, setEditSection, onPeriodTimeChange, onConflictClick }: MasterGridProps) {
  const { periods: allP = [], periodStudentData: psd = {}, stats, teacherSchedule: tSched = {} } = schedule;
  const studentCount = stats?.totalStudents || 0;

  // OPTIMIZATION: Pre-calculate sections grouped by courseId to avoid O(N^2) filtering in render
  const { sectionsByCourse, courseIds } = useMemo(() => {
    const map: Record<string, Section[]> = {};
    const order: string[] = [];
    fSecs.forEach(s => {
      if (!map[s.courseId]) {
        map[s.courseId] = [];
        order.push(s.courseId);
      }
      map[s.courseId].push(s);
    });
    return { sectionsByCourse: map, courseIds: order };
  }, [fSecs]);

  const StudentBar = ({ pid }: { pid: string | number }) => {
    const data = psd[pid];
    if (!data) return null;
    const pctClass = studentCount > 0 ? Math.round(data.seatsInClass / studentCount * 100) : 0;
    const isWave = data.atLunch === "Waves";
    const pctLunch = isWave ? 0 : (studentCount > 0 ? Math.round(data.atLunch / studentCount * 100) : 0);
    const pctMissing = studentCount > 0 ? Math.round(data.unaccounted / studentCount * 100) : 0;
    
    return (
      <div style={{ padding: "3px 4px", borderBottom: `1px solid ${COLORS.lightGray}`, borderRight: `1px solid ${COLORS.lightGray}`, background: data.unaccounted > 50 ? "#FFF8F8" : "#F8FFF8" }}>
        <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: COLORS.lightGray }}>
          <div style={{ width: `${pctClass}%`, background: COLORS.success }} title={`In class: ${data.seatsInClass}`} />
          <div style={{ width: `${pctLunch}%`, background: COLORS.warning }} title={`At lunch: ${data.atLunch}`} />
          {pctMissing > 0 && <div style={{ width: `${pctMissing}%`, background: COLORS.danger }} title={`Unaccounted: ${data.unaccounted}`} />}
        </div>
        <div style={{ fontSize: 8, color: COLORS.textLight, marginTop: 2, display: "flex", justifyContent: "space-between" }}>
          <span>📚{data.seatsInClass}</span>
          {data.atLunch > 0 && <span>🥗{data.atLunch}</span>}
          {data.unaccounted > 0 && <span style={{ color: COLORS.danger, fontWeight: 700 }}>❓{data.unaccounted}</span>}
        </div>
      </div>
    );
  };

  // Compute unscheduled totals for the summary banner
  const totalSections = fSecs.length;
  const unscheduledSections = fSecs.filter(s => s.period == null);
  const scheduledCount = totalSections - unscheduledSections.length;
  const conflictCount = fSecs.filter(s => s.hasConflict).length;

  return (
    <div style={{ overflowX: "auto" }}>
      {/* Scheduling summary banner */}
      {(unscheduledSections.length > 0 || conflictCount > 0) && (
        <div style={{
          padding: "8px 14px", marginBottom: 6, borderRadius: 8,
          background: unscheduledSections.length > 0 ? `${COLORS.danger}12` : `${COLORS.warning}15`,
          border: `1px solid ${unscheduledSections.length > 0 ? COLORS.danger : COLORS.warning}`,
          display: "flex", alignItems: "center", gap: 16, fontSize: 12,
        }}>
          <span style={{ fontWeight: 700, color: unscheduledSections.length > 0 ? COLORS.danger : COLORS.warning }}>
            {unscheduledSections.length > 0 ? "⚠️ Incomplete Schedule" : "⚠️ Conflicts Found"}
          </span>
          <span style={{ color: COLORS.text }}>
            {scheduledCount}/{totalSections} sections placed
            {unscheduledSections.length > 0 && <> · <strong style={{ color: COLORS.danger }}>{unscheduledSections.length} unscheduled</strong></>}
            {conflictCount > 0 && <> · <strong style={{ color: COLORS.warning }}>{conflictCount} conflicts</strong></>}
          </span>
          {unscheduledSections.length > 0 && (
            <span style={{ fontSize: 11, color: COLORS.textLight, marginLeft: "auto" }}>
              Unscheduled: {[...new Set(unscheduledSections.map(s => s.courseName))].slice(0, 5).join(", ")}
              {[...new Set(unscheduledSections.map(s => s.courseName))].length > 5 && "..."}
            </span>
          )}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: `130px repeat(${allP.length}, minmax(130px, 1fr))`, gap: 0, minWidth: 130 + allP.length * 130 }}>

        <div style={{ padding: 8, background: COLORS.primaryDark, color: COLORS.white, fontWeight: 700, fontSize: 12, borderRadius: "8px 0 0 0", display: "flex", alignItems: "center" }}>Course / Period</div>
        {allP.map((p: Period, i: number) => <PeriodHeader key={p.id} p={p} isLast={i === allP.length - 1} onTimeChange={onPeriodTimeChange} />)}

        <div style={{ padding: "4px 8px", background: COLORS.offWhite, borderBottom: `2px solid ${COLORS.primary}`, borderRight: `1px solid ${COLORS.lightGray}`, fontSize: 10, fontWeight: 700, color: COLORS.primary, display: "flex", alignItems: "center" }}>
          👥 {studentCount} Students
        </div>
        
        {allP.map((p: Period) => {
          const isTeaching = p.type === "class" || p.type === "split_lunch" || p.type === "multi_lunch";
          if (!isTeaching) {
            const isLunch = p.type === "unit_lunch";
            const isRecess = p.type === "recess";
            return (
              <div key={`sa-${p.id}`} onClick={() => setEditSection({ id: `manual-${Date.now()}`, courseName: "New Activity", period: p.id, department: "General", enrollment: studentCount, maxSize: studentCount, locked: true } as Section)} style={{ padding: "3px 4px", borderBottom: `2px solid ${COLORS.primary}`, borderRight: `1px solid ${COLORS.lightGray}`, background: isLunch ? `${COLORS.warning}15` : isRecess ? "#F0FDF4" : COLORS.offWhite, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <span style={{ fontSize: 9, color: isLunch ? COLORS.warning : isRecess ? COLORS.success : COLORS.midGray, fontWeight: 600 }}>{isLunch ? `🥗 All ${studentCount}` : isRecess ? "🛝 Recess" : `${p.type.toUpperCase()} +`}</span>
              </div>
            );
          }
          return <StudentBar key={`sa-${p.id}`} pid={p.id} />;
        })}

        {courseIds.map((cid, ri) => {
          const cs = sectionsByCourse[cid];
          const isCore = cs[0]?.isCore;
          const unplacedForCourse = cs.filter(s => s.period == null);
          const courseTeachers = [...new Set(cs.map(s => s.teacher).filter(Boolean))] as string[];

          return (
            <React.Fragment key={cid}>
              <div style={{ padding: "6px 8px", background: unplacedForCourse.length > 0 ? `${COLORS.danger}10` : PERIOD_COLORS[ri % PERIOD_COLORS.length], borderBottom: `1px solid ${COLORS.lightGray}`, borderLeft: unplacedForCourse.length > 0 ? `3px solid ${COLORS.danger}` : "none", fontWeight: 600, fontSize: 11, display: "flex", flexDirection: "column", justifyContent: "center", color: COLORS.text }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cs[0]?.courseName || cid}</div>
                <div style={{ fontSize: 9, color: COLORS.textLight, marginTop: 2 }}>
                  {isCore ? "CORE" : "ELECT"} · {cs.length - unplacedForCourse.length}/{cs.length} placed
                </div>
                {unplacedForCourse.length > 0 && (
                  <div style={{ fontSize: 8, color: COLORS.danger, fontWeight: 700, marginTop: 2 }}>
                    ⚠️ {unplacedForCourse.length} unscheduled
                  </div>
                )}
              </div>

              {allP.map((p: Period) => {
                // ROBUST TERM FILTERING: Matches the base ID and ALL possible term prefixes dynamically
                let matchPids: (string | number)[] = [p.id];
                if (config?.scheduleType === "ab_block") matchPids.push(`A-${p.id}`, `B-${p.id}`);
                if (config?.scheduleType === "4x4_block") matchPids.push(`S1-${p.id}`, `S2-${p.id}`);
                if (config?.scheduleType === "trimester") matchPids.push(`T1-${p.id}`, `T2-${p.id}`, `T3-${p.id}`);

                const ps = cs.filter(s => matchPids.includes(s.period!));
                const isNT = p.type === "unit_lunch" || p.type === "win" || p.type === "recess";

                // Determine empty cell status label (PLC, Plan, WIN, etc.)
                let emptyLabel: string | null = null;
                let emptyColor = COLORS.midGray;
                if (ps.length === 0) {
                  if (p.type === "win") { emptyLabel = "WIN"; emptyColor = COLORS.darkGray; }
                  else if (p.type === "recess") { emptyLabel = "Recess"; emptyColor = COLORS.success; }
                  else if (p.type === "unit_lunch") { emptyLabel = "Lunch"; emptyColor = COLORS.warning; }
                  else if (courseTeachers.length > 0) {
                    // Check teacherSchedule for explicit statuses (PLAN, PLC, LUNCH, etc.)
                    const reasons: Record<string, number> = {};
                    courseTeachers.forEach(tid => {
                      const st = tSched[tid]?.[p.id];
                      if (st === "PLC" || st === "PLAN" || st === "LUNCH" || st === "BLOCKED" || st === "RECESS") {
                        reasons[st] = (reasons[st] || 0) + 1;
                      }
                      // else: st is a section ID (teaching another course) or undefined → don't count
                    });
                    const entries = Object.entries(reasons);
                    if (entries.length > 0) {
                      const [topReason] = entries.sort((a, b) => b[1] - a[1])[0];
                      const info: Record<string, { label: string; color: string }> = {
                        PLC: { label: "🤝 PLC", color: COLORS.secondary },
                        PLAN: { label: "📋 Plan", color: COLORS.midGray },
                        LUNCH: { label: "🥗 Lunch", color: COLORS.warning },
                        BLOCKED: { label: "🚫 Unavail", color: COLORS.danger },
                        RECESS: { label: "🛝 Recess", color: COLORS.success },
                      };
                      emptyLabel = info[topReason]?.label || topReason;
                      emptyColor = info[topReason]?.color || COLORS.midGray;
                    }
                  }
                }

                return (
                  <div key={`${cid}-${p.id}`} onDragOver={e => !isNT && e.preventDefault()} onDrop={() => !isNT && onDrop(p.id)} style={{ padding: 3, minHeight: 44, borderBottom: `1px solid ${COLORS.lightGray}`, borderRight: `1px solid ${COLORS.lightGray}`, background: isNT ? "#F0F0F0" : dragItem ? `${COLORS.accentLight}30` : COLORS.white }}>
                    {emptyLabel && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 38 }}>
                        <span style={{ fontSize: 9, color: emptyColor, fontWeight: 600, opacity: 0.6 }}>{emptyLabel}</span>
                      </div>
                    )}
                    {ps.map(s => <SecCard key={s.id} section={s} dragItem={dragItem} onDragStart={onDragStart} togLock={togLock} setEditSection={setEditSection} onConflictClick={onConflictClick} />)}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}