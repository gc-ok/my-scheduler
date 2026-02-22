// src/types/index.ts

export interface Teacher {
  id: string;
  name: string;
  departments?: string[];
  isFloater?: boolean;
  planPeriods?: number;
}

export interface Room {
  id: string;
  name: string;
  type: "regular" | "lab" | "gym" | string;
  capacity?: number;
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
  
  teachers?: Teacher[];
  courses?: Course[];
  rooms?: Room[];
  constraints?: Constraint[]; 
  plcGroups?: PlcGroup[];
  teacherAvailability?: TeacherAvailability[];
  
  studentCount?: number;
  maxClassSize?: number;
  planPeriodsPerDay?: number;
  plcEnabled?: boolean;
  plcFrequency?: string;
  scheduleMode?: string;
  periods?: Period[];
  
  // Catch-all for other legacy properties
  [key: string]: any;
}