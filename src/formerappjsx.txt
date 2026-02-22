import React, { useState, useEffect, useCallback, useRef } from "react";

// ==========================================
// 1. CONSTANTS & THEME
// ==========================================
const COLORS = {
  primary: "#1B4965", primaryLight: "#2D6A8F", primaryDark: "#0F2D3F",
  secondary: "#5FA8D3", accent: "#62B6CB", accentLight: "#BEE9E8",
  success: "#4CAF50", warning: "#FF9800", danger: "#E53935", dangerLight: "#FFCDD2",
  white: "#FFFFFF", offWhite: "#F5F7FA", lightGray: "#E8ECF1",
  midGray: "#94A3B8", darkGray: "#475569", text: "#1E293B", textLight: "#64748B",
  gold: "#F59E0B", purple: "#7C3AED", purpleLight: "#EDE9FE",
  consoleBg: "#1e1e1e", consoleText: "#d4d4d4",
};
const PERIOD_COLORS = ["#E3F2FD","#FFF3E0","#E8F5E9","#FCE4EC","#F3E5F5","#E0F7FA","#FFF8E1","#E8EAF6","#FBE9E7","#F1F8E9"];
const INPUT_STYLE = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: `1px solid ${COLORS.lightGray}`, fontSize: 14, outline: "none",
  boxSizing: "border-box", fontFamily: "'Segoe UI', system-ui, sans-serif",
  backgroundColor: COLORS.white, color: COLORS.text, colorScheme: "light",
};
const SELECT_STYLE = { ...INPUT_STYLE, appearance: "auto" };
const SMALL_INPUT = { ...INPUT_STYLE, width: 60, padding: "7px 8px", textAlign: "center" };

// Time utilities
const toMins = t => { if (!t) return 480; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = mins => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
};
const toTime24 = mins => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(Math.floor(mins % 60)).padStart(2, "0")}`;

// ==========================================
// 2. DATABASE
// ==========================================
const DB_NAME = "MasterSchedulerDB";
const STORE_NAME = "scenarios";
const dbService = {
  open: () => new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains(STORE_NAME)) e.target.result.createObjectStore(STORE_NAME, { keyPath: "id" }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }),
  save: async s => { const db = await dbService.open(); return new Promise((res, rej) => { const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).put(s); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  loadAll: async () => { const db = await dbService.open(); return new Promise((res, rej) => { const tx = db.transaction(STORE_NAME, "readonly"); const r = tx.objectStore(STORE_NAME).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
};

// ==========================================
// 3. SCHEDULING ALGORITHM
// ==========================================
function generateSchedule(config) {
  const {
    teachers = [], courses = [], rooms = [], constraints = [],
    lunchConfig = {}, winConfig = {}, planPeriodsPerDay = 1,
    studentCount = 800, maxClassSize = 30,
    schoolStart = "08:00", schoolEnd = "15:00",
    passingTime = 5, scheduleMode = "period_length",
    periods = [],
  } = config;

  const logs = [];
  const log = (type, msg, data = null) => logs.push({ timestamp: Date.now(), type, msg, data });
  const conflicts = [];

  log("info", "🚀 Starting Robust Schedule Generation...");

  let finalPeriodLength = config.periodLength || 50;
  let periodList = [];

  if (periods && periods.length > 0) {
      periodList = periods.map(p => ({ ...p, type: "class" }));
  } else {
      const periodCount = config.periodsCount || 7;
      let currentMin = toMins(schoolStart);
      
      if (scheduleMode === "time_frame") {
          const startMins = toMins(schoolStart);
          const endMins = toMins(schoolEnd);
          const totalMinutes = endMins - startMins;
          const totalPassing = (periodCount - 1) * passingTime;
          const available = Math.max(0, totalMinutes - totalPassing);
          finalPeriodLength = Math.floor(available / periodCount);
      }

      for (let i = 1; i <= periodCount; i++) {
          periodList.push({
              id: i, label: `Period ${i}`, type: "class",
              startMin: currentMin, endMin: currentMin + finalPeriodLength,
              startTime: toTime(currentMin), endTime: toTime(currentMin + finalPeriodLength),
              duration: finalPeriodLength
          });
          currentMin += finalPeriodLength + passingTime;
      }
  }

  const lunchPid = lunchConfig.lunchPeriod; 
  const isSplitLunch = lunchConfig.style === "split";
  const lunchDuration = lunchConfig.lunchDuration || 30;
  const numWaves = lunchConfig.numWaves || 3;
  const minClassTime = lunchConfig.minClassTime || 30;
  const winPid = winConfig.enabled ? winConfig.winPeriod : null;

  periodList = periodList.map(p => {
      let type = "class";
      if (p.id === lunchPid) {
          type = isSplitLunch ? "split_lunch" : "unit_lunch";
          if (isSplitLunch) {
             const cafeteriaReq = lunchDuration * numWaves;
             const pedagogicalReq = minClassTime + lunchDuration;
             const required = Math.max(cafeteriaReq, pedagogicalReq);
             if (p.duration < (required - 2)) {
                 conflicts.push({ type: "coverage", message: `CRITICAL: Period ${p.id} is ${p.duration}m. Needs ${required}m to satisfy cafeteria (${cafeteriaReq}m) AND learning (${pedagogicalReq}m) constraints.` });
             }
          }
      } else if (p.id === winPid) {
          type = "win";
      }
      return { ...p, type };
  });

  const teachingPeriods = periodList;
  const teachingPeriodIds = teachingPeriods.map(p => p.id);
  const numTeachingPeriods = teachingPeriodIds.length;

  log("info", `Timeline: ${periodList.map(p => `${p.label}(${p.duration}m)`).join(" -> ")}`);

  const teacherHomeRoom = {};
  const regularRooms = rooms.filter(r => r.type === "regular");
  const labRooms = rooms.filter(r => r.type === "lab");
  const gymRooms = rooms.filter(r => r.type === "gym");
  let rIdx = 0, lIdx = 0;

  const sortedTeachers = [...teachers].sort((a, b) => {
    const aSci = (a.departments || []).some(d => d.includes("science"));
    const bSci = (b.departments || []).some(d => d.includes("science"));
    return bSci - aSci;
  });

  sortedTeachers.forEach(t => {
    const isLab = (t.departments || []).some(d => d.includes("science"));
    const isGym = (t.departments || []).some(d => d.toLowerCase().includes("pe"));
    if (isLab && labRooms.length > 0) { teacherHomeRoom[t.id] = labRooms[lIdx % labRooms.length].id; lIdx++; } 
    else if (isGym && gymRooms.length > 0) { teacherHomeRoom[t.id] = gymRooms[0].id; } 
    else if (regularRooms.length > 0) { if (rIdx < regularRooms.length) { teacherHomeRoom[t.id] = regularRooms[rIdx].id; rIdx++; } }
  });

  const teacherSchedule = {};
  const teacherBlocked = {};
  const roomSchedule = {};
  teachers.forEach(t => { teacherSchedule[t.id] = {}; teacherBlocked[t.id] = new Set(); });
  rooms.forEach(r => { roomSchedule[r.id] = {}; });

  if (!isSplitLunch && lunchPid) {
      teachers.forEach(t => { teacherSchedule[t.id][lunchPid] = "LUNCH"; teacherBlocked[t.id].add(lunchPid); });
  }

  constraints.forEach(c => {
    if (c.type === "teacher_unavailable") teacherBlocked[c.teacherId]?.add(parseInt(c.period));
  });

  const sections = [];
  const coreCourses = courses.filter(c => c.required);
  const electiveCourses = courses.filter(c => !c.required);
  const coreCount = coreCourses.length;
  
  const effectiveSlots = isSplitLunch ? numTeachingPeriods : numTeachingPeriods - 1; 
  const electiveSlotsPerStudent = Math.max(0, effectiveSlots - coreCount);

  coreCourses.forEach(c => {
      const num = c.sections || Math.ceil(studentCount / (c.maxSize || maxClassSize));
      const enroll = Math.ceil(studentCount / num);
      for(let s=0; s<num; s++) {
          sections.push({
              id: `${c.id}-S${s+1}`, courseId: c.id, courseName: c.name, 
              sectionNum: s+1, maxSize: c.maxSize || maxClassSize, 
              enrollment: Math.min(enroll, c.maxSize || maxClassSize),
              department: c.department, roomType: c.roomType || "regular",
              isCore: true, teacher: null, room: null, period: null, lunchWave: null
          });
      }
  });

  const totalElectiveSections = electiveCourses.reduce((sum, c) => sum + (c.sections || 0), 0);
  const totalElectiveDemand = studentCount * electiveSlotsPerStudent;
  
  electiveCourses.forEach(c => {
      let num = c.sections;
      const isPE = c.department.toLowerCase().includes("pe");
      const size = isPE ? 50 : (c.maxSize || maxClassSize);
      if (!num) {
         const share = totalElectiveSections > 0 ? (1/electiveCourses.length) : (1/electiveCourses.length);
         num = Math.max(1, Math.ceil((totalElectiveDemand * share) / size));
      }
      const enroll = Math.ceil(totalElectiveDemand / (totalElectiveSections || (num * electiveCourses.length))); 
      for(let s=0; s<num; s++) {
          sections.push({
              id: `${c.id}-S${s+1}`, courseId: c.id, courseName: c.name,
              sectionNum: s+1, maxSize: size, enrollment: Math.min(enroll, size),
              department: c.department, roomType: c.roomType || "regular",
              isCore: false, teacher: null, room: null, period: null, lunchWave: null
          });
      }
  });

  const teacherLoad = {};
  teachers.forEach(t => teacherLoad[t.id] = 0);
  
  [...sections].sort(() => Math.random() - 0.5).forEach(sec => {
      const candidates = teachers.filter(t => (t.departments||[]).includes(sec.department));
      const pool = candidates.length > 0 ? candidates : teachers; 
      pool.sort((a,b) => (teacherLoad[a.id]||0) - (teacherLoad[b.id]||0));
      if(pool.length > 0) {
          const t = pool[0]; sec.teacher = t.id; sec.teacherName = t.name; teacherLoad[t.id]++;
          if(teacherHomeRoom[t.id]) { sec.room = teacherHomeRoom[t.id]; sec.roomName = rooms.find(r=>r.id===sec.room)?.name; }
      } else { sec.hasConflict = true; sec.conflictReason = "No Teacher"; }
  });

  constraints.forEach(c => {
      if(c.type === "lock_period" && c.sectionId) {
          const s = sections.find(x=>x.id === c.sectionId);
          if(s) { s.period = parseInt(c.period); s.locked = true; }
      }
  });

  sections.filter(s=>s.locked && s.period).forEach(s => {
      if(s.teacher) { if(!teacherSchedule[s.teacher]) teacherSchedule[s.teacher] = {}; teacherSchedule[s.teacher][s.period] = s.id; }
      if(s.room) { if(!roomSchedule[s.room]) roomSchedule[s.room] = {}; roomSchedule[s.room][s.period] = s.id; }
  });

  const secsInPeriod = {};
  teachingPeriodIds.forEach(id => secsInPeriod[id] = 0);
  const maxLoad = Math.max(1, effectiveSlots - planPeriodsPerDay);

  const placementOrder = [...sections].filter(s => !s.locked && !s.hasConflict).sort((a,b) => {
      if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
      return 0;
  });

  placementOrder.forEach(sec => {
      let bestP = null;
      let minCost = Infinity;
      const shuffled = [...teachingPeriodIds].sort(()=>Math.random()-0.5);

      for(const pid of shuffled) {
          let cost = 0;
          if(teacherSchedule[sec.teacher]?.[pid]) continue;
          if(teacherBlocked[sec.teacher]?.has(pid)) continue;

          const tLoad = Object.keys(teacherSchedule[sec.teacher]||{}).filter(k=>teacherSchedule[sec.teacher][k] !== "LUNCH").length;
          if(tLoad >= maxLoad) cost += 500;
          if(sec.room && roomSchedule[sec.room]?.[pid]) cost += 100;
          cost += (secsInPeriod[pid]||0) * 10;
          const sibs = sections.filter(s => s.courseId === sec.courseId && s.period === pid).length;
          if(!sec.isCore && sibs > 0) cost += 200;

          if(cost < minCost) { minCost = cost; bestP = pid; }
      }

      if(bestP) {
          sec.period = bestP;
          secsInPeriod[bestP]++;
          if(sec.teacher) { if(!teacherSchedule[sec.teacher]) teacherSchedule[sec.teacher]={}; teacherSchedule[sec.teacher][bestP] = sec.id; }
          let finalRoom = sec.room;
          if(!finalRoom || roomSchedule[finalRoom]?.[bestP]) { const open = rooms.find(r => r.type === sec.roomType && !roomSchedule[r.id]?.[bestP]); if(open) finalRoom = open.id; }
          if(finalRoom) { sec.room = finalRoom; sec.roomName = rooms.find(r=>r.id===finalRoom)?.name; if(!roomSchedule[finalRoom]) roomSchedule[finalRoom]={}; roomSchedule[finalRoom][bestP] = sec.id; }
      } else {
          sec.hasConflict = true; sec.conflictReason = "Scheduling Gridlock"; conflicts.push({ type: "unscheduled", message: `${sec.courseName} S${sec.sectionNum}: No valid period found`, sectionId: sec.id });
      }
  });

  if (isSplitLunch && lunchPid) {
      const lunchSections = sections.filter(s => s.period === lunchPid && !s.hasConflict);
      const depts = [...new Set(lunchSections.map(s => s.department))];
      const deptWaveMap = {};
      const waveCounts = Array(numWaves).fill(0);
      
      depts.sort((a,b) => {
          const countA = lunchSections.filter(s => s.department === a).length;
          const countB = lunchSections.filter(s => s.department === b).length;
          return countB - countA;
      });

      depts.forEach(dept => {
          const deptSecs = lunchSections.filter(s => s.department === dept);
          const studentCountInDept = deptSecs.reduce((sum, s) => sum + s.enrollment, 0);
          let bestWave = 0;
          let minVal = Infinity;
          for(let w=0; w<numWaves; w++) {
              if(waveCounts[w] < minVal) { minVal = waveCounts[w]; bestWave = w; }
          }
          deptWaveMap[dept] = bestWave + 1;
          waveCounts[bestWave] += studentCountInDept;
      });

      lunchSections.forEach(s => { s.lunchWave = deptWaveMap[s.department]; });
  }

  const periodStudentData = {};
  teachingPeriodIds.forEach(pid => {
      const pSecs = sections.filter(s => s.period === pid && !s.hasConflict);
      const seats = pSecs.reduce((sum, s) => sum + (s.enrollment||0), 0);
      let unaccounted = Math.max(0, studentCount - seats);
      if (!isSplitLunch && pid === lunchPid) { unaccounted = 0; }

      periodStudentData[pid] = {
          seatsInClass: seats,
          unaccounted: unaccounted,
          atLunch: (pid === lunchPid) ? (isSplitLunch ? "Waves" : studentCount) : 0,
          sectionCount: pSecs.length
      };

      if(unaccounted > 50 && !(pid === lunchPid && !isSplitLunch)) {
          conflicts.push({ type: "coverage", message: `Period ${pid}: ${unaccounted} students unaccounted for.` });
      }
  });

  teachers.forEach(t => {
      const teaching = Object.keys(teacherSchedule[t.id] || {}).filter(k => teacherSchedule[t.id][k] !== "LUNCH").length;
      const free = effectiveSlots - teaching;
      if (free < planPeriodsPerDay) { conflicts.push({ type: "plan_violation", message: `${t.name} has ${free} free periods (needs ${planPeriodsPerDay})`, teacherId: t.id }); }
  });

  return {
    sections, periodList, logs, conflicts,
    teacherSchedule, roomSchedule, teachers, rooms,
    periodStudentData,
    stats: { totalSections: sections.length, scheduledCount: sections.filter(s => s.period && !s.hasConflict).length, conflictCount: conflicts.length, teacherCount: teachers.length, roomCount: rooms.length, totalStudents: studentCount }
  };
}


// ==========================================
// 4. UI COMPONENTS
// ==========================================
const Logo = ({ size = 40 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <img src="https://gceducationanalytics.com/images/gceducationlogo.png" alt="GC Education Analytics" style={{ height: size, objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
  </div>
);

const Btn = ({ children, variant = "primary", onClick, disabled, style, small }) => {
  const v = {
    primary: { background: COLORS.primary, color: COLORS.white },
    secondary: { background: COLORS.lightGray, color: COLORS.text },
    accent: { background: COLORS.accent, color: COLORS.white },
    danger: { background: COLORS.danger, color: COLORS.white },
    success: { background: COLORS.success, color: COLORS.white },
    ghost: { background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.primary}` },
    warning: { background: COLORS.warning, color: COLORS.white },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "6px 14px" : "10px 22px", borderRadius: 8, border: "none",
      cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, fontSize: small ? 13 : 14,
      fontFamily: "'Segoe UI', system-ui, sans-serif", transition: "all 0.2s",
      opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 6,
      ...v[variant], ...style,
    }}>{children}</button>
  );
};

const Card = ({ children, style, onClick, selected }) => (
  <div onClick={onClick} style={{
    background: COLORS.white, borderRadius: 12, padding: 20, color: COLORS.text,
    border: selected ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.lightGray}`,
    boxShadow: selected ? `0 0 0 3px ${COLORS.accentLight}` : "0 1px 3px rgba(0,0,0,0.06)",
    cursor: onClick ? "pointer" : "default", transition: "all 0.2s", ...style,
  }}>{children}</div>
);

const NumInput = ({ label, value, onChange, min, max, helperText, style: sx }) => {
  const [lv, setLv] = useState(String(value ?? ""));
  useEffect(() => { setLv(String(value ?? "")); }, [value]);
  const hc = e => { const r = e.target.value; setLv(r); if (r === "" || r === "-") return; const n = parseInt(r, 10); if (!isNaN(n)) onChange(n); };
  const hb = () => { if (lv === "" || isNaN(parseInt(lv, 10))) { const f = min ?? 0; setLv(String(f)); onChange(f); } };
  return (
    <div style={{ marginBottom: 14, ...sx }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{label}</label>}
      <input type="number" value={lv} onChange={hc} onBlur={hb} min={min} max={max} style={INPUT_STYLE} />
      {helperText && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 3 }}>{helperText}</div>}
    </div>
  );
};

const TextInput = ({ label, value, onChange, placeholder, helperText, style: sx }) => (
  <div style={{ marginBottom: 14, ...sx }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{label}</label>}
    <input type="text" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={INPUT_STYLE} />
    {helperText && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 3 }}>{helperText}</div>}
  </div>
);

const TimeInput = ({ label, value, onChange }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{label}</label>}
    <input type="time" value={value || ""} onChange={e => onChange(e.target.value)} style={INPUT_STYLE} />
  </div>
);

const Sel = ({ label, value, onChange, options, helperText }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{label}</label>}
    <select value={value || ""} onChange={e => onChange(e.target.value)} style={SELECT_STYLE}>
      {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {helperText && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 3 }}>{helperText}</div>}
  </div>
);

const Toggle = ({ label, checked, onChange, description }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, cursor: "pointer" }} onClick={() => onChange(!checked)}>
    <div style={{ width: 40, height: 22, borderRadius: 11, flexShrink: 0, marginTop: 1, background: checked ? COLORS.primary : COLORS.lightGray, transition: "background 0.2s", position: "relative" }}>
      <div style={{ width: 18, height: 18, borderRadius: 9, background: COLORS.white, position: "absolute", top: 2, left: checked ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </div>
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{label}</div>
      {description && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{description}</div>}
    </div>
  </div>
);

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: COLORS.white, borderRadius: 16, padding: 28, maxWidth: 520, width: "90%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", color: COLORS.text }}>
        {title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: COLORS.primary }}>{title}</h3>
          <div onClick={onClose} style={{ cursor: "pointer", fontSize: 22, color: COLORS.midGray }}>✕</div>
        </div>}
        {children}
      </div>
    </div>
  );
};

const Tabs = ({ tabs, active, onChange }) => (
  <div style={{ display: "flex", gap: 2, borderBottom: `2px solid ${COLORS.lightGray}`, marginBottom: 18, overflowX: "auto" }}>
    {tabs.map(t => (
      <div key={t.id} onClick={() => onChange(t.id)} style={{
        padding: "10px 18px", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap",
        fontWeight: active === t.id ? 700 : 500, color: active === t.id ? COLORS.primary : COLORS.textLight,
        borderBottom: active === t.id ? `3px solid ${COLORS.primary}` : "3px solid transparent", marginBottom: -2,
      }}>{t.label}</div>
    ))}
  </div>
);



// ==========================================
// 5. WIZARD STEPS
// ==========================================
function SchoolTypeStep({ config: c, setConfig, onNext }) {
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

function ScheduleTypeStep({ config: c, setConfig, onNext, onBack }) {
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

function BellScheduleStep({ config: c, setConfig, onNext, onBack }) {
  const [mode, setMode] = useState(c.scheduleMode || "period_length");
  
  const [start, setStart] = useState(c.schoolStart || "08:00");
  const [end, setEnd] = useState(c.schoolEnd || "15:00");
  const [count, setCount] = useState(c.periodsCount || 7);
  const [len, setLen] = useState(c.periodLength || 50);
  const [pass, setPass] = useState(c.passingTime || 5);

  const calculateBaseTimeline = () => {
    const sMin = toMins(start);
    let calculatedPeriods = [];
    let calculatedLen = len;
    let calculatedEnd = end;

    if (mode === "time_frame") {
      const eMin = toMins(end);
      const totalTime = eMin - sMin;
      const totalPassing = Math.max(0, count - 1) * pass;
      const availableForClass = Math.max(0, totalTime - totalPassing);
      
      calculatedLen = Math.max(10, Math.floor(availableForClass / count));
      
      let cur = sMin;
      for (let i = 0; i < count; i++) {
        calculatedPeriods.push({
          id: i + 1, label: `Period ${i + 1}`,
          startMin: cur, endMin: cur + calculatedLen,
          startTime: toTime(cur), endTime: toTime(cur + calculatedLen),
          duration: calculatedLen
        });
        cur += calculatedLen + pass;
      }
    } else {
      let cur = sMin;
      for (let i = 0; i < count; i++) {
        calculatedPeriods.push({
          id: i + 1, label: `Period ${i + 1}`,
          startMin: cur, endMin: cur + len,
          startTime: toTime(cur), endTime: toTime(cur + len),
          duration: len
        });
        cur += len + pass;
      }
      calculatedEnd = toTime(cur - pass);
    }
    return { periods: calculatedPeriods, resultLen: calculatedLen, resultEnd: calculatedEnd };
  };

  const handleNext = () => {
    const calc = calculateBaseTimeline();
    
    setConfig({
      ...c,
      scheduleMode: mode,
      schoolStart: start,
      schoolEnd: mode === "time_frame" ? end : calc.resultEnd, 
      periodsCount: count,
      periodLength: mode === "time_frame" ? calc.resultLen : len,
      passingTime: pass,
      periods: calc.periods
    });
    onNext();
  };

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Bell Schedule Logic</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>
        Define your base teaching structure. Lunch and WIN blocks will be configured in the next steps.
      </p>

      <div style={{ display: "flex", gap: 16, marginBottom: 24, maxWidth: 600 }}>
        <Card 
          selected={mode === "time_frame"} 
          onClick={() => setMode("time_frame")}
          style={{ flex: 1, textAlign: "center", padding: 16 }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Fit to Timeframe</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>
            "I have from 8:00 to 3:00 for classes."
          </div>
        </Card>
        <Card 
          selected={mode === "period_length"} 
          onClick={() => setMode("period_length")}
          style={{ flex: 1, textAlign: "center", padding: 16 }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>📏</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Exact Length</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>
            "Periods must be exactly 50 mins."
          </div>
        </Card>
      </div>

      <div style={{ maxWidth: 500 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12, color: COLORS.primary }}>Configuration</h3>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <TimeInput label="Base Start Time" value={start} onChange={setStart} />
          {mode === "time_frame" && <TimeInput label="Base End Time" value={end} onChange={setEnd} />}
          {mode === "period_length" && <NumInput label="Period Duration (min)" value={len} onChange={setLen} min={10} max={120} />}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <NumInput label="Number of Periods" value={count} onChange={setCount} min={1} max={15} style={{ flex: 1 }} />
          <NumInput label="Passing Time (min)" value={pass} onChange={setPass} min={0} max={20} style={{ flex: 1 }} />
        </div>

        {mode === "time_frame" && (
          <div style={{ marginTop: 10, fontSize: 13, color: COLORS.textLight, fontStyle: "italic" }}>
            * Note: Period length will be auto-calculated based on these times.
          </div>
        )}
      </div>

      <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", maxWidth: 600 }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={handleNext}>Continue →</Btn>
      </div>
    </div>
  );
}

function LunchStep({ config: c, setConfig, onNext, onBack }) {
  const pc = c.periodsCount || 7;
  const periods = c.periods || [];
  
  const [style, setStyle] = useState(c.lunchConfig?.style || "unit");
  const [lunchPeriod, setLunchPeriod] = useState(c.lunchConfig?.lunchPeriod || 3);
  const [duration, setDuration] = useState(c.lunchConfig?.lunchDuration || 30);
  const [waves, setWaves] = useState(c.lunchConfig?.numWaves || 3);
  const [minClassTime, setMinClassTime] = useState(c.lunchConfig?.minClassTime || 45);

  const selectedPeriod = periods.find(p => p.id === lunchPeriod);
  
  const cafeteriaTime = style === "split" ? (duration * waves) : duration;
  const studentTime = style === "split" ? (minClassTime + duration) : duration;
  const requiredDuration = style === "split" ? Math.max(cafeteriaTime, studentTime) : duration;
  
  const currentDuration = selectedPeriod?.duration || 0;
  const isTooShort = selectedPeriod && currentDuration < requiredDuration;

  const autoAdjustTimeline = () => {
    const mode = c.scheduleMode || "period_length";
    const startMins = toMins(c.schoolStart || "08:00");
    const pass = c.passingTime || 5;
    
    let newPeriods = [];

    if (mode === "time_frame") {
      const endMins = toMins(c.schoolEnd || "15:00");
      const totalTime = endMins - startMins;
      const totalPassing = (pc - 1) * pass;
      
      const fixedTime = requiredDuration;
      const remainingTime = totalTime - fixedTime - totalPassing;
      
      if (remainingTime < (pc - 1) * 20) {
        alert("Cannot fit! The school day is too short to accommodate this lunch block.");
        return; 
      }

      const normalPeriodLen = Math.floor(remainingTime / (pc - 1));
      let cur = startMins;
      for (let i = 1; i <= pc; i++) {
        const dur = (i === lunchPeriod) ? requiredDuration : normalPeriodLen;
        newPeriods.push({
          id: i, label: `Period ${i}`,
          startMin: cur, endMin: cur + dur,
          startTime: toTime(cur), endTime: toTime(cur + dur),
          duration: dur,
          type: (i === lunchPeriod) ? (style === "split" ? "split_lunch" : "unit_lunch") : "class"
        });
        cur += dur + pass;
      }
    } else {
      let cur = startMins;
      for (let i = 1; i <= pc; i++) {
        const oldP = periods.find(p => p.id === i);
        const dur = (i === lunchPeriod) ? requiredDuration : (oldP?.duration || 50);
        newPeriods.push({
          id: i, label: `Period ${i}`,
          startMin: cur, endMin: cur + dur,
          startTime: toTime(cur), endTime: toTime(cur + dur),
          duration: dur,
          type: (i === lunchPeriod) ? (style === "split" ? "split_lunch" : "unit_lunch") : "class"
        });
        cur += dur + pass;
      }
    }

    setConfig({
      ...c,
      periods: newPeriods,
      lunchConfig: { style, lunchPeriod, lunchDuration: duration, numWaves: style === "split" ? waves : 1, minClassTime }
    });
    
    onNext();
  };

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Lunch Configuration</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>
        Configure how lunch fits into your bell schedule.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card selected={style === "unit"} onClick={() => setStyle("unit")}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🍎</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Unit Lunch</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>Whole school eats at same time.</div>
        </Card>
        <Card selected={style === "split"} onClick={() => setStyle("split")}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🌊</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Split Period (Waves)</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>Long period containing rotating waves. Includes "Class-Lunch-Class" splits.</div>
        </Card>
      </div>

      <div style={{ maxWidth: 550 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            {style === "unit" ? "Which period is Lunch?" : "Which period contains the waves?"}
          </label>
          <select value={lunchPeriod} onChange={e => setLunchPeriod(parseInt(e.target.value))} style={{ ...SELECT_STYLE }}>
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.label} ({p.startTime} - {p.endTime}, {p.duration}m)</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <NumInput label="Lunch Duration (min)" value={duration} onChange={setDuration} min={15} max={60} />
            {style === "split" && <NumInput label="Number of Waves" value={waves} onChange={setWaves} min={2} max={4} />}
        </div>

        {style === "split" && (
            <div style={{ marginTop: 8, padding: 12, background: COLORS.white, border: `1px solid ${COLORS.lightGray}`, borderRadius: 8 }}>
                <NumInput label="Min. Class Time per Student (min)" value={minClassTime} onChange={setMinClassTime} min={20} max={120} style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 11, color: COLORS.textLight }}>
                   Ensures students have enough learning time even with lunch. 
                   (e.g., If Lunch is 30m and you want 45m of class, period must be 75m+).
                </div>
            </div>
        )}
            
        <div style={{ marginTop: 20, padding: 16, borderRadius: 8, background: isTooShort ? "#FFF4E5" : "#F0F9FF", border: `1px solid ${isTooShort ? COLORS.warning : COLORS.secondary}`, fontSize: 13 }}>
            {isTooShort ? (
            <div>
                <div style={{ fontWeight: 700, color: COLORS.warning, marginBottom: 8 }}>⚠️ Timeline Adjustment Needed</div>
                <div style={{ marginBottom: 8, lineHeight: 1.5 }}>
                    Period {lunchPeriod} is currently <strong>{currentDuration} min</strong>.<br/>
                    To satisfy your constraints, it must be <strong>{requiredDuration} min</strong>.
                </div>
                <ul style={{ margin: "0 0 12px 16px", padding: 0, fontSize: 12, color: COLORS.text }}>
                    <li>Cafeteria needs: {waves} waves × {duration}m = <strong>{cafeteriaTime}m</strong></li>
                    <li>Students need: {minClassTime}m class + {duration}m lunch = <strong>{studentTime}m</strong></li>
                </ul>
                <Btn onClick={autoAdjustTimeline} variant="warning" style={{ width: "100%", justifyContent: "center" }}>
                    ⚡ Auto-Adjust & Continue
                </Btn>
            </div>
            ) : (
            <div style={{ color: COLORS.primaryDark }}>
                <strong>✅ Configuration Valid</strong><br/>
                Period {lunchPeriod} is {currentDuration}m. (Req: {requiredDuration}m).
            </div>
            )}
        </div>
      </div>

      <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        {!isTooShort && (
            <Btn onClick={() => {
                setConfig({ ...c, lunchConfig: { style, lunchPeriod, lunchDuration: duration, numWaves: style === "split" ? waves : 1, minClassTime } });
                onNext();
            }}>
                Continue →
            </Btn>
        )}
      </div>
    </div>
  );
}

function PlanPLCStep({ config: c, setConfig, onNext, onBack }) {
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Plan Periods & PLC</h2>
      <div style={{ maxWidth: 650 }}>
        <NumInput label="Plan periods per day per teacher" min={0} max={3} value={c.planPeriodsPerDay ?? 1} onChange={v => setConfig({ ...c, planPeriodsPerDay: v })} helperText="Most schools: 1" />
        <div style={{ marginTop: 20, borderTop: `1px solid ${COLORS.lightGray}`, paddingTop: 20 }}>
          <Toggle label="Include PLC time" checked={c.plcEnabled || false} onChange={v => setConfig({ ...c, plcEnabled: v })} description="Collaborative teacher team time" />
          {c.plcEnabled && <Sel label="PLC frequency" value={c.plcFrequency || "weekly"} onChange={v => setConfig({ ...c, plcFrequency: v })} options={[{value:"daily",label:"Daily"},{value:"weekly",label:"Weekly"}]} />}
        </div>
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext}>Continue →</Btn>
      </div>
    </div>
  );
}

function WINTimeStep({ config: c, setConfig, onNext, onBack }) {
  const pc = c.periodsCount || 7;
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>WIN Time (What I Need)</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>Intervention/enrichment block.</p>
      <div style={{ maxWidth: 600 }}>
        <Toggle label="Include WIN time" checked={c.winEnabled || false} onChange={v => setConfig({ ...c, winEnabled: v })} />
        {c.winEnabled && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <Card selected={c.winModel !== "separate"} onClick={() => setConfig({ ...c, winModel: "uses_period" })}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>📋 Uses a Period</div>
                <div style={{ fontSize: 11, color: COLORS.textLight }}>WIN replaces a teaching period.</div>
              </Card>
              <Card selected={c.winModel === "separate"} onClick={() => setConfig({ ...c, winModel: "separate" })}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>⏱️ Separate Block</div>
                <div style={{ fontSize: 11, color: COLORS.textLight }}>Own time block (e.g., 30 min).</div>
              </Card>
            </div>
            {c.winModel === "separate" ? (
              <div style={{ background: COLORS.offWhite, padding: 14, borderRadius: 8 }}>
                <NumInput label="WIN after which period?" min={1} max={pc} value={c.winAfterPeriod ?? 1} onChange={v => setConfig({ ...c, winAfterPeriod: v })} />
                <NumInput label="WIN duration (min)" min={15} max={60} value={c.winDuration ?? 30} onChange={v => setConfig({ ...c, winDuration: v })} />
              </div>
            ) : (
              <NumInput label="Which period is WIN?" min={1} max={pc} value={c.winPeriod ?? 2} onChange={v => setConfig({ ...c, winPeriod: v })} />
            )}
          </>
        )}
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext}>Continue →</Btn>
      </div>
    </div>
  );
}

function DataInputStep({ config: c, setConfig, onNext, onBack }) {
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>How to input data?</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600 }}>
        <Card selected={c.inputMode === "generic"} onClick={() => setConfig({ ...c, inputMode: "generic" })}>
          <div style={{ fontSize: 36, marginBottom: 10, textAlign: "center" }}>✏️</div>
          <div style={{ fontWeight: 700, fontSize: 15, textAlign: "center", marginBottom: 6 }}>Quick Setup</div>
          <div style={{ fontSize: 13, color: COLORS.textLight, textAlign: "center" }}>Enter departments, counts. Name teachers optionally.</div>
        </Card>
        <Card selected={c.inputMode === "csv"} onClick={() => setConfig({ ...c, inputMode: "csv" })}>
          <div style={{ fontSize: 36, marginBottom: 10, textAlign: "center" }}>📁</div>
          <div style={{ fontWeight: 700, fontSize: 15, textAlign: "center", marginBottom: 6 }}>CSV Upload</div>
          <div style={{ fontSize: 13, color: COLORS.textLight, textAlign: "center" }}>Upload teacher/course/room files.</div>
        </Card>
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext} disabled={!c.inputMode}>Continue →</Btn>
      </div>
    </div>
  );
}

function GenericInputStep({ config: c, setConfig, onNext, onBack }) {
  const [depts, setDepts] = useState(c.departments || [
    { id: "english", name: "English/ELA", teacherCount: 4, required: true, roomType: "regular", teacherNames: [] },
    { id: "math", name: "Math", teacherCount: 4, required: true, roomType: "regular", teacherNames: [] },
    { id: "science", name: "Science", teacherCount: 3, required: true, roomType: "lab", teacherNames: [] },
    { id: "social", name: "Social Studies", teacherCount: 3, required: true, roomType: "regular", teacherNames: [] },
    { id: "pe", name: "PE", teacherCount: 2, required: false, roomType: "gym", teacherNames: [] },
    { id: "elective", name: "Electives", teacherCount: 4, required: false, roomType: "regular", teacherNames: [] },
  ]);
  const [sc, setSc] = useState(c.studentCount ?? 800);
  const [rc, setRc] = useState(c.roomCount ?? 25);
  const [lc, setLc] = useState(c.labCount ?? 2);
  const [gc, setGc] = useState(c.gymCount ?? 1);
  const [ms, setMs] = useState(c.maxClassSize ?? 30);
  const [tl, setTl] = useState(c.targetLoad ?? 5);
  const [expanded, setExpanded] = useState(null);

  const upD = (i, f, v) => { const d = [...depts]; d[i] = { ...d[i], [f]: v }; setDepts(d); };

  const periodCount = c.periodsCount || 7;
  const planP = c.planPeriodsPerDay ?? 1;
  const lunchConsumes = c.lunchModel !== "separate" ? 1 : 0;
  const winConsumes = c.winEnabled && c.winModel !== "separate" ? 1 : 0;
  const maxTeachable = Math.max(1, periodCount - planP - lunchConsumes - winConsumes);
  const validLoad = Math.min(tl, maxTeachable);
  const totalTeachers = depts.reduce((s, d) => s + (d.teacherCount || 0), 0);
  const coreDepts = depts.filter(d => d.required);
  const electiveDepts = depts.filter(d => !d.required);

  const cont = () => {
    const teachers = [], courses = [], rooms = [];
    depts.forEach(dept => {
      const tc = dept.teacherCount || 1;
      const names = dept.teacherNames || [];
      for (let i = 0; i < tc; i++) {
        teachers.push({ id: `${dept.id}_t${i + 1}`, name: names[i] || `${dept.name} Teacher ${i + 1}`, departments: [dept.id], planPeriods: planP, isFloater: false });
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
          <NumInput label="Classes/Day per Teacher" min={1} max={10} value={tl} onChange={setTl} helperText={`Max: ${maxTeachable}`} />
        </div>
        <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, background: COLORS.accentLight, color: COLORS.darkGray }}>
          <strong>Student Day:</strong> {coreDepts.length} core classes + {Math.max(0, (c.lunchModel !== "separate" ? periodCount - 1 : periodCount) - coreDepts.length)} elective/PE per student.
          PE/electives absorb more students since each student only takes core once.
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
                <p style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>Name teachers (optional):</p>
                {Array.from({ length: d.teacherCount || 1 }, (_, ti) => (
                  <div key={ti} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: COLORS.textLight, width: 24 }}>{ti + 1}.</span>
                    <input value={(d.teacherNames || [])[ti] || ""} onChange={e => { const n = [...(d.teacherNames || [])]; n[ti] = e.target.value; upD(i, "teacherNames", n); }} placeholder={`${d.name} Teacher ${ti + 1}`} style={{ ...INPUT_STYLE, flex: 1, width: "auto" }} />
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

function CSVUploadStep({ config: c, setConfig, onNext, onBack }) {
  const [af, setAf] = useState("teachers");
  const [fn, setFn] = useState({});
  const [pd, setPd] = useState({});
  const [cm, setCm] = useState({});
  const fts = [
    { id: "teachers", label: "Teachers", fields: ["name","department","isFloater"] },
    { id: "courses", label: "Courses", fields: ["name","department","maxSize","sections","required"] },
    { id: "rooms", label: "Rooms", fields: ["name","type","capacity"] },
  ];
  const handleFile = (type, e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const lines = ev.target.result.split("\n").map(l => l.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
      if (lines.length > 1) {
        const h = lines[0]; const rows = lines.slice(1).filter(r => r.some(c => c));
        setPd(p => ({ ...p, [type]: { headers: h, rows } }));
        setFn(p => ({ ...p, [type]: f.name }));
        const ft = fts.find(x => x.id === type);
        const map = {};
        ft.fields.forEach(field => { const idx = h.findIndex(hh => hh.toLowerCase().includes(field.toLowerCase())); if (idx >= 0) map[field] = idx; });
        setCm(x => ({ ...x, [type]: map }));
      }
    }; r.readAsText(f);
  };
  const cont = () => {
    const teachers = [], courses = [], rooms = [];
    if (pd.teachers?.rows) pd.teachers.rows.forEach((r, i) => { const m = cm.teachers || {}; teachers.push({ id: `t_${i}`, name: m.name !== undefined ? r[m.name] : `Teacher ${i+1}`, departments: [m.department !== undefined ? r[m.department] : "general"], isFloater: false }); });
    if (pd.courses?.rows) pd.courses.rows.forEach((r, i) => { const m = cm.courses || {}; courses.push({ id: `c_${i}`, name: m.name !== undefined ? r[m.name] : `Course ${i+1}`, department: m.department !== undefined ? r[m.department] : "general", maxSize: m.maxSize !== undefined ? parseInt(r[m.maxSize]) || 30 : 30, sections: m.sections !== undefined ? parseInt(r[m.sections]) || 1 : 1, required: m.required !== undefined ? r[m.required]?.toLowerCase() === "yes" : true }); });
    if (pd.rooms?.rows) pd.rooms.rows.forEach((r, i) => { const m = cm.rooms || {}; rooms.push({ id: `r_${i}`, name: m.name !== undefined ? r[m.name] : `Room ${i+1}`, type: m.type !== undefined ? r[m.type] : "regular", capacity: m.capacity !== undefined ? parseInt(r[m.capacity]) || 30 : 30 }); });
    else { for (let i = 0; i < 20; i++) rooms.push({ id: `r_${i}`, name: `Room ${101+i}`, type: "regular", capacity: 30 }); rooms.push({ id: "lab_0", name: "Lab 1", type: "lab", capacity: 30 }); rooms.push({ id: "lab_1", name: "Lab 2", type: "lab", capacity: 30 }); }
    setConfig({ ...c, teachers, courses, rooms, students: { count: 300 } }); onNext();
  };
  const ft = fts.find(f => f.id === af);
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
                  <select value={cm[af]?.[field] ?? ""} onChange={e => setCm({ ...cm, [af]: { ...cm[af], [field]: e.target.value === "" ? undefined : parseInt(e.target.value) } })} style={{ ...SELECT_STYLE, width: "auto", padding: "4px 8px" }}>
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

function ConstraintsStep({ config: c, setConfig, onNext, onBack }) {
  const [cons, setCons] = useState(c.constraints || []);
  const [show, setShow] = useState(false);
  const [nc, setNc] = useState({ type: "teacher_unavailable", priority: "must" });
  const types = [{ value: "teacher_unavailable", label: "Teacher Unavailable (Period)" }, { value: "lock_period", label: "Lock Course to Period" }];
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Constraints</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>Optional hard rules.</p>
      <div style={{ maxWidth: 700 }}>
        {cons.length === 0 && !show && <div style={{ padding: 24, textAlign: "center", color: COLORS.textLight, background: COLORS.offWhite, borderRadius: 10 }}>No constraints (optional).</div>}
        {cons.map(con => (
          <div key={con.id} style={{ display: "flex", justifyContent: "space-between", padding: 12, background: COLORS.offWhite, borderRadius: 8, marginBottom: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: COLORS.text }}>
              <strong>{types.find(t => t.value === con.type)?.label}</strong>
              {con.teacherId && ` — ${con.teacherId}`}{con.period && ` — P${con.period}`}
            </div>
            <div onClick={() => setCons(cons.filter(x => x.id !== con.id))} style={{ cursor: "pointer", color: COLORS.danger }}>✕</div>
          </div>
        ))}
        {show ? (
          <Card style={{ marginTop: 12 }}>
            <Sel label="Type" value={nc.type} onChange={v => setNc({ ...nc, type: v })} options={types} />
            {nc.type === "teacher_unavailable" && <Sel label="Teacher" value={nc.teacherId || ""} onChange={v => setNc({ ...nc, teacherId: v })} options={[{ value: "", label: "Select..." }, ...(c.teachers || []).map(t => ({ value: t.id, label: t.name }))]} />}
            {nc.type === "lock_period" && <Sel label="Course" value={nc.courseId || ""} onChange={v => setNc({ ...nc, courseId: v })} options={[{ value: "", label: "Select..." }, ...(c.courses || []).map(x => ({ value: x.id, label: x.name }))]} />}
            <NumInput label="Period" min={1} max={c.periodsCount || 7} value={nc.period || 1} onChange={v => setNc({ ...nc, period: v })} />
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={() => { setCons([...cons, { ...nc, id: `con_${Date.now()}` }]); setShow(false); }} small>Add</Btn>
              <Btn variant="secondary" onClick={() => setShow(false)} small>Cancel</Btn>
            </div>
          </Card>
        ) : <Btn variant="ghost" onClick={() => setShow(true)} style={{ marginTop: 10 }}>+ Add Constraint</Btn>}
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={() => { setConfig({ ...c, constraints: cons }); onNext(); }}>⚡ Generate Schedule →</Btn>
      </div>
    </div>
  );
}


// ==========================================
// 6. SCHEDULE GRID VIEW (DETAILED)
// ==========================================
const SectionEditModal = ({ section, isOpen, onClose, onSave, onDelete }) => {
  const [enrollment, setEnrollment] = useState(section?.enrollment || 0);

  useEffect(() => {
    if (section) {
      setEnrollment(section.enrollment);
    }
  }, [section]);

  if (!isOpen || !section) return null;

  return (
    <Modal open={isOpen} onClose={onClose} title={`Edit ${section.courseName}`}>
      <div style={{ paddingBottom: 10 }}>
        <div style={{ marginBottom: 16, fontSize: 13, color: COLORS.textLight }}>
          {section.id} · Period {section.period}
        </div>
        
        <NumInput 
          label="Student Enrollment" 
          value={enrollment} 
          min={0} max={100} 
          onChange={setEnrollment} 
          helperText="Manually override class size"
        />

        <div style={{ marginTop: 20, padding: 16, background: COLORS.offWhite, borderRadius: 8 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 14, color: COLORS.danger }}>Danger Zone</h4>
          <p style={{ fontSize: 12, marginBottom: 12, color: COLORS.text }}>
            Dropping this class will free up the teacher and room for this period (e.g., to allow for co-teaching or an extra prep period).
          </p>
          <Btn variant="danger" small onClick={() => onDelete(section.id)}>
            🗑️ Drop/Remove Class
          </Btn>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => onSave(section.id, { enrollment })} variant="success">Save Changes</Btn>
        </div>
      </div>
    </Modal>
  );
};

function ScheduleGridView({ schedule, config, setSchedule, onRegenerate, onBackToConfig }) {
  const [vm, setVm] = useState("grid");
  const [dragItem, setDI] = useState(null);
  const [fDept, setFD] = useState("all");
  const [hist, setHist] = useState([]);
  const [hIdx, setHI] = useState(-1);
  const [notif, setNotif] = useState(null);
  const [showExport, setSE] = useState(false);
  const [editSection, setEditSection] = useState(null);

  const secs = schedule.sections || [];
  const allP = schedule.periodList || [];
  const teachP = allP.filter(p => p.type === "class" || p.type === "split_lunch");
  const confs = schedule.conflicts || [];
  const depts = [...new Set(secs.map(s => s.department))];
  const teachers = schedule.teachers || [];
  const rooms = schedule.rooms || [];
  const logs = schedule.logs || [];
  const psd = schedule.periodStudentData || {};
  const studentCount = schedule.stats?.totalStudents || 0;

  const notify = (m, t = "info") => { setNotif({ m, t }); setTimeout(() => setNotif(null), 3000); };
  const pushH = ns => { const h = hist.slice(0, hIdx + 1); h.push(JSON.parse(JSON.stringify(ns))); setHist(h); setHI(h.length - 1); };
  useEffect(() => { if (secs.length > 0 && hist.length === 0) pushH(secs); }, []);
  const undo = () => { if (hIdx > 0) { setSchedule({ ...schedule, sections: hist[hIdx - 1] }); setHI(hIdx - 1); notify("↩ Undone"); } };

  const onDS = s => { if (!s.locked) setDI(s); };
  const onDrop = tp => {
    if (!dragItem) return;
    const ns = secs.map(s => s.id === dragItem.id ? { ...s, period: tp, hasConflict: false, conflictReason: "" } : s);
    const tc = ns.find(s => s.id !== dragItem.id && s.period === tp && s.teacher === dragItem.teacher && s.teacher);
    if (tc) notify(`⚠️ Teacher ${dragItem.teacherName} double-booked P${tp}`, "warning");
    pushH(ns); setSchedule({ ...schedule, sections: ns }); setDI(null);
  };
  const togLock = id => { const ns = secs.map(s => s.id === id ? { ...s, locked: !s.locked } : s); setSchedule({ ...schedule, sections: ns }); };

  const handleSaveSection = (id, updates) => {
    const ns = schedule.sections.map(s => s.id === id ? { ...s, ...updates } : s);
    setSchedule({ ...schedule, sections: ns });
    setEditSection(null);
    notify("✅ Section updated");
  };

  const handleDeleteSection = (id) => {
    const ns = schedule.sections.filter(s => s.id !== id);
    setSchedule({ ...schedule, sections: ns });
    setEditSection(null);
    notify("🗑️ Section dropped from schedule");
  };

  const fSecs = secs.filter(s => fDept === "all" || s.department === fDept);

  const exportCSV = type => {
    let csv = "";
    if (type === "master") {
      csv = "Period,Time,Course,Section,Teacher,Room,Enrollment,MaxSize\n";
      secs.filter(s => s.period).sort((a, b) => {
        const pa = allP.findIndex(p => p.id === a.period);
        const pb = allP.findIndex(p => p.id === b.period);
        return pa - pb;
      }).forEach(s => {
        const p = allP.find(p => p.id === s.period);
        csv += `"${p?.label || s.period}","${p?.startTime || ""}-${p?.endTime || ""}","${s.courseName}",${s.sectionNum},"${s.teacherName || "TBD"}","${s.roomName || "TBD"}",${s.enrollment},${s.maxSize}\n`;
      });
    } else if (type === "teachers") {
      csv = "Teacher,Department,Period,Time,Course,Room\n";
      teachers.forEach(t => {
        allP.forEach(p => {
          const s = secs.find(x => x.teacher === t.id && x.period === p.id);
          const status = schedule.teacherSchedule?.[t.id]?.[p.id];
          csv += `"${t.name}","${(t.departments||[]).join("/")}","${p.label}","${p.startTime}-${p.endTime}","${s ? s.courseName : status === 'LUNCH' ? 'LUNCH' : 'Plan'}","${s?.roomName || ''}"\n`;
        });
      });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `schedule_${type}_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url); notify(`📥 ${type} exported`);
  };

  const SecCard = ({ section: s }) => {
    const bg = s.hasConflict ? "#FFF0F0" : s.locked ? COLORS.accentLight : COLORS.white;
    const bc = s.hasConflict ? COLORS.danger : s.locked ? COLORS.accent : COLORS.lightGray;
    
    const waveBadge = s.lunchWave ? (
      <span style={{ fontSize: 8, background: COLORS.warning, color: COLORS.text, padding: "1px 3px", borderRadius: 3, marginLeft: 4 }}>
        W{s.lunchWave}
      </span>
    ) : null;

    return (
      <div 
        onClick={(e) => { e.stopPropagation(); setEditSection(s); }}
        draggable={!s.locked} 
        onDragStart={() => onDS(s)} 
        style={{
          padding: "4px 6px", marginBottom: 2, borderRadius: 5, border: `1px solid ${bc}`,
          background: bg, cursor: "pointer", fontSize: 10,
          opacity: dragItem?.id === s.id ? 0.3 : 1, color: COLORS.text,
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>{s.courseName}</span>
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {waveBadge}
            {s.hasConflict && <span title={s.conflictReason} style={{ cursor: "help" }}>⚠️</span>}
            <span onClick={e => { e.stopPropagation(); togLock(s.id); }} style={{ cursor: "pointer", fontSize: 10 }}>{s.locked ? "🔒" : "🔓"}</span>
          </div>
        </div>
        <div style={{ color: COLORS.textLight, fontSize: 9, marginTop: 1 }}>
          {s.teacherName || "TBD"} · {s.roomName || "—"}
        </div>
        <div style={{ fontSize: 9, color: COLORS.primary, fontWeight: 600, marginTop: 1 }}>
          👥 {s.enrollment}/{s.maxSize}
        </div>
      </div>
    );
  };

  const PeriodHeader = ({ p, isLast }) => {
    const bgMap = { class: COLORS.primary, split_lunch: COLORS.secondary, unit_lunch: COLORS.warning, win: COLORS.darkGray };
    return (
      <div style={{
        padding: "6px 4px", textAlign: "center", fontWeight: 700, fontSize: 11, color: COLORS.white,
        borderRadius: isLast ? "0 8px 0 0" : 0, background: bgMap[p.type] || COLORS.primary,
        display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 54,
      }}>
        <div>{p.label}</div>
        <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.9, marginTop: 2 }}>{p.startTime} – {p.endTime}</div>
        {p.duration && <div style={{ fontSize: 8, opacity: 0.7 }}>{p.duration}min</div>}
        {p.type !== "class" && <div style={{ fontSize: 8, opacity: 0.8, textTransform: "uppercase", marginTop: 1, letterSpacing: 0.5 }}>{p.type.replace("_", " ")}</div>}
      </div>
    );
  };

  const StudentBar = ({ pid }) => {
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

  const viewTabs = [
    { id: "grid", label: "📋 Master Grid" },
    { id: "teachers", label: "👨‍🏫 Teachers" },
    { id: "rooms", label: "🏫 Rooms" },
    { id: "conflicts", label: `⚠️ Issues (${confs.length})` },
    { id: "stats", label: "📊 Stats" },
    { id: "logs", label: "🔍 Logs" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 55px)" }}>
      {notif && <div style={{ position: "fixed", top: 20, right: 20, zIndex: 2000, padding: "12px 20px", borderRadius: 10, background: notif.t === "warning" ? COLORS.warning : COLORS.primary, color: COLORS.white, fontSize: 14, fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>{notif.m}</div>}

      <div style={{ background: COLORS.white, padding: "8px 16px", borderBottom: `1px solid ${COLORS.lightGray}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Btn variant="secondary" small onClick={onBackToConfig}>← Config</Btn>
          <Btn variant="secondary" small onClick={undo} disabled={hIdx <= 0}>↩ Undo</Btn>
          <Btn variant="ghost" small onClick={onRegenerate}>🔀 Regenerate</Btn>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Btn variant="accent" small onClick={() => setSE(true)}>📥 Export</Btn>
        </div>
      </div>

      <div style={{ background: COLORS.offWhite, padding: "6px 16px", borderBottom: `1px solid ${COLORS.lightGray}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", gap: 3, overflowX: "auto" }}>
          {viewTabs.map(v => (
            <div key={v.id} onClick={() => setVm(v.id)} style={{
              padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
              background: vm === v.id ? COLORS.primary : "transparent",
              color: vm === v.id ? COLORS.white : COLORS.text, fontWeight: vm === v.id ? 600 : 400,
            }}>{v.label}</div>
          ))}
        </div>
        <select value={fDept} onChange={e => setFD(e.target.value)} style={{ ...SELECT_STYLE, width: "auto", padding: "4px 8px", fontSize: 12 }}>
          <option value="all">All Depts</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div style={{ flex: 1, padding: 16, overflow: "auto", background: COLORS.offWhite }}>
        {vm === "grid" && (
          <div>
            <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, color: COLORS.textLight, flexWrap: "wrap" }}>
              <span>📚 = students in class</span><span>🥗 = students at lunch</span><span>❓ = unaccounted</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 6, background: COLORS.success, borderRadius: 2, display: "inline-block" }} /> In class
                <span style={{ width: 12, height: 6, background: COLORS.warning, borderRadius: 2, display: "inline-block" }} /> Lunch
                <span style={{ width: 12, height: 6, background: COLORS.danger, borderRadius: 2, display: "inline-block" }} /> Missing
              </span>
              <span>Drag sections to reassign periods. Click a section to ✏️ Edit.</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: `130px repeat(${allP.length}, minmax(120px, 1fr))`, gap: 0, minWidth: 130 + allP.length * 120 }}>

                <div style={{ padding: 8, background: COLORS.primaryDark, color: COLORS.white, fontWeight: 700, fontSize: 12, borderRadius: "8px 0 0 0", display: "flex", alignItems: "center" }}>Course / Period</div>
                {allP.map((p, i) => <PeriodHeader key={p.id} p={p} isLast={i === allP.length - 1} />)}

                <div style={{ padding: "4px 8px", background: COLORS.offWhite, borderBottom: `2px solid ${COLORS.primary}`, borderRight: `1px solid ${COLORS.lightGray}`, fontSize: 10, fontWeight: 700, color: COLORS.primary, display: "flex", alignItems: "center" }}>
                  👥 {studentCount} Students
                </div>
                {allP.map(p => {
                  const isTeaching = p.type === "class" || p.type === "split_lunch";
                  if (!isTeaching) {
                    const isLunch = p.type === "unit_lunch";
                    return (
                      <div key={`sa-${p.id}`} style={{ padding: "3px 4px", borderBottom: `2px solid ${COLORS.primary}`, borderRight: `1px solid ${COLORS.lightGray}`, background: isLunch ? `${COLORS.warning}15` : COLORS.offWhite, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 9, color: isLunch ? COLORS.warning : COLORS.midGray, fontWeight: 600 }}>
                          {isLunch ? `🥗 All ${studentCount}` : `${p.type.toUpperCase()}`}
                        </span>
                      </div>
                    );
                  }
                  return <StudentBar key={`sa-${p.id}`} pid={p.id} />;
                })}

                {[...new Set(fSecs.map(s => s.courseId))].map((cid, ri) => {
                  const cs = fSecs.filter(s => s.courseId === cid);
                  const isCore = cs[0]?.isCore;
                  return (
                    <React.Fragment key={cid}>
                      <div style={{
                        padding: "6px 8px", background: PERIOD_COLORS[ri % PERIOD_COLORS.length],
                        borderBottom: `1px solid ${COLORS.lightGray}`, fontWeight: 600, fontSize: 11,
                        display: "flex", flexDirection: "column", justifyContent: "center", color: COLORS.text,
                      }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cs[0]?.courseName || cid}</div>
                        <div style={{ fontSize: 9, color: COLORS.textLight, marginTop: 2 }}>
                          {isCore ? "CORE" : "ELECT"} · {cs.length} sec · {cs.reduce((s, x) => s + x.enrollment, 0)} enrolled
                        </div>
                      </div>
                      {allP.map(p => {
                        const ps = cs.filter(s => s.period === p.id);
                        const isNT = p.type === "unit_lunch" || p.type === "win";
                        return (
                          <div key={`${cid}-${p.id}`}
                            onDragOver={e => !isNT && e.preventDefault()}
                            onDrop={() => !isNT && onDrop(p.id)}
                            style={{
                              padding: 3, minHeight: 44,
                              borderBottom: `1px solid ${COLORS.lightGray}`, borderRight: `1px solid ${COLORS.lightGray}`,
                              background: isNT ? "#F0F0F0" : dragItem ? `${COLORS.accentLight}30` : COLORS.white,
                              backgroundImage: isNT ? "repeating-linear-gradient(45deg, #e5e5e5 0, #e5e5e5 1px, transparent 0, transparent 50%)" : "none",
                              backgroundSize: "8px 8px",
                            }}>
                            {ps.map(s => <SecCard key={s.id} section={s} />)}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {vm === "teachers" && (
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: `160px repeat(${allP.length}, minmax(100px, 1fr))`, gap: 0, minWidth: 160 + allP.length * 100 }}>
              <div style={{ padding: 8, background: COLORS.primary, color: COLORS.white, fontWeight: 700, borderRadius: "8px 0 0 0", fontSize: 12 }}>Teacher</div>
              {allP.map((p, i) => <PeriodHeader key={p.id} p={p} isLast={i === allP.length - 1} />)}
              {teachers.filter(t => fDept === "all" || (t.departments || []).includes(fDept)).map(t => {
                return (
                  <React.Fragment key={t.id}>
                    <div style={{ padding: "6px 8px", background: COLORS.offWhite, borderBottom: `1px solid ${COLORS.lightGray}`, fontSize: 12, fontWeight: 600, color: COLORS.text, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div>{t.name}</div>
                      <div style={{ fontSize: 9, color: COLORS.textLight }}>{(t.departments || []).join(", ")}</div>
                    </div>
                    {allP.map(p => {
                      const s = secs.find(x => x.teacher === t.id && x.period === p.id);
                      const status = schedule.teacherSchedule?.[t.id]?.[p.id];
                      const isLunch = status === "LUNCH";
                      const isNT = p.type === "unit_lunch" || p.type === "win";
                      return (
                        <div key={`${t.id}-${p.id}`} style={{ padding: 4, borderBottom: `1px solid ${COLORS.lightGray}`, borderRight: `1px solid ${COLORS.lightGray}`, minHeight: 40, background: isNT ? "#F1F5F9" : isLunch ? `${COLORS.warning}12` : COLORS.white }}>
                          {s ? <div style={{ background: COLORS.accentLight, color: COLORS.primaryDark, padding: "3px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{s.courseName}<br /><span style={{ fontSize: 8, fontWeight: 400 }}>{s.roomName} · 👥{s.enrollment}</span></div>
                            : isLunch ? <div style={{ color: COLORS.warning, fontWeight: 700, fontSize: 10, textAlign: "center", marginTop: 6 }}>🥗 LUNCH</div>
                            : isNT ? <div style={{ color: COLORS.midGray, fontSize: 9, textAlign: "center", marginTop: 8 }}>{p.type.toUpperCase()}</div>
                            : <div style={{ color: COLORS.midGray, fontSize: 9, fontStyle: "italic", textAlign: "center", marginTop: 8 }}>📝 Plan</div>}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {vm === "rooms" && (
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${teachP.length}, minmax(100px, 1fr))`, gap: 0, minWidth: 120 + teachP.length * 100 }}>
              <div style={{ padding: 8, background: COLORS.primary, color: COLORS.white, fontWeight: 700, borderRadius: "8px 0 0 0", fontSize: 12 }}>Room</div>
              {teachP.map((p, i) => <PeriodHeader key={p.id} p={p} isLast={i === teachP.length - 1} />)}
              {rooms.map(r => (
                <React.Fragment key={r.id}>
                  <div style={{ padding: "6px 8px", background: COLORS.offWhite, borderBottom: `1px solid ${COLORS.lightGray}`, fontSize: 11, fontWeight: 600, color: COLORS.text }}>
                    {r.name} <span style={{ color: COLORS.midGray, fontSize: 9 }}>({r.type})</span>
                  </div>
                  {teachP.map(p => {
                    const s = secs.find(x => x.room === r.id && x.period === p.id);
                    return (
                      <div key={`${r.id}-${p.id}`} style={{ padding: 4, borderBottom: `1px solid ${COLORS.lightGray}`, borderRight: `1px solid ${COLORS.lightGray}`, minHeight: 40, background: s ? COLORS.white : "#FAFAFA" }}>
                        {s ? <div style={{ background: COLORS.purpleLight, color: COLORS.purple, padding: "3px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{s.courseName}<br /><span style={{ fontSize: 8, fontWeight: 400 }}>{s.teacherName} · 👥{s.enrollment}</span></div> : null}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {vm === "conflicts" && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: confs.length > 0 ? COLORS.dangerLight : "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{confs.length > 0 ? "⚠️" : "✅"}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: confs.length > 0 ? COLORS.danger : COLORS.success }}>{confs.length} Issue{confs.length !== 1 ? "s" : ""}</div>
                  <div style={{ fontSize: 13, color: COLORS.textLight }}>{confs.length > 0 ? "Review and resolve" : "Conflict-free schedule!"}</div>
                </div>
              </div>
            </Card>
            {["unscheduled", "coverage", "plan_violation"].map(type => {
              const group = confs.filter(c => c.type === type);
              if (group.length === 0) return null;
              const labels = { unscheduled: "📌 Scheduling Conflicts", coverage: "👥 Student Coverage Gaps", plan_violation: "📝 Plan Period Violations" };
              const colors = { unscheduled: COLORS.danger, coverage: COLORS.warning, plan_violation: COLORS.gold };
              return (
                <div key={type} style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, color: colors[type], marginBottom: 8 }}>{labels[type]} ({group.length})</h3>
                  {group.map((con, i) => (
                    <Card key={i} style={{ marginBottom: 6, padding: 12, borderLeft: `4px solid ${colors[type]}` }}>
                      <div style={{ fontSize: 13, color: COLORS.text }}>{con.message}</div>
                    </Card>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {vm === "stats" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
            {[
              { l: "Total Sections", v: schedule.stats?.totalSections || 0, i: "📚", c: COLORS.primary },
              { l: "Scheduled OK", v: schedule.stats?.scheduledCount || 0, i: "✅", c: COLORS.success },
              { l: "Conflicts", v: schedule.stats?.conflictCount || 0, i: "⚠️", c: COLORS.danger },
              { l: "Room Util", v: `${schedule.stats?.roomUtilization || 0}%`, i: "🏫", c: COLORS.accent },
              { l: "Teachers", v: schedule.stats?.teacherCount || 0, i: "👨‍🏫", c: COLORS.secondary },
              { l: "Students", v: schedule.stats?.totalStudents || 0, i: "🎓", c: COLORS.gold },
            ].map(s => (
              <Card key={s.l}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.c}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.i}</div>
                  <div><div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div><div style={{ fontSize: 11, color: COLORS.textLight }}>{s.l}</div></div>
                </div>
              </Card>
            ))}
            <Card style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ fontSize: 15, color: COLORS.primary, marginBottom: 10 }}>📊 Period-by-Period Student Accounting</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: COLORS.offWhite }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `2px solid ${COLORS.lightGray}`, color: COLORS.text }}>Period</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `2px solid ${COLORS.lightGray}`, color: COLORS.text }}>Time</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: `2px solid ${COLORS.lightGray}`, color: COLORS.text }}>Sections</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: `2px solid ${COLORS.lightGray}`, color: COLORS.text }}>In Class</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: `2px solid ${COLORS.lightGray}`, color: COLORS.text }}>Unaccounted</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: `2px solid ${COLORS.lightGray}`, color: COLORS.text }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teachP.map(p => {
                    const d = psd[p.id];
                    if (!d) return null;
                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.lightGray}` }}>
                        <td style={{ padding: "6px 10px", fontWeight: 600, color: COLORS.text }}>{p.label}</td>
                        <td style={{ padding: "6px 10px", color: COLORS.textLight }}>{p.startTime}–{p.endTime}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", color: COLORS.text }}>{d.sectionCount}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", color: COLORS.success, fontWeight: 600 }}>{d.seatsInClass}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", color: d.unaccounted > 0 ? COLORS.danger : COLORS.success, fontWeight: 700 }}>{d.unaccounted}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>{d.unaccounted > 50 ? "⚠️" : d.unaccounted > 0 ? "⚡" : "✅"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {vm === "logs" && (
          <div style={{ background: COLORS.consoleBg, color: COLORS.consoleText, padding: 20, borderRadius: 8, minHeight: 400, overflowY: "auto", fontFamily: "monospace", fontSize: 11 }}>
            <h3 style={{ color: COLORS.white, marginTop: 0, marginBottom: 12 }}>System Logs ({logs.length})</h3>
            {logs.map((l, i) => (
              <div key={i} style={{ marginBottom: 4, borderLeft: `3px solid ${l.type === "error" ? COLORS.danger : l.type === "warning" ? COLORS.warning : COLORS.success}`, paddingLeft: 10, opacity: l.type === "info" ? 0.8 : 1 }}>
                <strong style={{ color: l.type === "error" ? "#FF6B6B" : l.type === "warning" ? "#FFD93D" : "#6BCB77" }}>{l.type.toUpperCase()}:</strong>
                <span style={{ marginLeft: 8 }}>{l.msg}</span>
                {l.data && <div style={{ marginLeft: 40, marginTop: 2, background: "#00000040", padding: 5, borderRadius: 4, fontSize: 9, whiteSpace: "pre-wrap" }}>{JSON.stringify(l.data, null, 2)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showExport} onClose={() => setSE(false)} title="Export Schedule">
        <div style={{ display: "grid", gap: 10 }}>
          <Btn onClick={() => { exportCSV("master"); setSE(false); }} style={{ width: "100%" }}>📋 Master Schedule (CSV)</Btn>
          <Btn onClick={() => { exportCSV("teachers"); setSE(false); }} style={{ width: "100%" }}>👨‍🏫 Teacher Schedules (CSV)</Btn>
        </div>
      </Modal>

      <SectionEditModal 
        isOpen={!!editSection} 
        section={editSection} 
        onClose={() => setEditSection(null)}
        onSave={handleSaveSection}
        onDelete={handleDeleteSection}
      />
    </div>
  );
}


// ==========================================
// 7. ROOT APP
// ==========================================
function buildScheduleConfig(config) {
  const pc = config.periodsCount || 7;
  
  const periodsConfig = (Array.isArray(config.periods) && config.periods.length > 0)
    ? config.periods 
    : []; 

  return {
    ...config,
    periods: periodsConfig,
    schoolStart: config.schoolStart || "08:00",
    periodLength: config.periodLength || 50,
    passingTime: config.passingTime || 5,
    lunchConfig: {
      style: config.lunchStyle || "period",
      lunchPeriod: config.lunchPeriod ?? Math.ceil(pc / 2),
      lunchModel: config.lunchModel || "uses_period",
      lunchAfterPeriod: config.lunchAfterPeriod,
      lunchDuration: config.lunchDuration || 30,
      waves: config.lunchWaves || [],
      numWaves: config.numLunchWaves || 1,
      minClassTime: config.minClassTime || 45
    },
    winConfig: {
      enabled: config.winEnabled || false,
      period: config.winPeriod,
      model: config.winModel || "uses_period",
      afterPeriod: config.winAfterPeriod,
      winDuration: config.winDuration || 30,
    },
    teachers: config.teachers || [],
    courses: config.courses || [],
    rooms: config.rooms || [],
    constraints: config.constraints || [],
    studentCount: config.studentCount || 800,
    maxClassSize: config.maxClassSize || 30,
    planPeriodsPerDay: config.planPeriodsPerDay ?? 1,
  };
}

export default function App() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({});
  const [schedule, setSchedule] = useState(null);

  const steps = ["School Type", "Schedule Type", "Bell Schedule", "Lunch", "Plan & PLC", "WIN Time", "Data Input", config.inputMode === "csv" ? "CSV Upload" : "Quick Setup", "Constraints"];

  const gen = () => {
    const result = generateSchedule(buildScheduleConfig(config));
    setSchedule(result);
    setStep(99);
  };

  // FIXED: Regenerate actually reshuffles unlocked sections
  const regen = () => {
    if (!schedule) return;
    // Keep locked sections as constraints
    const locked = schedule.sections.filter(s => s.locked);
    const lockConstraints = locked.map(s => ({ type: "lock_period", sectionId: s.id, period: s.period, priority: "must" }));
    const result = generateSchedule({
      ...buildScheduleConfig(config),
      constraints: [...(config.constraints || []), ...lockConstraints],
    });
    setSchedule(result);
  };

  const rootStyle = { minHeight: "100vh", background: COLORS.offWhite, fontFamily: "'Segoe UI', system-ui, sans-serif", colorScheme: "light", color: COLORS.text };

  if (step === 99 && schedule) {
    return (
      <div style={rootStyle}>
        <div style={{ background: COLORS.white, padding: "10px 20px", borderBottom: `1px solid ${COLORS.lightGray}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Logo size={30} />
            <div style={{ fontSize: 13, color: COLORS.textLight }}>
              {config.schoolType} · {config.scheduleType?.replace(/_/g, " ")} · {config.periodsCount || 7} periods
            </div>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textLight }}>
            {schedule.stats?.scheduledCount}/{schedule.stats?.totalSections} scheduled · {schedule.stats?.conflictCount} conflicts
          </div>
        </div>
        <ScheduleGridView
          schedule={schedule}
          config={config}
          setSchedule={setSchedule}
          onRegenerate={regen}
          onBackToConfig={() => setStep(9)}
        />
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <div style={{ background: COLORS.white, padding: "14px 24px", borderBottom: `1px solid ${COLORS.lightGray}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Logo size={36} />
      </div>
      {step > 0 && (
        <div style={{ background: COLORS.white, padding: "10px 24px", borderBottom: `1px solid ${COLORS.lightGray}`, overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {steps.map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                <div onClick={() => i + 1 <= step && setStep(i + 1)} style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 12, whiteSpace: "nowrap",
                  cursor: i + 1 <= step ? "pointer" : "default",
                  background: i + 1 === step ? COLORS.primary : i + 1 < step ? COLORS.accentLight : COLORS.lightGray,
                  color: i + 1 === step ? COLORS.white : i + 1 < step ? COLORS.primary : COLORS.midGray,
                  fontWeight: i + 1 === step ? 700 : 500,
                }}>{label}</div>
                {i < steps.length - 1 && <div style={{ width: 12, height: 2, background: i + 1 < step ? COLORS.accent : COLORS.lightGray, margin: "0 2px" }} />}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "30px 24px" }}>
        {step === 0 && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}><Logo size={80} /></div>
            <h1 style={{ fontSize: 28, color: COLORS.primary, marginBottom: 8 }}>K-12 Master Scheduler</h1>
            <p style={{ fontSize: 15, color: COLORS.textLight, maxWidth: 480, margin: "0 auto 30px", lineHeight: 1.6 }}>Build your master schedule in minutes. Configure, generate, and fine-tune.</p>
            <Btn onClick={() => setStep(1)} style={{ padding: "14px 32px", fontSize: 16 }}>🚀 Start New Project</Btn>
            <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16, textAlign: "left" }}>
              {[
                { i: "🏫", t: "All School Types", d: "K-5 through 12" },
                { i: "⚡", t: "Smart Algorithm", d: "Home rooms, student accounting, capacity validation" },
                { i: "🔒", t: "FERPA Safe", d: "100% in-browser. Zero server storage." },
                { i: "📊", t: "Detailed Analytics", d: "Period-by-period student coverage tracking" },
              ].map(f => <Card key={f.t}><div style={{ fontSize: 28, marginBottom: 8 }}>{f.i}</div><div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{f.t}</div><div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.4 }}>{f.d}</div></Card>)}
            </div>
          </div>
        )}
        {step === 1 && <SchoolTypeStep config={config} setConfig={setConfig} onNext={() => setStep(2)} />}
        {step === 2 && <ScheduleTypeStep config={config} setConfig={setConfig} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <BellScheduleStep config={config} setConfig={setConfig} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <LunchStep config={config} setConfig={setConfig} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
        {step === 5 && <PlanPLCStep config={config} setConfig={setConfig} onNext={() => setStep(6)} onBack={() => setStep(4)} />}
        {step === 6 && <WINTimeStep config={config} setConfig={setConfig} onNext={() => setStep(7)} onBack={() => setStep(5)} />}
        {step === 7 && <DataInputStep config={config} setConfig={setConfig} onNext={() => setStep(8)} onBack={() => setStep(6)} />}
        {step === 8 && config.inputMode === "csv" && <CSVUploadStep config={config} setConfig={setConfig} onNext={() => setStep(9)} onBack={() => setStep(7)} />}
        {step === 8 && config.inputMode !== "csv" && <GenericInputStep config={config} setConfig={setConfig} onNext={() => setStep(9)} onBack={() => setStep(7)} />}
        {step === 9 && <ConstraintsStep config={config} setConfig={setConfig} onNext={gen} onBack={() => setStep(8)} />}
      </div>
    </div>
  );
}
