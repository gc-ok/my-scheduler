// src/types/index.ts

export interface Teacher {
  id: string;
  name: string;
  departments?: string[];
  isFloater?: boolean;
  planPeriods?: number;
  travelTime?: number; // Minutes needed to travel between campuses/buildings
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

export interface ScheduleResult {
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

// A generic Config interface based on your engine.js
export interface ScheduleConfig {
  inputMode?: string;
  schoolType?: string;
  scheduleType?: "standard" | "ab_block" | "4x4_block" | "trimester" | string;
  periodsCount?: number;
  schoolStart?: string;
  schoolEnd?: string;
  periodLength?: number;
  passingTime?: number;
  
  lunchConfig?: {
    style?: "unit" | "split" | "multi_period";
    lunchPeriod?: number | string;
    lunchPeriods?: (number | string)[];
    lunchDuration?: number;
    numWaves?: number;
    minClassTime?: number;
  };
  
  winConfig?: {
    enabled?: boolean;
    winPeriod?: number | string;
    model?: string;
    afterPeriod?: number | string;
    winDuration?: number;
  };
  
  recessConfig?: RecessConfig;
  
  teachers?: Teacher[];
  courses?: Course[];
  cohorts?: Cohort[]; // NEW: For Elementary/Cohort-based scheduling
  rooms?: Room[];
  constraints?: Constraint[]; 
  plcGroups?: PlcGroup[];
  teacherAvailability?: TeacherAvailability[];
  courseRelationships?: CourseRelationship[];
  
  studentCount?: number;
  maxClassSize?: number;
  planPeriodsPerDay?: number;
  plcEnabled?: boolean;
  plcFrequency?: string;
  scheduleMode?: string;
  periods?: Period[];

  // Wizard-specific flat properties (normalized by buildScheduleConfig)
  winEnabled?: boolean;
  winPeriod?: number | string;
  winModel?: string;
  winAfterPeriod?: number | string;
  winDuration?: number;
  lunchStyle?: string;
  lunchPeriod?: number | string;
  lunchPeriods?: (number | string)[];
  lunchDuration?: number;
  numLunchWaves?: number;
  minClassTime?: number;
  lunchModel?: string;
  departments?: { id: string; name: string; teacherCount: number; required: boolean; roomType: string; teacherNames: string[]; teacherFloaters?: boolean[] }[];
  roomCount?: number;
  labCount?: number;
  gymCount?: number;
  targetLoad?: number;
  students?: { count: number };
  lockedSections?: Section[];
  manualSections?: Section[];
}