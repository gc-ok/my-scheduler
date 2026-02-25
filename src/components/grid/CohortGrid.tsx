// src/components/grid/CohortGrid.tsx
import React, { useMemo } from "react";
import { COLORS } from "../../utils/theme";
import { PeriodHeader } from "./TeacherGrid";
import { Section, Period, Cohort, ScheduleConfig } from "../../types";

const GRADE_ORDER = ['PK', 'Pre-K', 'K', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const gradeSort = (a: string, b: string) => {
  const ai = GRADE_ORDER.indexOf(a);
  const bi = GRADE_ORDER.indexOf(b);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return a.localeCompare(b);
};

const gradeLabel = (g: string) => {
  if (g === "PK" || g === "Pre-K") return "Pre-Kindergarten";
  if (g === "K" || g === "KG") return "Kindergarten";
  return `Grade ${g}`;
};

const getDeptColor = (deptName: string) => {
  if (!deptName) return "#94a3b8";
  const hash = String(deptName).split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 45%)`;
};

interface CohortGridProps {
  schedule: any;
  config: ScheduleConfig;
  setEditSection?: (section: Section) => void;
}

interface CohortRow {
  cohortId: string;
  gradeLevel: string;
  displayName: string;
  teacherName: string;
  periodMap: Record<string | number, Section[]>;
  allSections: Section[];
  unscheduled: Section[];
}

export default function CohortGrid({ schedule, config, setEditSection }: CohortGridProps) {
  const { periods: allP = [], sections: secs = [] } = schedule;
  const configCohorts: Cohort[] = config.cohorts || [];

  const hasCohorts = useMemo(() => (secs as Section[]).some(s => s.cohortId), [secs]);

  // Build per-cohort data: cohortId -> { meta, periodMap, unscheduled }
  const { gradeGroups, sortedGrades, totalUnscheduled, totalSections } = useMemo(() => {
    const map: Record<string, CohortRow> = {};

    (secs as Section[]).forEach(s => {
      if (!s.cohortId) return;
      if (!map[s.cohortId]) {
        const def = configCohorts.find(c => c.id === s.cohortId);
        map[s.cohortId] = {
          cohortId: s.cohortId,
          gradeLevel: s.gradeLevel || def?.gradeLevel || "?",
          displayName: def?.name || s.cohortId,
          teacherName: def?.teacherName || "",
          periodMap: {},
          allSections: [],
          unscheduled: [],
        };
      }
      map[s.cohortId].allSections.push(s);
      if (s.period == null) {
        map[s.cohortId].unscheduled.push(s);
      } else {
        const pid = s.period;
        if (!map[s.cohortId].periodMap[pid]) map[s.cohortId].periodMap[pid] = [];
        if (!map[s.cohortId].periodMap[pid].find(x => x.id === s.id)) {
          map[s.cohortId].periodMap[pid].push(s);
        }
      }
    });

    const rows = Object.values(map).sort((a, b) => {
      const g = gradeSort(a.gradeLevel, b.gradeLevel);
      return g !== 0 ? g : a.displayName.localeCompare(b.displayName);
    });

    const groups: Record<string, CohortRow[]> = {};
    rows.forEach(r => {
      if (!groups[r.gradeLevel]) groups[r.gradeLevel] = [];
      groups[r.gradeLevel].push(r);
    });

    let totUn = 0, totAll = 0;
    rows.forEach(r => { totUn += r.unscheduled.length; totAll += r.allSections.length; });

    return {
      gradeGroups: groups,
      sortedGrades: Object.keys(groups).sort(gradeSort),
      totalUnscheduled: totUn,
      totalSections: totAll,
    };
  }, [secs, configCohorts]);

  // Collect all period IDs a cohort may occupy given schedule type variants
  const getMatchPids = (p: Period): (string | number)[] => {
    const pids: (string | number)[] = [p.id];
    if (config?.scheduleType === "ab_block") pids.push(`A-${p.id}`, `B-${p.id}`);
    if (config?.scheduleType === "4x4_block") pids.push(`S1-${p.id}`, `S2-${p.id}`);
    if (config?.scheduleType === "trimester") pids.push(`T1-${p.id}`, `T2-${p.id}`, `T3-${p.id}`);
    return pids;
  };

  if (!hasCohorts) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: COLORS.textLight }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏫</div>
        <h3 style={{ color: COLORS.text, margin: "0 0 8px 0" }}>No Cohort Data</h3>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          Cohort View is available for elementary and K-8 schools configured with cohorts.<br />
          Set up cohorts in the school configuration to use this view.
        </p>
      </div>
    );
  }

  const ROW_LABEL_W = 190;
  const COL_W = 140;
  // Extra column for unscheduled summary
  const hasUnscheduled = totalUnscheduled > 0;
  const UNSCHED_COL_W = 160;

  return (
    <div style={{ overflowX: "auto" }}>
      {/* Summary banner */}
      {(totalUnscheduled > 0) && (
        <div style={{
          padding: "8px 14px", marginBottom: 6, borderRadius: 8,
          background: `${COLORS.danger}12`,
          border: `1px solid ${COLORS.danger}`,
          display: "flex", alignItems: "center", gap: 16, fontSize: 12,
        }}>
          <span style={{ fontWeight: 700, color: COLORS.danger }}>⚠️ Incomplete Schedule</span>
          <span style={{ color: COLORS.text }}>
            {totalSections - totalUnscheduled}/{totalSections} sections placed ·{" "}
            <strong style={{ color: COLORS.danger }}>{totalUnscheduled} could not be scheduled</strong>
          </span>
          <span style={{ fontSize: 11, color: COLORS.textLight, marginLeft: "auto" }}>
            Check period count vs courses per cohort — there may not be enough teaching periods
          </span>
        </div>
      )}
      <div style={{
        display: "grid",
        gridTemplateColumns: `${ROW_LABEL_W}px repeat(${allP.length}, minmax(${COL_W}px, 1fr))${hasUnscheduled ? ` ${UNSCHED_COL_W}px` : ""}`,
        gap: 0,
        minWidth: ROW_LABEL_W + allP.length * COL_W + (hasUnscheduled ? UNSCHED_COL_W : 0),
      }}>

        {/* Header row */}
        <div style={{ padding: 8, background: COLORS.primaryDark, color: COLORS.white, fontWeight: 700, fontSize: 12, borderRadius: "8px 0 0 0", display: "flex", alignItems: "center" }}>
          Cohort / Grade
        </div>
        {(allP as Period[]).map((p, i) => (
          <PeriodHeader key={p.id} p={p} isLast={!hasUnscheduled && i === allP.length - 1} />
        ))}
        {hasUnscheduled && (
          <div style={{ padding: "6px 8px", background: COLORS.danger, color: COLORS.white, fontWeight: 700, fontSize: 11, borderRadius: "0 8px 0 0", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            Unscheduled
          </div>
        )}

        {/* Grade groups */}
        {sortedGrades.map(grade => (
          <React.Fragment key={grade}>

            {/* Grade divider */}
            <div style={{
              gridColumn: "1 / -1",
              padding: "5px 14px",
              background: COLORS.primary,
              color: COLORS.white,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <span>{gradeLabel(grade)}</span>
              <span style={{ fontWeight: 400, opacity: 0.75, fontSize: 10 }}>
                {gradeGroups[grade].length} cohort{gradeGroups[grade].length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Cohort rows */}
            {gradeGroups[grade].map(cohort => {
              const scheduledCount = cohort.allSections.length - cohort.unscheduled.length;
              const hasIssues = cohort.unscheduled.length > 0;

              return (
                <React.Fragment key={cohort.cohortId}>

                  {/* Row label */}
                  <div style={{
                    padding: "6px 10px",
                    background: hasIssues ? `${COLORS.danger}08` : COLORS.offWhite,
                    borderBottom: `1px solid ${COLORS.lightGray}`,
                    borderRight: `1px solid ${COLORS.lightGray}`,
                    borderLeft: hasIssues ? `3px solid ${COLORS.danger}` : "none",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    minHeight: 56,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      🏠 {cohort.displayName}
                    </div>
                    {cohort.teacherName && (
                      <div style={{ fontSize: 9, color: COLORS.textLight, marginTop: 2 }}>{cohort.teacherName}</div>
                    )}
                    <div style={{ fontSize: 8, color: hasIssues ? COLORS.danger : COLORS.success, fontWeight: 600, marginTop: 2 }}>
                      {scheduledCount}/{cohort.allSections.length} scheduled
                    </div>
                  </div>

                  {/* Period cells */}
                  {(allP as Period[]).map(p => {
                    const isNT = p.type === "unit_lunch" || p.type === "win" || p.type === "recess";
                    const matchPids = getMatchPids(p);

                    // Collect all sections for this cohort at this period (de-duped)
                    const cellSections: Section[] = [];
                    matchPids.forEach(pid => {
                      (cohort.periodMap[pid] || []).forEach(s => {
                        if (!cellSections.find(cs => cs.id === s.id)) cellSections.push(s);
                      });
                    });

                    // Non-teaching period
                    if (isNT) {
                      const isLunch = p.type === "unit_lunch";
                      const isRecess = p.type === "recess";
                      return (
                        <div key={`${cohort.cohortId}-${p.id}`} style={{
                          padding: "4px 6px", minHeight: 56,
                          borderBottom: `1px solid ${COLORS.lightGray}`,
                          borderRight: `1px solid ${COLORS.lightGray}`,
                          background: isLunch ? `${COLORS.warning}10` : isRecess ? "#F0FDF4" : COLORS.offWhite,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <span style={{ fontSize: 9, fontWeight: 600, color: isLunch ? COLORS.warning : isRecess ? COLORS.success : COLORS.midGray }}>
                            {isLunch ? "🥗 Lunch" : isRecess ? "🛝 Recess" : p.type.toUpperCase()}
                          </span>
                        </div>
                      );
                    }

                    // Empty teaching period — show as a gap with context
                    if (cellSections.length === 0) {
                      return (
                        <div key={`${cohort.cohortId}-${p.id}`} style={{
                          minHeight: 56,
                          borderBottom: `1px solid ${COLORS.lightGray}`,
                          borderRight: `1px solid ${COLORS.lightGray}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: hasIssues ? `${COLORS.danger}05` : COLORS.white,
                        }}>
                          <span style={{ fontSize: 9, color: hasIssues ? COLORS.danger : COLORS.lightGray, fontStyle: "italic" }}>
                            {hasIssues ? "No class" : "Free"}
                          </span>
                        </div>
                      );
                    }

                    // Section cell
                    return (
                      <div key={`${cohort.cohortId}-${p.id}`} style={{
                        minHeight: 56,
                        borderBottom: `1px solid ${COLORS.lightGray}`,
                        borderRight: `1px solid ${COLORS.lightGray}`,
                        padding: 3,
                        background: COLORS.white,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}>
                        {cellSections.map(s => {
                          const deptColor = getDeptColor(s.department);
                          return (
                            <div
                              key={s.id}
                              onClick={() => setEditSection?.(s)}
                              style={{
                                flex: 1, padding: "3px 5px",
                                borderRadius: "0 3px 3px 0",
                                borderLeft: `3px solid ${s.hasConflict ? COLORS.danger : deptColor}`,
                                background: s.hasConflict ? `${COLORS.danger}10` : `${deptColor}12`,
                                cursor: setEditSection ? "pointer" : "default",
                                display: "flex", flexDirection: "column", justifyContent: "center",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "85%" }}>
                                  {s.courseName}
                                </span>
                                {s.hasConflict && (
                                  <span title={s.conflictReason} style={{ fontSize: 9, cursor: "help", flexShrink: 0 }}>⚠️</span>
                                )}
                              </div>
                              <div style={{ fontSize: 8, color: COLORS.textLight, marginTop: 1 }}>
                                {s.teacherName || "TBD"}{s.coTeacherName ? ` & ${s.coTeacherName}` : ""} · {s.roomName || "—"}
                              </div>
                              {s.lunchWave && (
                                <span style={{ fontSize: 7, background: COLORS.warning, color: COLORS.text, padding: "1px 3px", borderRadius: 3, alignSelf: "flex-start", marginTop: 1 }}>
                                  W{s.lunchWave}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Unscheduled column */}
                  {hasUnscheduled && (
                    <div style={{
                      minHeight: 56,
                      borderBottom: `1px solid ${COLORS.lightGray}`,
                      borderRight: `1px solid ${COLORS.lightGray}`,
                      padding: 4,
                      background: cohort.unscheduled.length > 0 ? `${COLORS.danger}08` : "#F8FFF8",
                      display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
                    }}>
                      {cohort.unscheduled.length === 0 ? (
                        <span style={{ fontSize: 9, color: COLORS.success, fontWeight: 600, textAlign: "center" }}>All placed</span>
                      ) : (
                        cohort.unscheduled.map(s => (
                          <div
                            key={s.id}
                            onClick={() => setEditSection?.(s)}
                            style={{
                              padding: "2px 4px", borderRadius: 3,
                              borderLeft: `3px solid ${COLORS.danger}`,
                              background: `${COLORS.danger}10`,
                              cursor: setEditSection ? "pointer" : "default",
                              fontSize: 9, color: COLORS.danger, fontWeight: 600,
                            }}
                            title={`Could not schedule: ${s.courseName} — no available period (teacher/room/cohort conflict)`}
                          >
                            {s.courseName.replace(` - ${cohort.displayName}`, "")}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
