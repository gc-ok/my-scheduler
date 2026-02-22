// src/core/engine.ts
import { ScheduleConfig, Section, Period } from '../types';
import { ResourceTracker } from './ResourceTracker';
import { StandardStrategy, ABStrategy, Block4x4Strategy, TrimesterStrategy } from './strategies/ScheduleStrategies';

// --- Time Utilities ---
const toMins = (t?: string): number => { 
  if (!t) return 480; 
  const [h, m] = t.split(":").map(Number); 
  return h * 60 + m; 
};

const toTime = (mins: number): string => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
};

// --- Structured Logger ---
class StructuredLogger {
  logs: { timestamp: number; level: string; msg: string; data: any }[];
  placementHistory: any[];

  constructor() {
    this.logs = [];
    this.placementHistory = [];
  }

  info(msg: string, data: any = null) {
    this.logs.push({ timestamp: Date.now(), level: "INFO", msg, data });
  }

  warn(msg: string, data: any = null) {
    this.logs.push({ timestamp: Date.now(), level: "WARN", msg, data });
  }

  error(msg: string, data: any = null) {
    this.logs.push({ timestamp: Date.now(), level: "ERROR", msg, data });
  }

  logPlacement(section: Section, period: string | number, finalCost: number, evaluations: any[]) {
    this.placementHistory.push({
      sectionId: section.id,
      course: section.courseName,
      assignedPeriod: period,
      costScore: finalCost,
      evaluations: evaluations,
      status: "SUCCESS"
    });
  }

  logFailure(section: Section, evaluations: any[]) {
    this.placementHistory.push({
      sectionId: section.id,
      course: section.courseName,
      evaluations: evaluations,
      status: "FAILED"
    });
    this.error(`Gridlock: Failed to place ${section.courseName} S${section.sectionNum}`);
  }
}

// --- Main Scheduling Engine ---
export function generateSchedule(config: ScheduleConfig) {
  const {
    teachers = [], courses = [], rooms = [], constraints = [],
    lunchConfig = {}, winConfig = {}, plcEnabled = false,
    recessConfig = {}, // NEW: Destructure recess config
    studentCount = 800, maxClassSize = 30, planPeriodsPerDay,
    schoolStart = "08:00", schoolEnd = "15:00",
    passingTime = 5, scheduleMode = "period_length",
    periods = [],
  } = config;

  const logger = new StructuredLogger();
  const conflicts: any[] = [];

  logger.info("🚀 Starting Robust Schedule Generation...", { mode: scheduleMode });

  // 1. Setup Periods
  let finalPeriodLength = config.periodLength || 50;
  let periodList: Period[] = [];

  if (periods && periods.length > 0) {
    periodList = periods.map(p => ({ ...p, type: p.type || "class" } as Period));
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

  // --- INJECT "SEPARATE BLOCK" WIN TIME ---
  if (winConfig.enabled && winConfig.model === "separate") {
    const insertAfterId = Number(winConfig.afterPeriod);
    const insertIndex = periodList.findIndex(p => p.id === insertAfterId);

    if (insertIndex !== -1) {
      const winDur = Number(winConfig.winDuration) || 30;
      const prevPeriod = periodList[insertIndex];
      const winStartMin = prevPeriod.endMin + passingTime;
      const winEndMin = winStartMin + winDur;

      const customWinPeriod: Period = {
        id: "WIN", label: "WIN", type: "win",
        startMin: winStartMin, endMin: winEndMin,
        startTime: toTime(winStartMin), endTime: toTime(winEndMin),
        duration: winDur
      };

      let currentMin = winEndMin + passingTime;
      for (let i = insertIndex + 1; i < periodList.length; i++) {
        const p = periodList[i];
        p.startMin = currentMin; p.endMin = currentMin + p.duration;
        p.startTime = toTime(currentMin); p.endTime = toTime(currentMin + p.duration);
        currentMin += p.duration + passingTime;
      }
      periodList.splice(insertIndex + 1, 0, customWinPeriod);
    }
  }

  // --- INJECT "RECESS" (Elementary/Middle Support) ---
  if (recessConfig.enabled) {
    const insertAfterId = Number(recessConfig.afterPeriod);
    const insertIndex = periodList.findIndex(p => p.id === insertAfterId);

    if (insertIndex !== -1) {
      const recessDur = Number(recessConfig.duration) || 20;
      const prevPeriod = periodList[insertIndex];
      const recessStartMin = prevPeriod.endMin + passingTime;
      const recessEndMin = recessStartMin + recessDur;

      const recessPeriod: Period = {
        id: "RECESS", label: "Recess", type: "recess",
        startMin: recessStartMin, endMin: recessEndMin,
        startTime: toTime(recessStartMin), endTime: toTime(recessEndMin),
        duration: recessDur
      };

      let currentMin = recessEndMin + passingTime;
      for (let i = insertIndex + 1; i < periodList.length; i++) {
        const p = periodList[i];
        p.startMin = currentMin; p.endMin = currentMin + p.duration;
        p.startTime = toTime(currentMin); p.endTime = toTime(currentMin + p.duration);
        currentMin += p.duration + passingTime;
      }
      periodList.splice(insertIndex + 1, 0, recessPeriod);
    }
  }

  const lunchStyle = lunchConfig.style || "unit";
  const lunchPid = lunchConfig.lunchPeriod; 
  const multiLunchPids = lunchConfig.lunchPeriods || []; 
  const isSplitLunch = lunchStyle === "split";
  const isMultiPeriod = lunchStyle === "multi_period";
  
  const lunchDuration = lunchConfig.lunchDuration || 30;
  const numWaves = lunchConfig.numWaves || 3;
  const minClassTime = lunchConfig.minClassTime || 30;
  const winPid = winConfig.enabled ? (winConfig.model === "separate" ? "WIN" : winConfig.winPeriod) : null;
  const recessPid = recessConfig.enabled ? "RECESS" : null;

  periodList = periodList.map(p => {
    let type = p.type || "class";
    if (lunchStyle === "split" && p.id === lunchPid) {
      type = "split_lunch";
      const cafeteriaReq = lunchDuration * numWaves;
      const pedagogicalReq = minClassTime + lunchDuration;
      const required = Math.max(cafeteriaReq, pedagogicalReq);
      if (p.duration < (required - 2)) conflicts.push({ type: "coverage", message: `CRITICAL: Period ${p.id} is ${p.duration}m. Needs ${required}m to satisfy cafeteria & learning constraints.` });
    } else if (lunchStyle === "unit" && p.id === lunchPid) {
      type = "unit_lunch";
    } else if (isMultiPeriod && multiLunchPids.includes(p.id as number | string)) {
      type = "multi_lunch";
    } else if (p.id === winPid) {
      type = "win";
    } else if (p.id === recessPid || p.type === "recess") {
      type = "recess";
    }
    return { ...p, type };
  });

  const teachingPeriods = periodList;
  const teachingPeriodIds = teachingPeriods.map(p => p.id);
  const numTeachingPeriods = teachingPeriodIds.length;

  const safePlanPeriods = Number(planPeriodsPerDay) || 1;
  
  // UPDATE: Subtract Recess from effective slots so teachers aren't expected to teach during it
  const recessCount = periodList.filter(p => p.type === "recess").length;
  const effectiveSlots = (isSplitLunch ? numTeachingPeriods : numTeachingPeriods - 1) - recessCount; 
  
  let dailyMaxLoad = Math.max(1, effectiveSlots - safePlanPeriods - (plcEnabled ? 1 : 0));
  let maxLoad = config.scheduleType === "ab_block" ? (dailyMaxLoad * 2) : dailyMaxLoad;
  
  logger.info(`Calculated Max Load: ${maxLoad}`, { effectiveSlots, safePlanPeriods, plcEnabled });

  const tracker = new ResourceTracker(teachers, rooms, maxLoad);

  const regularRooms = rooms.filter(r => r.type === "regular");
  const labRooms = rooms.filter(r => r.type === "lab");
  const gymRooms = rooms.filter(r => r.type === "gym");
  let rIdx = 0, lIdx = 0;

  const sortedTeachers = [...teachers].sort((a, b) => {
    const aSci = (a.departments || []).some(d => d.includes("science")) ? 1 : 0;
    const bSci = (b.departments || []).some(d => d.includes("science")) ? 1 : 0;
    return bSci - aSci;
  });

  sortedTeachers.forEach(t => {
    if (t.isFloater) return; 

    const isLab = (t.departments || []).some(d => d.includes("science"));
    const isGym = (t.departments || []).some(d => d.toLowerCase().includes("pe"));
    
    let assignedRoom: string | null = null;
    if (isLab && labRooms.length > 0) { assignedRoom = labRooms[lIdx % labRooms.length].id; lIdx++; } 
    else if (isGym && gymRooms.length > 0) { assignedRoom = gymRooms[0].id; } 
    else if (regularRooms.length > 0) { if (rIdx < regularRooms.length) { assignedRoom = regularRooms[rIdx].id; rIdx++; } }

    if (assignedRoom) {
      tracker.setRoomOwner(assignedRoom, t.id);
    }
  });

  const toUniv = (pid: string | number) => `FY-ALL-${pid}`;

  if (lunchStyle === "unit" && lunchPid) {
    teachers.forEach(t => tracker.blockTeacher(t.id, toUniv(lunchPid), "LUNCH"));
  } else if (isMultiPeriod && multiLunchPids.length > 0) {
    const depts = [...new Set(teachers.map(t => (t.departments && t.departments[0]) || "General"))];
    depts.forEach(dept => {
      const deptTeachers = teachers.filter(t => (t.departments && t.departments[0]) === dept);
      deptTeachers.forEach((t, i) => {
        const assignedLunchPid = multiLunchPids[i % multiLunchPids.length];
        tracker.blockTeacher(t.id, toUniv(assignedLunchPid), "LUNCH");
      });
    });
    logger.info(`Distributed teachers across multiple lunch periods: ${multiLunchPids.join(", ")}`);
  }

  let finalPlcGroups: any[] = []; 

  if (plcEnabled) {
    const hasValidCustomGroups = Array.isArray(config.plcGroups) && 
                                 config.plcGroups.length > 0 && 
                                 config.plcGroups.some(g => g.teacherIds && g.teacherIds.length > 0);

    if (hasValidCustomGroups) {
      logger.info("Applying user-defined PLC blocks...");
      finalPlcGroups = config.plcGroups || [];
      
      finalPlcGroups.forEach(group => {
        (group.teacherIds || []).forEach((tid: string) => {
          tracker.blockTeacher(tid, toUniv(group.period), "PLC");
        });
      });
    } else {
      logger.info("Setting up Departmental PLC blocks...");
      const depts = [...new Set(teachers.map(t => (t.departments && t.departments[0]) || "General"))];
      const validPlcPeriods = periodList.filter(p => p.type === "class" || p.type === "split_lunch").map(p => p.id);

      depts.forEach((dept, index) => {
        if (validPlcPeriods.length === 0) return; 
        
        const plcPid = validPlcPeriods[index % validPlcPeriods.length];
        const deptTeachers = teachers.filter(t => (t.departments && t.departments[0]) === dept);
        
        const newGroup = {
          id: `plc-${dept}-${Date.now()}-${index}`,
          name: `${dept} PLC`,
          period: plcPid,
          teacherIds: deptTeachers.map(t => t.id)
        };
        finalPlcGroups.push(newGroup);

        deptTeachers.forEach(t => {
          tracker.blockTeacher(t.id, toUniv(plcPid), "PLC");
        });
        logger.info(`Assigned Period ${plcPid} as Common PLC for ${dept} Department (${deptTeachers.length} teachers).`);
      });
    }
  }

  if (config.teacherAvailability && config.teacherAvailability.length > 0) {
    config.teacherAvailability.forEach(avail => {
      avail.blockedPeriods.forEach((pid: string | number) => {
        tracker.blockTeacher(avail.teacherId, toUniv(pid), "BLOCKED");
      });
    });
    logger.info(`Applied custom availability blocks for ${config.teacherAvailability.length} teachers.`);
  }

  constraints.forEach(c => {
    if (c.type === "teacher_unavailable") {
      if (c.teacherId) tracker.blockTeacher(c.teacherId, toUniv(Number(c.period)), "BLOCKED");
    }
  });

  const sections: Section[] = [];
  const coreCourses = courses.filter(c => c.required);
  const electiveCourses = courses.filter(c => !c.required);
  const coreCount = coreCourses.length;
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
        isCore: true, teacher: null, room: null, period: null,
        isSingleton: num === 1
      });
    }
  });

  const totalElectiveDemand = studentCount * electiveSlotsPerStudent;
  
  // 1. Pre-calculate total sections to ensure accurate enrollment distribution
  // This prevents the "phantom student" bug where Math.ceil() over-allocates
  let grandTotalSections = 0;
  const courseSectionCounts = new Map<string, number>();

  electiveCourses.forEach(c => {
    let num = c.sections;
    const isPE = c.department.toLowerCase().includes("pe");
    const size = isPE ? 50 : (c.maxSize || maxClassSize);
    
    if (!num) {
      const share = 1 / (electiveCourses.length || 1);
      num = Math.max(1, Math.ceil((totalElectiveDemand * share) / size));
    }
    courseSectionCounts.set(c.id, num);
    grandTotalSections += num;
  });

  // 2. Calculate base seats and remainder
  const safeTotalSections = grandTotalSections || 1;
  const baseEnrollment = Math.floor(totalElectiveDemand / safeTotalSections);
  let remainingSeats = totalElectiveDemand % safeTotalSections;

  electiveCourses.forEach(c => {
    const num = courseSectionCounts.get(c.id) || 1;
    const isPE = c.department.toLowerCase().includes("pe");
    const size = isPE ? 50 : (c.maxSize || maxClassSize);
    
    for(let s=0; s<num; s++) {
      // 3. Distribute remainder seats one by one until gone
      let currentEnrollment = baseEnrollment;
      if (remainingSeats > 0) {
        currentEnrollment += 1;
        remainingSeats -= 1;
      }

      sections.push({
        id: `${c.id}-S${s+1}`, courseId: c.id, courseName: c.name,
        sectionNum: s+1, maxSize: size, 
        enrollment: Math.min(currentEnrollment, size), // Cap at maxSize
        department: c.department, roomType: c.roomType || "regular",
        isCore: false, teacher: null, room: null, period: null,
        isSingleton: num === 1
      });
    }
  });
  
  const intendedLoad: Record<string, number> = {};
  teachers.forEach(t => intendedLoad[t.id] = 0);

  [...sections].sort(() => Math.random() - 0.5).forEach(sec => {
    const candidates = teachers.filter(t => (t.departments||[]).includes(sec.department));
    const pool = candidates.length > 0 ? candidates : teachers; 
    
    pool.sort((a,b) => intendedLoad[a.id] - intendedLoad[b.id]);
    
    if(pool.length > 0) {
      const t = pool[0]; 
      sec.teacher = t.id; 
      sec.teacherName = t.name; 
      intendedLoad[t.id]++; 
      
      const roomAssigned = Object.keys(tracker.roomOwners).find(rId => tracker.roomOwners[rId] === t.id);
      if(roomAssigned) { sec.room = roomAssigned; sec.roomName = rooms.find(r=>r.id===roomAssigned)?.name; }
    } else { 
      sec.hasConflict = true; 
      sec.conflictReason = "No Teacher"; 
    }
  });

  constraints.forEach(c => {
    if(c.type === "lock_period" && c.sectionId) {
      const s = sections.find(x=>x.id === c.sectionId);
      if(s) { 
        s.period = toUniv(Number(c.period)); 
        s.locked = true; 
      }
    }
  });

  sections.filter(s=>s.locked && s.period).forEach(s => {
    tracker.assignPlacement(s, s.period!, s.teacher || "", s.coTeacher || null, s.room || "", 'FY');
  });

  let strategy: any;
  if (config.scheduleType === "ab_block") {
    logger.info("Engaging A/B Block Strategy...");
    strategy = new ABStrategy(tracker, config, logger);
  } else if (config.scheduleType === "4x4_block") {
    logger.info("Engaging 4x4 Semester Block Strategy...");
    strategy = new Block4x4Strategy(tracker, config, logger);
  } else if (config.scheduleType === "trimester") {
    logger.info("Engaging Trimester Strategy...");
    strategy = new TrimesterStrategy(tracker, config, logger);
  } else {
    logger.info("Engaging Standard Strategy Engine...");
    strategy = new StandardStrategy(tracker, config, logger);
  }
  
  const strategyConflicts = strategy.execute(sections, periodList, rooms);
  conflicts.push(...strategyConflicts);

  if (isSplitLunch && lunchPid) {
    const univLunchPid = toUniv(lunchPid);
    const lunchSections = sections.filter(s => s.period === univLunchPid && !s.hasConflict);
    const depts = [...new Set(lunchSections.map(s => s.department))];
    const deptWaveMap: Record<string, number> = {};
    const waveCounts: number[] = Array(numWaves).fill(0);
    
    depts.sort((a,b) => {
      const countA = lunchSections.filter(s => s.department === a).length;
      const countB = lunchSections.filter(s => s.department === b).length;
      return countB - countA;
    });

    depts.forEach(dept => {
      const deptSecs = lunchSections.filter(s => s.department === dept);
      const studentCountInDept = deptSecs.reduce((sum, s) => sum + s.enrollment, 0);
      let bestWave = 0; let minVal = Infinity;
      for(let w=0; w<numWaves; w++) { if(waveCounts[w] < minVal) { minVal = waveCounts[w]; bestWave = w; } }
      deptWaveMap[dept] = bestWave + 1; waveCounts[bestWave] += studentCountInDept;
    });
    
    lunchSections.forEach(s => { s.lunchWave = deptWaveMap[s.department]; });
  }

  const periodStudentData: Record<string, any> = {};
  const isAB = config.scheduleType === "ab_block";
  const is4x4 = config.scheduleType === "4x4_block";
  const isTri = config.scheduleType === "trimester";

  teachingPeriodIds.forEach(pid => {
    const pObj = periodList.find(p => p.id === pid) || ({} as Period);
    let unaccounted = 0;
    let seats = 0;
    let atLunchCount: number | string = 0;

    if (isAB) {
       const aSeats = sections.filter(s => s.period === `FY-A-${pid}` && !s.hasConflict).reduce((sum, s) => sum + (s.enrollment||0), 0);
       const bSeats = sections.filter(s => s.period === `FY-B-${pid}` && !s.hasConflict).reduce((sum, s) => sum + (s.enrollment||0), 0);
       seats = Math.round((aSeats + bSeats) / 2);
    } else if (is4x4) {
       const s1Seats = sections.filter(s => s.period === `S1-ALL-${pid}` && !s.hasConflict).reduce((sum, s) => sum + (s.enrollment||0), 0);
       const s2Seats = sections.filter(s => s.period === `S2-ALL-${pid}` && !s.hasConflict).reduce((sum, s) => sum + (s.enrollment||0), 0);
       seats = Math.round((s1Seats + s2Seats) / 2);
    } else if (isTri) {
       const t1Seats = sections.filter(s => s.period === `T1-ALL-${pid}` && !s.hasConflict).reduce((sum, s) => sum + (s.enrollment||0), 0);
       const t2Seats = sections.filter(s => s.period === `T2-ALL-${pid}` && !s.hasConflict).reduce((sum, s) => sum + (s.enrollment||0), 0);
       const t3Seats = sections.filter(s => s.period === `T3-ALL-${pid}` && !s.hasConflict).reduce((sum, s) => sum + (s.enrollment||0), 0);
       seats = Math.round((t1Seats + t2Seats + t3Seats) / 3);
    } else {
       const univPid = pid === "WIN" ? "WIN" : `FY-ALL-${pid}`;
       seats = sections.filter(s => s.period === univPid && !s.hasConflict).reduce((sum, s) => sum + (s.enrollment||0), 0);
    }

    unaccounted = Math.max(0, studentCount - seats);

    if (lunchStyle === "unit" && pid === lunchPid) {
      unaccounted = 0;
      atLunchCount = studentCount;
    } else if (lunchStyle === "split" && pid === lunchPid) {
      atLunchCount = "Waves";
    } else if (isMultiPeriod && multiLunchPids.includes(pid as string | number)) {
      atLunchCount = Math.floor(studentCount / multiLunchPids.length);
      unaccounted = Math.max(0, studentCount - seats - atLunchCount);
    } else if (pid === "WIN" || pid === "RECESS" || pObj.type === "recess") {
      unaccounted = 0;
    }

    periodStudentData[pid] = {
      seatsInClass: seats, unaccounted: unaccounted, atLunch: atLunchCount, 
      sectionCount: sections.filter(s => s.period && String(s.period).includes(`-${pid}`) && !s.hasConflict).length
    };

    if(unaccounted > 50 && pObj.type !== "unit_lunch" && pObj.type !== "win" && pObj.type !== "recess") {
      conflicts.push({ type: "coverage", message: `Period ${pid}: ${unaccounted} students unaccounted for on average.` });
    }
  });

  teachers.forEach(t => {
    const teaching = Object.keys(tracker.teacherSchedule[t.id] || {}).filter(k => !["LUNCH", "PLC", "PLAN", "BLOCKED"].includes(tracker.teacherSchedule[t.id][k])).length;
    const free = effectiveSlots - teaching;
    
    const expectedFree = safePlanPeriods + (plcEnabled ? 1 : 0);
    if (free < expectedFree) { 
      conflicts.push({ type: "plan_violation", message: `${t.name} has ${free} free periods (needs ${expectedFree} for Plan/PLC)`, teacherId: t.id }); 
    }
  });

  const uiTeacherSchedule: Record<string, Record<string, any>> = {};
  const uiRoomSchedule: Record<string, Record<string, any>> = {};

  teachers.forEach(t => uiTeacherSchedule[t.id] = {});
  rooms.forEach(r => uiRoomSchedule[r.id] = {});

  const toUiPid = (univId: string | number | null): string | number | null => {
    if (!univId) return null;
    const strId = String(univId);
    
    if (strId === "WIN" || strId === "RECESS" || strId === "LUNCH" || strId === "PLC" || strId === "BLOCKED") return strId;
    
    if (strId.startsWith("FY-ALL-")) {
      const raw = strId.replace("FY-ALL-", "");
      return isNaN(Number(raw)) ? raw : Number(raw);
    }
    
    if (strId.startsWith("FY-A-") || strId.startsWith("FY-B-")) {
      const raw = strId.replace("FY-A-", "").replace("FY-B-", "");
      return `${strId.charAt(3)}-${isNaN(Number(raw)) ? raw : Number(raw)}`; 
    }

    if (strId.startsWith("S1-") || strId.startsWith("S2-")) {
      const raw = strId.replace("S1-ALL-", "").replace("S2-ALL-", "");
      return `${strId.substring(0, 2)}-${isNaN(Number(raw)) ? raw : Number(raw)}`;
    }

    if (strId.startsWith("T1-") || strId.startsWith("T2-") || strId.startsWith("T3-")) {
      const raw = strId.replace("T1-ALL-", "").replace("T2-ALL-", "").replace("T3-ALL-", "");
      return `${strId.substring(0, 2)}-${isNaN(Number(raw)) ? raw : Number(raw)}`;
    }
    
    return strId; 
  };

  sections.forEach(sec => {
    if (sec.period) sec.period = toUiPid(sec.period!) as string | number;
  });

  Object.keys(tracker.teacherSchedule).forEach(tId => {
    Object.keys(tracker.teacherSchedule[tId]).forEach(univId => {
      const uiId = toUiPid(univId);
      if(uiId) uiTeacherSchedule[tId][uiId] = tracker.teacherSchedule[tId][univId];
    });
  });

  Object.keys(tracker.roomSchedule).forEach(rId => {
    Object.keys(tracker.roomSchedule[rId]).forEach(univId => {
      const uiId = toUiPid(univId);
      if(uiId) uiRoomSchedule[rId][uiId] = tracker.roomSchedule[rId][univId];
    });
  });

  return {
    sections, periodList, logs: logger.logs, placementHistory: logger.placementHistory, 
    conflicts, 
    teacherSchedule: uiTeacherSchedule, 
    roomSchedule: uiRoomSchedule,       
    teachers, rooms, periodStudentData,
    plcGroups: finalPlcGroups, 
    stats: { 
      totalSections: sections.length, 
      scheduledCount: sections.filter(s => s.period && !s.hasConflict).length, 
      conflictCount: conflicts.length, 
      teacherCount: teachers.length, 
      roomCount: rooms.length, 
      totalStudents: studentCount 
    }
  };
}