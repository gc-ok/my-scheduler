// src/types/index.ts

export interface Teacher {
  id: string;
  name: string;
  departments?: string[];
  isFloater?: boolean;
  planPeriods?: number;
  travelTime?: number;
  requiresLab?: boolean;   // Needs a lab room (replaces hardcoded "science" check)
  requiresGym?: boolean;   // Needs a gym room (replaces hardcoded "pe" check)
}

export interface Room {
  id: string;
  name: string;
  type: "regular" | "lab" | "gym" | string;
  capacity?: number;
}

export interface Cohort {
  id: string;
  name: string;
  gradeLevel: string;
  teacherId: string;
  teacherName?: string;
  studentCount: number;
}

export interface Course {
  id: string;
  name: string;
  department: string;
  sections?: number;
  maxSize?: number;
  required?: boolean;
  roomType?: string;
  gradeLevel?: string;
  isSpecial?: boolean;      // Specials rotation (Art, Music, PE, Band, etc.)
  requiresLab?: boolean;    // Needs a lab room (Chemistry, Biology, etc.)
  largeCapacity?: boolean;  // Allows larger class size (PE, assembly, etc.)
}

export interface CourseRelationship {
  id?: string;
  type: "avoid_overlap" | "require_overlap";
  courseIds: string[];
  penalty?: number;
}

export interface Constraint {
  id?: string;
  type: "lock_period" | "teacher_unavailable" | string;
  priority?: string;
  courseId?: string;
  sectionId?: string;
  teacherId?: string;
  period?: number | string;
}

export interface TeacherAvailability {
  teacherId: string;
  blockedPeriods: (string | number)[];
}

export interface PlcGroup {
  id: string;
  name: string;
  period: string | number;
  teacherIds: string[];
}

export interface Section {
  id: string;
  courseId: string;
  courseName: string;
  sectionNum: number;
  maxSize: number;
  enrollment: number;
  department: string;
  gradeLevel?: string; // NEW: Carried over from Course for Elementary grouping
  roomType: string;
  isCore: boolean;
  
  // These might be null before the schedule runs
  teacher: string | null;
  teacherName?: string;
  coTeacher?: string | null;
  coTeacherName?: string;
  room: string | null;
  roomName?: string;
  period: string | number | null; 
  lunchWave?: number | null;
  term?: string;
  
  // Cohort binding — if set, no two sections with the same cohortId can share a period
  cohortId?: string;

  // State flags
  hasConflict?: boolean;
  conflictReason?: string;
  locked?: boolean;
  isManual?: boolean;
  isSingleton?: boolean;
  isDoubleBlock?: boolean;
}

export interface Period {
  id: string | number;
  label: string;
  type: "class" | "split_lunch" | "unit_lunch" | "multi_lunch" | "win" | string;
  startMin: number;
  endMin: number;
  startTime: string;
  endTime: string;
  duration: number;
  days?: number[]; // 1=Mon, 2=Tue, ... (For hybrid/rotating schedules)
}

export interface RecessConfig {
  enabled: boolean;
  duration: number;
  afterPeriod: number | string;
}

export interface ScheduleVariantDef {
  id: string;
  name: string;
  assignedDays: number[];
}

export interface SingleScheduleResult {
  sections: Section[];
  periods: Period[];
  stats?: {
    scheduledCount: number;
    totalSections: number;
    conflictCount: number;
    roomUtilization?: number;
    teacherUtilization?: number;
  };
  logs?: unknown[];
  placementHistory?: unknown[];
}

export interface ScheduleResult {
  structure: 'single' | 'multiple';
  variantDefs: ScheduleVariantDef[];
  variants: {
    [variantId: string]: SingleScheduleResult;
  };
}

// --- WizardState: flat shape the wizard UI reads/writes ---
// All fields optional. Normalized into EngineConfig by buildScheduleConfig().
export interface WizardState {
  inputMode?: string;
  schoolType?: string;
  scheduleType?: "standard" | "ab_block" | "4x4_block" | "trimester" | string;
  periodsCount?: number;
  schoolStart?: string;
  schoolEnd?: string;
  periodLength?: number;
  passingTime?: number;
  scheduleMode?: string;

  // Multi-schedule setup
  scheduleStructure?: "single" | "multiple";
  scheduleVariantDefs?: ScheduleVariantDef[];
  variantConfigs?: Record<string, Partial<WizardState>>;
  activeVariantId?: string;

  // Flat lunch fields (normalized into lunchConfig)
  lunchStyle?: string;
  lunchPeriod?: number | string;
  lunchPeriods?: (number | string)[];
  lunchDuration?: number;
  numLunchWaves?: number;
  minClassTime?: number;
  lunchModel?: string;

  // Flat WIN fields (normalized into winConfig)
  winEnabled?: boolean;
  winPeriod?: number | string;
  winModel?: string;
  winAfterPeriod?: number | string;
  winDuration?: number;

  // Recess (already structured, passed through)
  recessConfig?: RecessConfig;

  // Data collections
  teachers?: Teacher[];
  courses?: Course[];
  cohorts?: Cohort[];
  rooms?: Room[];
  constraints?: Constraint[];
  plcGroups?: PlcGroup[];
  teacherAvailability?: TeacherAvailability[];
  courseRelationships?: CourseRelationship[];
  periods?: Period[];

  // Scalar settings
  studentCount?: number;
  maxClassSize?: number;
  planPeriodsPerDay?: number;
  plcEnabled?: boolean;
  plcFrequency?: string;

  // Quick-setup wizard helpers
  departments?: { id: string; name: string; teacherCount: number; required: boolean; roomType: string; teacherNames: string[]; teacherFloaters?: boolean[] }[];
  roomCount?: number;
  labCount?: number;
  gymCount?: number;
  targetLoad?: number;
  students?: { count: number };
}

// --- EngineConfig: resolved shape consumed by the scheduling engine ---
// Nested configs are required (with defaults). No flat duplicates.
export interface EngineConfig {
  schoolType?: string;
  scheduleType?: "standard" | "ab_block" | "4x4_block" | "trimester" | string;
  periodsCount?: number;
  schoolStart: string;
  schoolEnd?: string;
  periodLength: number;
  passingTime: number;
  scheduleMode?: string;

  lunchConfig: {
    style: "unit" | "split" | "multi_period";
    lunchPeriod: number | string;
    lunchPeriods: (number | string)[];
    lunchDuration: number;
    numWaves: number;
    minClassTime: number;
  };

  winConfig: {
    enabled: boolean;
    winPeriod?: number | string;
    model: string;
    afterPeriod: number | string;
    winDuration: number;
  };

  recessConfig: RecessConfig;

  teachers: Teacher[];
  courses: Course[];
  cohorts: Cohort[];
  rooms: Room[];
  constraints: Constraint[];
  plcGroups?: PlcGroup[];
  teacherAvailability?: TeacherAvailability[];
  courseRelationships?: CourseRelationship[];
  periods: Period[];

  studentCount: number;
  maxClassSize: number;
  planPeriodsPerDay: number;
  plcEnabled?: boolean;
  plcFrequency?: string;

  // Regen overrides
  lockedSections?: Section[];
  manualSections?: Section[];
}

// Backwards-compatible alias — use WizardState for wizard code, EngineConfig for engine code.
export type ScheduleConfig = WizardState & Partial<EngineConfig>;