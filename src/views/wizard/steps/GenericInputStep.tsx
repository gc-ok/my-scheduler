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
  const isTeam = c.scheduleType === "ms_team";

  const isElem = c.schoolType === "elementary" || c.schoolType === "k8";
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
  const [cohorts, setCohorts] = useState<any[]>(
    c.cohorts && c.cohorts.length > 0 ? c.cohorts : [
      { id: "c1", name: "1A", gradeLevel: "1", teacherName: "", studentCount: 25, parallelGroupId: "", scheduleModel: defaultCohortModel, partnerTeacherName: "" },
      { id: "c2", name: "1B", gradeLevel: "1", teacherName: "", studentCount: 25, parallelGroupId: "", scheduleModel: defaultCohortModel, partnerTeacherName: "" },
      { id: "c3", name: "2A", gradeLevel: "2", teacherName: "", studentCount: 26, parallelGroupId: "", scheduleModel: defaultCohortModel, partnerTeacherName: "" },
    ]
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
    setConfig({ ...c, departments: depts, studentCount: sc, roomCount: rc, labCount: lc, gymCount: gc, maxClassSize: ms, targetLoad: validLoad, teachers, courses, rooms, studentCountQuick: sc });
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
                  {["K","1","2","3","4","5","6","7","8"].map(g => <option key={g} value={g}>Gr {g}</option>)}
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
              <button onClick={() => setExpanded(expanded === i ? null : i)} aria-expanded={expanded === i} style={{ cursor: "pointer", fontSize: 13, color: COLORS.primary, fontWeight: 600, padding: "4px 8px", background: "none", border: "none", fontFamily: "inherit" }}>
                {expanded === i ? "▲ Hide" : "✏️ Names"}
              </button>
              <button aria-label={`Remove department ${d.name}`} onClick={() => setDepts(depts.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: COLORS.danger, fontSize: 18, marginLeft: "auto", background: "none", border: "none", fontFamily: "inherit" }}>×</button>
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