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

// ---------------------------------------------------------------------------
// Teacher list paste parser
// Handles: newline list, CSV, TSV; first+last split columns; optional Floater column
// ---------------------------------------------------------------------------
function parseTeacherList(text: string): { name: string; isFloater: boolean }[] {
  if (!text.trim()) return [];
  const rows = text.trim().split(/\r?\n/).filter(r => r.trim());

  const hasTabs  = rows.some(r => r.includes('\t'));
  const hasCommas = !hasTabs && rows.some(r => r.includes(','));

  const splitRow = (r: string): string[] => {
    if (hasTabs)    return r.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
    if (hasCommas)  return r.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    return [r.trim()];
  };

  const cells = rows.map(splitRow);
  const colCount = Math.max(...cells.map(c => c.length), 1);

  const FLOATER_VALS = new Set(['yes','y','true','x','1','floater','✓']);
  const isFloaterVal = (v: string) => FLOATER_VALS.has(v.trim().toLowerCase());

  // Detect optional header row
  const HEADER_WORDS = new Set(['name','first','last','teacher','staff','floater','float','dept','email','id']);
  const firstRow = cells[0] || [];
  const looksLikeHeader = firstRow.some(c => HEADER_WORDS.has(c.toLowerCase().replace(/\s+/g,'')));
  const headerRow  = looksLikeHeader ? firstRow : null;
  const dataRows   = looksLikeHeader ? cells.slice(1) : cells;
  if (!dataRows.length) return [];

  // Single-column: just names
  if (colCount === 1) {
    return dataRows.map(r => r[0]?.trim()).filter(Boolean).map(name => ({ name, isFloater: false }));
  }

  // Multi-column: determine which columns are names vs floater
  let nameColIndices: number[] = [];
  let floaterColIndex = -1;

  if (headerRow) {
    headerRow.forEach((h, ci) => {
      const lh = h.toLowerCase().replace(/\s+/g,'');
      if (['first','last','name','teacher','staff','firstname','lastname'].some(k => lh.includes(k))) nameColIndices.push(ci);
      else if (lh.includes('float')) floaterColIndex = ci;
    });
  }

  if (nameColIndices.length === 0) {
    // Heuristic scan: find boolean-looking columns (floater) vs name-looking columns
    for (let ci = 0; ci < colCount; ci++) {
      const vals = dataRows.map(r => (r[ci] || '').trim()).filter(Boolean);
      if (!vals.length) continue;
      const allBool = vals.every(v => isFloaterVal(v) || v === '');
      if (allBool && floaterColIndex === -1) { floaterColIndex = ci; continue; }
      if (vals.every(v => v.length < 40 && !/^\d+$/.test(v))) nameColIndices.push(ci);
    }
    if (nameColIndices.length === 0) nameColIndices = [0];
  }

  return dataRows.map(row => {
    const name = nameColIndices.map(ci => (row[ci] || '').trim()).filter(Boolean).join(' ').trim();
    const isFloater = floaterColIndex >= 0 ? isFloaterVal(row[floaterColIndex] || '') : false;
    return name ? { name, isFloater } : null;
  }).filter(Boolean) as { name: string; isFloater: boolean }[];
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
  const isTeam = c.scheduleType === "ms_team";

  const isElem = c.schoolType === "elementary" || c.schoolType === "k8" || c.schoolType === "k12";
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
  // Paste-import state
  const [pasteDeptIdx, setPasteDeptIdx] = useState<number | null>(null);
  const [pasteText, setPasteText] = useState('');

  // TEAM-BASED STATE (ms_team)
  const DEFAULT_TEAMS = [
    { id: "team_a", name: "Team A", gradeLevel: "6", studentCount: 120,
      departments: [
        { id: "english", name: "English/ELA", roomType: "regular" },
        { id: "math",    name: "Math",         roomType: "regular" },
        { id: "science", name: "Science",       roomType: "lab"     },
        { id: "social",  name: "Social Studies",roomType: "regular" },
      ]
    },
    { id: "team_b", name: "Team B", gradeLevel: "7", studentCount: 120,
      departments: [
        { id: "english", name: "English/ELA", roomType: "regular" },
        { id: "math",    name: "Math",         roomType: "regular" },
        { id: "science", name: "Science",       roomType: "lab"     },
        { id: "social",  name: "Social Studies",roomType: "regular" },
      ]
    },
  ];
  const [teams, setTeams] = useState<any[]>(
    c.teams && c.teams.length > 0 ? c.teams : DEFAULT_TEAMS
  );
  const upTeam = (i: number, f: string, v: any) => { const t = [...teams]; t[i] = { ...t[i], [f]: v }; setTeams(t); };
  const upTeamDept = (ti: number, di: number, f: string, v: any) => {
    const t = [...teams]; const deps = [...(t[ti].departments || [])]; deps[di] = { ...deps[di], [f]: v };
    t[ti] = { ...t[ti], departments: deps }; setTeams(t);
  };

  // ELEMENTARY COHORT STATE
  // parallelGroupId: cohorts sharing the same group ID are scheduled for the same subject at the same period
  // Default model derived from school-level elementaryModel answer so pre-fills correctly.
  const defaultCohortModel = c.elementaryModel === 'platooning' ? 'platooning' : 'self_contained';

  // Smart default cohorts: auto-generate 2 cohorts per relevant grade
  // Includes elementary grades for elem/k8/k12 PLUS any grades the user selected in cohortGrades
  const buildDefaultCohorts = () => {
    const ALL_GRADES = ["K","1","2","3","4","5","6","7","8","9","10","11","12"];
    const ELEM_GRADES = ["K","1","2","3","4","5"];

    let grades: string[] = [];
    if (c.schoolType === "elementary") grades = [...ELEM_GRADES];
    else if (c.schoolType === "k8") grades = [...ELEM_GRADES];
    else if (c.schoolType === "k12") grades = [...ELEM_GRADES];
    else if (c.schoolType === "custom" && c.customGradeRange) {
      const fi = ALL_GRADES.indexOf(c.customGradeRange.from);
      const ti = ALL_GRADES.indexOf(c.customGradeRange.to);
      if (fi !== -1 && ti !== -1) grades = ALL_GRADES.slice(fi, ti + 1).filter(g => ELEM_GRADES.includes(g));
    }

    // Also include any grades the user explicitly selected for cohort tracking (cohortGrades from SchoolTypeStep)
    const cohortGrades: string[] = c.cohortGrades || [];
    cohortGrades.forEach((g: string) => {
      if (!grades.includes(g)) grades.push(g);
    });

    // Sort grades in proper order
    grades.sort((a, b) => ALL_GRADES.indexOf(a) - ALL_GRADES.indexOf(b));

    if (grades.length === 0) grades = ["1", "2"];

    const earlyGrades = new Set(["K","1","2"]);
    const labels = ["A", "B"];
    const result: any[] = [];
    let idx = 0;

    grades.forEach(grade => {
      let model = defaultCohortModel;
      // Elementary grades use split_band logic; non-elementary cohort grades default to departmentalized
      if (ELEM_GRADES.includes(grade) && c.elementaryModel === 'split_band') {
        model = earlyGrades.has(grade) ? 'self_contained' : 'departmentalized';
      } else if (!ELEM_GRADES.includes(grade)) {
        model = 'departmentalized';
      }
      labels.forEach(lbl => {
        idx++;
        result.push({
          id: `c${idx}`, name: `${grade}${lbl}`, gradeLevel: grade,
          teacherName: "", studentCount: 25, parallelGroupId: "",
          scheduleModel: model, partnerTeacherName: "",
        });
      });
    });
    return result;
  };

  const [cohorts, setCohorts] = useState<any[]>(
    c.cohorts && c.cohorts.length > 0 ? c.cohorts : buildDefaultCohorts()
  );

  // ELEMENTARY COURSE STATE — core subjects + specials
  const DEFAULT_ELEM_COURSES = [
    { id: "math",    name: "Math",           department: "Math",           required: true,  isSpecial: false, roomType: "regular" },
    { id: "ela",     name: "ELA",            department: "ELA",            required: true,  isSpecial: false, roomType: "regular" },
    { id: "science", name: "Science",         department: "Science",        required: true,  isSpecial: false, roomType: "regular" },
    { id: "social",  name: "Social Studies",  department: "Social Studies", required: true,  isSpecial: false, roomType: "regular" },
    { id: "art",     name: "Art",             department: "Art",            required: false, isSpecial: true,  roomType: "regular" },
    { id: "music",   name: "Music",           department: "Music",          required: false, isSpecial: true,  roomType: "regular" },
    { id: "pe",      name: "PE",              department: "PE",             required: false, isSpecial: true,  roomType: "gym"     },
  ];
  const [elemCourses, setElemCourses] = useState<any[]>(
    c.courses && c.courses.length > 0 ? c.courses : DEFAULT_ELEM_COURSES
  );
  const upEC = (i: number, f: string, v: any) => { const d = [...elemCourses]; d[i] = { ...d[i], [f]: v }; setElemCourses(d); };

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

  // Build a human-readable explanation of how maxTeachable was calculated
  const maxTeachableExplain = (() => {
    const parts: string[] = [`${periodCount} periods`];
    if (planP > 0) parts.push(`−${planP} Plan`);
    if (lunchConsumes > 0) parts.push(`−${lunchConsumes} Lunch`);
    if (winConsumes > 0) parts.push(`−${winConsumes} WIN`);
    const dailyStr = `${parts.join(" ")} = ${dailyTeachable}/day`;
    if (isBlock) return `Max: ${maxTeachable} (${dailyStr} × 2 semesters). If this seems wrong, go back to Bell Schedule or Plan & PLC steps.`;
    if (isTri) return `Max: ${maxTeachable} (${dailyStr} × 3 trimesters). If this seems wrong, go back to Bell Schedule or Plan & PLC steps.`;
    return `Max: ${maxTeachable} (${dailyStr}). If this seems wrong, go back to Bell Schedule or Plan & PLC steps.`;
  })();
  
  const coreDepts = depts.filter(d => d.required);

  const cont = () => {
    if (isTeam) {
      // TEAM-BASED LOGIC — one cohort per team, teachers grouped by team + department
      const teachers: any[] = [];
      const courses: any[] = [];
      const cohorts: any[] = [];
      const builtTeams: any[] = [];
      const rooms: any[] = [];

      teams.forEach((team, ti) => {
        const teamId = team.id || `team_${ti}`;
        const cohortId = `${teamId}_cohort`;

        // One cohort per team (represents the shared student group)
        cohorts.push({
          id: cohortId,
          name: `${team.name} Students`,
          gradeLevel: team.gradeLevel || String(6 + ti),
          teacherId: `${teamId}_t0`,
          studentCount: team.studentCount || 120,
        });

        const teamTeacherIds: string[] = [];

        (team.departments || []).forEach((dept: any, di: number) => {
          const teacherId = `${teamId}_${dept.id}_t${di}`;
          teamTeacherIds.push(teacherId);

          teachers.push({
            id: teacherId,
            name: `${team.name} ${dept.name} Teacher`,
            departments: [dept.id],
            teamId,
            planPeriods: planP,
            requiresLab: dept.roomType === "lab",
            requiresGym: dept.roomType === "gym",
          });

          // One course per department per team (cohort-bound)
          courses.push({
            id: `${teamId}_${dept.id}`,
            name: dept.name,
            department: dept.id,
            sections: 1,
            maxSize: team.studentCount || 120,
            required: true,
            roomType: dept.roomType || "regular",
            gradeLevel: team.gradeLevel || String(6 + ti),
          });
        });

        builtTeams.push({ id: teamId, name: team.name, gradeLevel: team.gradeLevel, teacherIds: teamTeacherIds, cohortId, studentCount: team.studentCount || 120 });
      });

      // Rooms: one per teacher + labs/gyms for specialised departments
      const allDeptRoomTypes = teams.flatMap((t: any) => (t.departments || []).map((d: any) => d.roomType || "regular"));
      const labCount = allDeptRoomTypes.filter((r: string) => r === "lab").length;
      const gymCount = allDeptRoomTypes.filter((r: string) => r === "gym").length;
      let rIdx = 0;
      teachers.forEach(t => {
        if (!t.requiresLab && !t.requiresGym) rooms.push({ id: `room_${rIdx++}`, name: `Room ${101 + rIdx}`, type: "regular", capacity: ms });
      });
      for (let i = 0; i < labCount; i++) rooms.push({ id: `lab_${i}`, name: `Lab ${i + 1}`, type: "lab", capacity: ms });
      for (let i = 0; i < gymCount; i++) rooms.push({ id: `gym_${i}`, name: `Gym ${i + 1}`, type: "gym", capacity: ms * 2 });

      setConfig({
        ...c,
        useTeams: true,
        teams: builtTeams,
        cohorts,
        teachers,
        courses,
        rooms,
        studentCount: teams.reduce((sum: number, t: any) => sum + (t.studentCount || 120), 0),
        maxClassSize: ms,
        studentCountQuick: sc,
      });
      onNext();
      return;
    }

    if (isElem) {
      // ELEMENTARY LOGIC — build teachers from cohorts + specials courses
      const teachers: any[] = [];

      // Assign teacherIds and partnerTeacherIds; deduplicate partner teachers by exact name
      const partnerNameToId = new Map<string, string>();

      const cohortsWithIds = cohorts.map((coh, i) => {
        const teacherId = coh.teacherId || `t_hr_${i}`;
        let partnerTeacherId: string | undefined;

        if (coh.scheduleModel === 'platooning' && coh.partnerTeacherName?.trim()) {
          const pName = coh.partnerTeacherName.trim();
          if (!partnerNameToId.has(pName)) {
            partnerNameToId.set(pName, `t_partner_${partnerNameToId.size}`);
          }
          partnerTeacherId = partnerNameToId.get(pName);
        }

        return {
          ...coh,
          teacherId,
          partnerTeacherId,
          parallelGroupId: coh.parallelGroupId || undefined,
        };
      });

      // Build primary homeroom / STEM teachers
      cohortsWithIds.forEach(coh => {
        // Avoid duplicate teachers when multiple cohorts share the same named teacher
        if (!teachers.find(t => t.id === coh.teacherId)) {
          const isPlatooning = coh.scheduleModel === 'platooning';
          teachers.push({
            id: coh.teacherId,
            name: coh.teacherName || (isPlatooning ? `STEM ${coh.name}` : `Homeroom ${coh.name}`),
            departments: isPlatooning
              ? ["Math", "Science", "STEM", "Technology"]
              : ["Homeroom", `Grade ${coh.gradeLevel}`],
            planPeriods: planP,
          });
        }
      });

      // Build partner (Humanities) teachers for platooning cohorts
      partnerNameToId.forEach((id, name) => {
        teachers.push({
          id,
          name,
          departments: ["ELA", "English", "Social Studies", "History", "Humanities"],
          planPeriods: planP,
        });
      });

      // Specials teachers — one per specials course (deduped by department)
      const seenDepts = new Set<string>();
      elemCourses.filter(ec => ec.isSpecial).forEach((ec, i) => {
        if (!seenDepts.has(ec.department)) {
          seenDepts.add(ec.department);
          teachers.push({
            id: `t_spec_${ec.id}_${i}`,
            name: `${ec.name} Teacher`,
            departments: [ec.department],
            planPeriods: planP,
            requiresGym: ec.roomType === "gym",
          });
        }
      });

      // Rooms: one per cohort (regular) + gym if PE is included
      const rooms: any[] = [];
      cohorts.forEach((_, i) => rooms.push({ id: `room_${i + 1}`, name: `Room ${101 + i}`, type: "regular", capacity: ms }));
      if (elemCourses.some(ec => ec.roomType === "gym")) {
        rooms.push({ id: "gym_1", name: "Gym", type: "gym", capacity: ms * 3 });
      }

      setConfig({
        ...c,
        cohorts: cohortsWithIds,
        courses: elemCourses.map(ec => ({ ...ec, maxSize: ms })),
        teachers,
        rooms,
        studentCount: sc,
        maxClassSize: ms,
        studentCountQuick: sc,
      });
      onNext();
      return;
    }

    const teachers: any[] = [], courses: any[] = [], rooms: any[] = [];
    depts.forEach(dept => {
      const tc = dept.teacherCount || 1;
      const names = dept.teacherNames || [];
      const floaters = dept.teacherFloaters || [];
      const loadOverrides: (number | undefined)[] = dept.teacherLoadOverrides || [];
      const extraDepts: string[][] = dept.teacherExtraDepts || [];

      for (let i = 0; i < tc; i++) {
        teachers.push({
          id: `${dept.id}_t${i + 1}`,
          name: names[i] || `${dept.name} Teacher ${i + 1}`,
          departments: [dept.id, ...(extraDepts[i] || [])],
          planPeriods: planP,
          isFloater: floaters[i] || false,
        });
      }
      const isPE = dept.id === "pe" || dept.name.toLowerCase().includes("pe") || dept.name.toLowerCase().includes("physical");
      const sectionMax = isPE ? Math.max(ms, 40) : ms;
      // Sum per-teacher loads (use individual override if set, else global validLoad)
      const totalLoad = Array.from({ length: tc }, (_, ti) => loadOverrides[ti] ?? validLoad).reduce((a: number, b: number) => a + b, 0);
      const sectionsNeeded = dept.required ? Math.max(totalLoad, Math.ceil(sc / sectionMax)) : totalLoad;
      courses.push({ id: `${dept.id}_101`, name: dept.name, department: dept.id, sections: Math.max(1, sectionsNeeded), maxSize: sectionMax, required: dept.required, roomType: dept.roomType || "regular", gradeLevel: "all" });
    });
    for (let i = 0; i < rc; i++) rooms.push({ id: `room_${i + 1}`, name: `Room ${101 + i}`, type: "regular", capacity: ms });
    for (let i = 0; i < lc; i++) rooms.push({ id: `lab_${i + 1}`, name: `Lab ${i + 1}`, type: "lab", capacity: ms });
    for (let i = 0; i < gc; i++) rooms.push({ id: `gym_${i + 1}`, name: `Gym ${i + 1}`, type: "gym", capacity: ms * 2 });
    // If user selected cohortGrades (e.g. freshmen academy, advisory groups),
    // auto-generate cohorts for those grades so the engine creates cohort-bound sections
    const cohortGradesArr: string[] = c.cohortGrades || [];
    let autoCohorts: any[] | undefined;
    if (cohortGradesArr.length > 0) {
      const labels = ["A", "B"];
      autoCohorts = [];
      let idx = 0;
      cohortGradesArr.forEach((grade: string) => {
        labels.forEach(lbl => {
          idx++;
          autoCohorts!.push({
            id: `cohort_${idx}`, name: `${grade}${lbl}`, gradeLevel: grade,
            teacherName: "", studentCount: Math.round(sc / (cohortGradesArr.length * labels.length)),
            parallelGroupId: "", scheduleModel: "departmentalized", partnerTeacherName: "",
          });
        });
      });
      // Tag core courses with grade levels that match cohort grades so the engine binds them
      const gradeCourses: any[] = [];
      courses.forEach(course => {
        if (course.gradeLevel === "all" && course.required) {
          cohortGradesArr.forEach((grade: string) => {
            gradeCourses.push({
              ...course,
              id: `${course.id}_gr${grade}`,
              name: `${course.name} (Gr ${grade})`,
              gradeLevel: grade,
            });
          });
        }
      });
      courses.push(...gradeCourses);
    }

    setConfig({
      ...c, departments: depts, studentCount: sc, roomCount: rc, labCount: lc, gymCount: gc,
      maxClassSize: ms, targetLoad: validLoad, teachers, courses, rooms, studentCountQuick: sc,
      ...(autoCohorts ? { cohorts: autoCohorts } : {}),
    });
    onNext();
  };

  if (isTeam) {
    const GRADE_OPTIONS = ["5","6","7","8","9"];
    return (
      <div>
        <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Team-Based Setup</h2>
        <p style={{ color: COLORS.textLight, marginBottom: 20 }}>
          Define your interdisciplinary teams. Each team shares a student cohort and gets a common planning period automatically blocked by the engine.
        </p>
        <div style={{ maxWidth: 780 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <NumInput label="Max Class Size" min={10} max={200} value={ms} onChange={setMs} />
            <NumInput label="Total Students" min={10} max={5000} value={sc} onChange={setSc} />
          </div>

          {teams.map((team, ti) => (
            <div key={team.id} style={{ marginBottom: 16, border: `1px solid ${COLORS.lightGray}`, borderRadius: 10, overflow: "hidden" }}>
              {/* Team header */}
              <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: COLORS.offWhite, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={team.name}
                  onChange={e => upTeam(ti, "name", e.target.value)}
                  placeholder="Team name"
                  style={{ ...INPUT_STYLE, flex: 1, minWidth: 100 }}
                />
                <select
                  value={team.gradeLevel || "6"}
                  onChange={e => upTeam(ti, "gradeLevel", e.target.value)}
                  style={{ ...SELECT_STYLE, width: 90 }}
                >
                  {GRADE_OPTIONS.map(g => <option key={g} value={g}>Grade {g}</option>)}
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number" min={10} max={500}
                    value={team.studentCount || 120}
                    onChange={e => upTeam(ti, "studentCount", parseInt(e.target.value) || 120)}
                    style={{ ...SMALL_INPUT, width: 60 }}
                  />
                  <span style={{ fontSize: 12, color: COLORS.textLight }}>students</span>
                </div>
                <button
                  aria-label={`Remove team ${team.name}`}
                  onClick={() => setTeams(teams.filter((_: any, j: number) => j !== ti))}
                  style={{ cursor: "pointer", color: COLORS.danger, background: "none", border: "none", fontSize: 18, lineHeight: 1, fontFamily: "inherit", marginLeft: "auto" }}
                >×</button>
              </div>

              {/* Departments in this team */}
              <div style={{ padding: "10px 12px", background: COLORS.white }}>
                <p style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>Subjects taught on this team (one teacher each):</p>
                {(team.departments || []).map((dept: any, di: number) => (
                  <div key={di} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <input
                      value={dept.name}
                      onChange={e => upTeamDept(ti, di, "name", e.target.value)}
                      placeholder="Subject name"
                      style={{ ...INPUT_STYLE, flex: 1 }}
                    />
                    <select
                      value={dept.roomType || "regular"}
                      onChange={e => upTeamDept(ti, di, "roomType", e.target.value)}
                      style={{ ...SELECT_STYLE, width: 90, fontSize: 12, padding: "5px 8px" }}
                    >
                      <option value="regular">Room</option>
                      <option value="lab">Lab</option>
                      <option value="gym">Gym</option>
                    </select>
                    <button
                      aria-label={`Remove ${dept.name}`}
                      onClick={() => upTeam(ti, "departments", team.departments.filter((_: any, j: number) => j !== di))}
                      style={{ cursor: "pointer", color: COLORS.danger, background: "none", border: "none", fontSize: 16, lineHeight: 1, fontFamily: "inherit" }}
                    >×</button>
                  </div>
                ))}
                <Btn variant="ghost" small onClick={() => upTeam(ti, "departments", [...(team.departments || []), { id: `dept_${Date.now()}`, name: "", roomType: "regular" }])}>
                  + Add Subject
                </Btn>
              </div>
            </div>
          ))}

          <Btn variant="ghost" small onClick={() => setTeams([...teams, {
            id: `team_${Date.now()}`, name: `Team ${String.fromCharCode(65 + teams.length)}`,
            gradeLevel: "6", studentCount: 120,
            departments: [
              { id: "english", name: "English/ELA", roomType: "regular" },
              { id: "math",    name: "Math",         roomType: "regular" },
              { id: "science", name: "Science",       roomType: "lab"     },
              { id: "social",  name: "Social Studies",roomType: "regular" },
            ]
          }])}>
            + Add Team
          </Btn>

          <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: COLORS.accentLight, fontSize: 12, color: COLORS.darkGray }}>
            <strong>Engine will generate:</strong>&nbsp;
            {teams.length} cohorts × {teams.reduce((n: number, t: any) => Math.max(n, (t.departments || []).length), 0)} subjects
            &nbsp;= <strong>{teams.reduce((n: number, t: any) => n + (t.departments || []).length, 0)} sections</strong>.
            Each team gets a common planning period automatically.
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
          <Btn variant="secondary" onClick={onBack}>← Back</Btn>
          <Btn onClick={cont} disabled={teams.length === 0}>Continue →</Btn>
        </div>
      </div>
    );
  }

  if (isElem) {
    const coreCourses  = elemCourses.filter(ec => !ec.isSpecial);
    const specCourses  = elemCourses.filter(ec => ec.isSpecial);
    return (
      <div>
        <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Elementary Setup</h2>
        <p style={{ color: COLORS.textLight, marginBottom: 20 }}>
          Define your cohorts (homerooms) and the subjects each cohort is taught.
          The engine creates one section per cohort per subject and prevents scheduling conflicts.
        </p>

        <div style={{ maxWidth: 780 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <NumInput label="Total Students" min={10} max={5000} value={sc} onChange={setSc} />
            <NumInput label="Max Class Size"  min={10} max={50}   value={ms} onChange={setMs} />
          </div>

          {/* ── COHORTS ── */}
          <h3 style={{ fontSize: 15, marginBottom: 8, color: COLORS.text }}>🏫 Cohorts (Homerooms)</h3>
          <p style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 10 }}>
            Each cohort is a fixed group of students who travel together. The homeroom teacher
            covers all core subjects for their cohort.
          </p>
          <p style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 8 }}>
            <strong>Parallel Group</strong> (optional): cohorts with the same group label (e.g. "PG1") are scheduled for the same subject at the same period with different teachers — ideal for grade-level teacher swaps.
          </p>
          {cohorts.map((coh, i) => (
            <div key={coh.id} style={{ background: COLORS.offWhite, borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
              {/* Primary row */}
              <div style={{ display: "flex", gap: 8, padding: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={coh.name}
                  onChange={e => { const n = [...cohorts]; n[i] = { ...n[i], name: e.target.value }; setCohorts(n); }}
                  placeholder="Name (1A)"
                  style={{ ...INPUT_STYLE, width: 72 }}
                />
                <select
                  value={coh.gradeLevel}
                  onChange={e => { const n = [...cohorts]; n[i] = { ...n[i], gradeLevel: e.target.value }; setCohorts(n); }}
                  style={{ ...SELECT_STYLE, width: 82 }}
                >
                  {["K","1","2","3","4","5","6","7","8","9","10","11","12"].map(g => <option key={g} value={g}>Gr {g}</option>)}
                </select>
                {/* Model selector */}
                <select
                  value={coh.scheduleModel || "self_contained"}
                  onChange={e => { const n = [...cohorts]; n[i] = { ...n[i], scheduleModel: e.target.value }; setCohorts(n); }}
                  style={{ ...SELECT_STYLE, width: 148, fontSize: 12 }}
                  title="Scheduling model for this cohort"
                >
                  <option value="self_contained">Self-Contained</option>
                  <option value="platooning">Platooning</option>
                  <option value="departmentalized">Departmentalized</option>
                </select>
                <input
                  value={coh.teacherName || ""}
                  onChange={e => { const n = [...cohorts]; n[i] = { ...n[i], teacherName: e.target.value }; setCohorts(n); }}
                  placeholder={coh.scheduleModel === "platooning" ? "STEM Teacher" : "Homeroom Teacher"}
                  style={{ ...INPUT_STYLE, flex: 1, minWidth: 120 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number" min={5} max={50}
                    value={coh.studentCount}
                    onChange={e => { const n = [...cohorts]; n[i] = { ...n[i], studentCount: parseInt(e.target.value) || 0 }; setCohorts(n); }}
                    style={{ ...SMALL_INPUT, width: 52 }}
                  />
                  <span style={{ fontSize: 11, color: COLORS.textLight }}>sts</span>
                </div>
                {/* Parallel Block Group */}
                <input
                  value={coh.parallelGroupId || ""}
                  onChange={e => { const n = [...cohorts]; n[i] = { ...n[i], parallelGroupId: e.target.value || undefined }; setCohorts(n); }}
                  placeholder="Group"
                  title="Parallel group ID — cohorts sharing this label are scheduled for the same subject at the same period"
                  style={{ ...INPUT_STYLE, width: 68, fontSize: 12 }}
                />
                <button
                  aria-label={`Remove cohort ${coh.name}`}
                  onClick={() => setCohorts(cohorts.filter((_, j) => j !== i))}
                  style={{ cursor: "pointer", color: COLORS.danger, background: "none", border: "none", fontSize: 18, lineHeight: 1, fontFamily: "inherit" }}
                >×</button>
              </div>
              {/* Platooning: partner teacher row */}
              {coh.scheduleModel === "platooning" && (
                <div style={{ display: "flex", gap: 8, padding: "6px 10px 10px", alignItems: "center", borderTop: `1px solid ${COLORS.lightGray}` }}>
                  <span style={{ fontSize: 11, color: COLORS.textLight, whiteSpace: "nowrap", minWidth: 72 }}>Partner →</span>
                  <input
                    value={coh.partnerTeacherName || ""}
                    onChange={e => { const n = [...cohorts]; n[i] = { ...n[i], partnerTeacherName: e.target.value }; setCohorts(n); }}
                    placeholder="Humanities Teacher (ELA / Social Studies)"
                    style={{ ...INPUT_STYLE, flex: 1, fontSize: 13 }}
                  />
                  <span style={{ fontSize: 11, color: COLORS.textLight, whiteSpace: "nowrap" }}>handles non-STEM subjects</span>
                </div>
              )}
            </div>
          ))}
          <Btn variant="ghost" small onClick={() => setCohorts([...cohorts, { id: `c_${Date.now()}`, name: "", gradeLevel: "1", teacherName: "", studentCount: 25, parallelGroupId: "", scheduleModel: defaultCohortModel, partnerTeacherName: "" }])}>
            + Add Cohort
          </Btn>

          {/* ── CORE SUBJECTS ── */}
          <h3 style={{ fontSize: 15, margin: "24px 0 8px", color: COLORS.text }}>📚 Core Subjects</h3>
          <p style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 10 }}>
            One section per cohort per subject. For <strong>self-contained</strong> cohorts the homeroom teacher covers all core subjects.
            For <strong>platooning</strong> cohorts, Math/Science go to the STEM teacher and ELA/Social Studies go to the Humanities partner.
          </p>
          {coreCourses.map((ec, _) => {
            const i = elemCourses.indexOf(ec);
            return (
              <div key={ec.id} style={{ display: "flex", gap: 8, padding: "8px 10px", background: COLORS.offWhite, borderRadius: 8, marginBottom: 6, alignItems: "center" }}>
                <input
                  value={ec.name}
                  onChange={e => upEC(i, "name", e.target.value)}
                  placeholder="Subject name"
                  style={{ ...INPUT_STYLE, flex: 1 }}
                />
                <select value={ec.roomType || "regular"} onChange={e => upEC(i, "roomType", e.target.value)} style={{ ...SELECT_STYLE, width: 90, fontSize: 12, padding: "5px 8px" }}>
                  <option value="regular">Room</option>
                  <option value="lab">Lab</option>
                  <option value="gym">Gym</option>
                </select>
                <button
                  aria-label={`Remove ${ec.name}`}
                  onClick={() => setElemCourses(elemCourses.filter((_, j) => j !== i))}
                  style={{ cursor: "pointer", color: COLORS.danger, background: "none", border: "none", fontSize: 18, lineHeight: 1, fontFamily: "inherit" }}
                >×</button>
              </div>
            );
          })}
          <Btn variant="ghost" small onClick={() => setElemCourses([...elemCourses, { id: `core_${Date.now()}`, name: "", department: `Subject_${Date.now()}`, required: true, isSpecial: false, roomType: "regular" }])}>
            + Add Core Subject
          </Btn>

          {/* ── SPECIALS ── */}
          <h3 style={{ fontSize: 15, margin: "24px 0 8px", color: COLORS.text }}>🎨 Specials (Rotation)</h3>
          <p style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 10 }}>
            Each specials teacher rotates through all cohorts. One section per cohort per special is created.
          </p>
          {specCourses.map((ec, _) => {
            const i = elemCourses.indexOf(ec);
            return (
              <div key={ec.id} style={{ display: "flex", gap: 8, padding: "8px 10px", background: COLORS.offWhite, borderRadius: 8, marginBottom: 6, alignItems: "center" }}>
                <input
                  value={ec.name}
                  onChange={e => upEC(i, "name", e.target.value)}
                  placeholder="Special name (e.g. Art)"
                  style={{ ...INPUT_STYLE, flex: 1 }}
                />
                <select value={ec.roomType || "regular"} onChange={e => upEC(i, "roomType", e.target.value)} style={{ ...SELECT_STYLE, width: 90, fontSize: 12, padding: "5px 8px" }}>
                  <option value="regular">Room</option>
                  <option value="gym">Gym</option>
                </select>
                <button
                  aria-label={`Remove ${ec.name}`}
                  onClick={() => setElemCourses(elemCourses.filter((_, j) => j !== i))}
                  style={{ cursor: "pointer", color: COLORS.danger, background: "none", border: "none", fontSize: 18, lineHeight: 1, fontFamily: "inherit" }}
                >×</button>
              </div>
            );
          })}
          <Btn variant="ghost" small onClick={() => setElemCourses([...elemCourses, { id: `spec_${Date.now()}`, name: "", department: `Specials_${Date.now()}`, required: false, isSpecial: true, roomType: "regular" }])}>
            + Add Special
          </Btn>

          {/* summary */}
          <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: COLORS.accentLight, fontSize: 12, color: COLORS.darkGray }}>
            <strong>Engine will generate:</strong>&nbsp;
            {cohorts.length} cohorts × {coreCourses.length} core sections + {cohorts.length} cohorts × {specCourses.length} specials sections
            &nbsp;=&nbsp;<strong>{cohorts.length * (coreCourses.length + specCourses.length)} total sections</strong>
            {cohorts.some(c => c.scheduleModel === 'platooning') && (
              <span style={{ marginLeft: 8, color: COLORS.primary }}>
                · {cohorts.filter(c => c.scheduleModel === 'platooning').length} platooning cohort(s) — STEM/Humanities split
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
          <Btn variant="secondary" onClick={onBack}>← Back</Btn>
          <Btn onClick={cont} disabled={cohorts.length === 0 || elemCourses.length === 0}>Continue →</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Quick Setup</h2>
      <div style={{ maxWidth: 750 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
          <NumInput label="Total Students" min={10} max={5000} value={sc} onChange={setSc} />
          <NumInput label="Max Class Size" min={10} max={50} value={ms} onChange={setMs} />
          <NumInput label={isBlock || isTri ? "Total Sections per Teacher (Yearly)" : "Classes/Day per Teacher"} min={1} max={20} value={tl} onChange={setTl} helperText={maxTeachableExplain} />
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
              <button onClick={() => setExpanded(expanded === i ? null : i)} aria-expanded={expanded === i} style={{ cursor: "pointer", fontSize: 13, color: COLORS.primary, fontWeight: 600, padding: "4px 8px", background: "none", border: "none", fontFamily: "inherit" }}>
                {expanded === i ? "▲ Hide" : "✏️ Names"}
              </button>
              <button aria-label={`Remove department ${d.name}`} onClick={() => setDepts(depts.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: COLORS.danger, fontSize: 18, marginLeft: "auto", background: "none", border: "none", fontFamily: "inherit" }}>×</button>
            </div>
            {expanded === i && (
              <div style={{ padding: 12, background: COLORS.white, border: `1px solid ${COLORS.lightGray}`, borderTop: "none", borderRadius: "0 0 8px 8px" }}>
                {pasteDeptIdx === i ? (
                  /* ── PASTE MODE ── */
                  <div>
                    <p style={{ fontSize: 12, color: COLORS.textLight, margin: "0 0 8px 0" }}>
                      Paste your teacher list below. Accepts newline, CSV, or tab-separated.
                      You can include a <strong>Floater</strong> column (y/n) and <strong>First / Last</strong> name columns — the parser figures it out automatically.
                    </p>
                    <textarea
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      rows={6}
                      placeholder={"Examples:\nSmith, John\nJones, Mary, yes\nFirst\tLast\tFloater\nSmith\tJohn\tn"}
                      style={{ ...INPUT_STYLE, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
                    />
                    <div style={{ fontSize: 10, color: COLORS.textLight, marginTop: 4, lineHeight: 1.5 }}>
                      <strong>Accepted formats:</strong> one name per line · CSV (comma) · TSV (tab-paste from Excel/Sheets) · First/Last in separate columns · optional Floater column (y/yes/x = floater)
                    </div>
                    {/* Preview */}
                    {parseTeacherList(pasteText).length > 0 && (
                      <div style={{ marginTop: 10, padding: 8, background: COLORS.offWhite, borderRadius: 6 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 6px 0", color: COLORS.text }}>
                          Preview — {parseTeacherList(pasteText).length} teacher{parseTeacherList(pasteText).length !== 1 ? "s" : ""} detected:
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 180, overflowY: "auto" }}>
                          {parseTeacherList(pasteText).map((t, ti) => (
                            <div key={ti} style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
                              <span style={{ width: 20, color: COLORS.textLight, flexShrink: 0 }}>{ti + 1}.</span>
                              <span style={{ flex: 1 }}>{t.name}</span>
                              {t.isFloater && <span style={{ fontSize: 10, background: COLORS.accentLight, color: COLORS.primary, padding: "1px 6px", borderRadius: 10 }}>🎈 Floater</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <Btn
                        small
                        onClick={() => {
                          const parsed = parseTeacherList(pasteText);
                          if (!parsed.length) return;
                          const d2 = [...depts];
                          d2[i] = { ...d2[i], teacherNames: parsed.map(p => p.name), teacherFloaters: parsed.map(p => p.isFloater), teacherCount: parsed.length, teacherLoadOverrides: [], teacherExtraDepts: [] };
                          setDepts(d2);
                          setPasteDeptIdx(null);
                          setPasteText('');
                        }}
                        disabled={parseTeacherList(pasteText).length === 0}
                      >
                        Apply ({parseTeacherList(pasteText).length})
                      </Btn>
                      <Btn variant="secondary" small onClick={() => { setPasteDeptIdx(null); setPasteText(''); }}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  /* ── INDIVIDUAL MODE ── */
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <p style={{ fontSize: 12, color: COLORS.textLight, margin: 0 }}>Name teachers, set load & cross-dept assignments:</p>
                      <Btn variant="ghost" small onClick={() => { setPasteDeptIdx(i); setPasteText(''); }}>📋 Paste List</Btn>
                    </div>
                    {Array.from({ length: d.teacherCount || 1 }, (_, ti) => {
                      const otherDepts = depts.filter((_, j) => j !== i);
                      const extra: string[] = (d.teacherExtraDepts || [])[ti] || [];
                      const loadVal: number = (d.teacherLoadOverrides || [])[ti] ?? validLoad;
                      return (
                        <div key={ti} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${COLORS.lightGray}` }}>
                          {/* Row 1: name + floater */}
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: COLORS.textLight, width: 24, flexShrink: 0 }}>{ti + 1}.</span>
                            <input
                              value={(d.teacherNames || [])[ti] || ""}
                              onChange={e => { const n = [...(d.teacherNames || [])]; n[ti] = e.target.value; upD(i, "teacherNames", n); }}
                              placeholder={`${d.name} Teacher ${ti + 1}`}
                              style={{ ...INPUT_STYLE, flex: 1, width: "auto" }}
                            />
                            <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: COLORS.text, whiteSpace: "nowrap" }}>
                              <input type="checkbox" checked={(d.teacherFloaters || [])[ti] || false} onChange={e => { const f = [...(d.teacherFloaters || [])]; f[ti] = e.target.checked; upD(i, "teacherFloaters", f); }} />
                              Floater
                            </label>
                          </div>
                          {/* Row 2: load override + also-teaches */}
                          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 5, marginLeft: 32, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 11, color: COLORS.textLight }}>Load:</span>
                              <input
                                type="number" min={1} max={maxTeachable}
                                value={loadVal}
                                onChange={e => {
                                  const arr = [...(d.teacherLoadOverrides || Array.from({ length: d.teacherCount || 1 }, () => undefined as any))];
                                  arr[ti] = parseInt(e.target.value) || validLoad;
                                  upD(i, "teacherLoadOverrides", arr);
                                }}
                                style={{ ...SMALL_INPUT, width: 42 }}
                                title="Classes/day this teacher teaches (overrides the department default)"
                              />
                              <span style={{ fontSize: 11, color: COLORS.textLight }}>classes</span>
                            </div>
                            {otherDepts.length > 0 && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, color: COLORS.textLight, whiteSpace: "nowrap" }}>Also teaches:</span>
                                {otherDepts.map(od => {
                                  const checked = extra.includes(od.id);
                                  return (
                                    <label key={od.id} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 3, cursor: "pointer", background: checked ? COLORS.accentLight : "transparent", padding: "2px 6px", borderRadius: 10, border: `1px solid ${checked ? COLORS.accent : COLORS.lightGray}` }}>
                                      <input
                                        type="checkbox" checked={checked}
                                        onChange={e => {
                                          const newEx = e.target.checked ? [...extra, od.id] : extra.filter((id: string) => id !== od.id);
                                          const arr = [...(d.teacherExtraDepts || Array.from({ length: d.teacherCount || 1 }, () => [] as string[]))];
                                          arr[ti] = newEx;
                                          upD(i, "teacherExtraDepts", arr);
                                        }}
                                      />
                                      {od.name || od.id}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <div style={{ fontSize: 11, color: COLORS.textLight, padding: "4px 10px" }}>
              {(() => {
                const tc2 = d.teacherCount || 1;
                const overrides2: (number | undefined)[] = d.teacherLoadOverrides || [];
                const totalLoad2 = Array.from({ length: tc2 }, (_, ti) => overrides2[ti] ?? validLoad).reduce((a: number, b: number) => a + b, 0);
                const cnt = d.required ? Math.max(totalLoad2, Math.ceil(sc / ms)) : totalLoad2;
                return <>→ {cnt} sections{d.required ? " (core: every student takes 1)" : " (elective)"}</>;
              })()}
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