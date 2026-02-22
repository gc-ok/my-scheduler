// src/components/grid/RoomGrid.tsx
import React, { useMemo } from "react";
import { COLORS } from "../../utils/theme";
import { PeriodHeader } from "./TeacherGrid";
import { Section, Period, Room, ScheduleConfig } from "../../types";

interface RoomGridProps {
  schedule: any;
  config: ScheduleConfig;
}

export default function RoomGrid({ schedule, config }: RoomGridProps) {
  const { periodList = [], rooms = [], sections = [] } = schedule;
  
  let terms = [""];
  if (config?.scheduleType === "ab_block") terms = ["A", "B"];
  if (config?.scheduleType === "4x4_block") terms = ["S1", "S2"];
  if (config?.scheduleType === "trimester") terms = ["T1", "T2", "T3"];
  
  const teachP = (periodList as Period[]).filter(p => p.type !== "unit_lunch");

  // OPTIMIZATION: Create a hash map for O(1) section lookup by room and period
  const roomSectionMap = useMemo(() => {
    const map: Record<string, Record<string, Section>> = {};
    (sections as Section[]).forEach(s => {
      if (s.room && s.period) {
        if (!map[s.room]) map[s.room] = {};
        if (!map[s.room][s.period]) map[s.room][s.period] = s;
      }
    });
    return map;
  }, [sections]);

  const RenderRoomCell = ({ s, p, dayLabel, termCount }: { s?: Section, p: Period, dayLabel: string, termCount: number }) => {
    const heightPct = termCount > 1 ? `${100 / termCount}%` : "100%";
    const baseStyle = {
      width: "100%", height: heightPct, display: "flex", 
      borderBottom: termCount > 1 && dayLabel !== terms[terms.length - 1] ? `1px dashed ${COLORS.lightGray}` : "none",
      background: s ? COLORS.white : "#FAFAFA",
      padding: 2
    };

    if (s) {
      return (
        <div style={baseStyle}>
          <div style={{ width: "100%", background: COLORS.purpleLight, color: COLORS.purple, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.courseName}</span>
              {dayLabel && <span style={{ fontSize: 7, background: COLORS.purple, color: COLORS.white, padding: "1px 3px", borderRadius: 3 }}>{dayLabel}</span>}
            </div>
            <span style={{ fontSize: 8, fontWeight: 400, color: COLORS.purple }}>{s.teacherName} · 👥{s.enrollment}</span>
          </div>
        </div>
      );
    }
    
    if (p.type === "win") {
      return <div style={{ ...baseStyle, color: COLORS.midGray, fontSize: 10, fontStyle: "italic", alignItems: "center", justifyContent: "center" }}>Available</div>;
    }

    return <div style={baseStyle} />;
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${teachP.length}, minmax(100px, 1fr))`, gap: 0, minWidth: 120 + teachP.length * 100 }}>
        <div style={{ padding: 8, background: COLORS.primary, color: COLORS.white, fontWeight: 700, borderRadius: "8px 0 0 0", fontSize: 12 }}>Room</div>
        
        {teachP.map((p, i) => <PeriodHeader key={p.id} p={p} isLast={i === teachP.length - 1} />)}
        
        {(rooms as Room[]).map(r => (
          <React.Fragment key={r.id}>
            <div style={{ padding: "6px 8px", background: COLORS.offWhite, borderBottom: `1px solid ${COLORS.lightGray}`, fontSize: 11, fontWeight: 600, color: COLORS.text, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div>{r.name}</div>
              <div style={{ color: COLORS.midGray, fontSize: 9 }}>{r.type.toUpperCase()}</div>
            </div>
            
            {teachP.map(p => {
              const isNT = p.type === "unit_lunch" || p.type === "win";

              return (
                <div key={`${r.id}-${p.id}`} style={{ borderBottom: `1px solid ${COLORS.lightGray}`, borderRight: `1px solid ${COLORS.lightGray}`, minHeight: 60, display: "flex", flexDirection: "column" }}>
                  {terms.map(term => {
                    const searchPid = term ? `${term}-${p.id}` : p.id;
                    const s = roomSectionMap[r.id]?.[searchPid];
                    
                    if (isNT && term !== terms[0]) return null;
                    
                    return <RenderRoomCell key={term} s={s} p={p} dayLabel={term} termCount={isNT ? 1 : terms.length} />;
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