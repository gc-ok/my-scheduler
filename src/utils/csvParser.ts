// src/utils/csvParser.ts
// Pure parsing utilities — no store access, no side effects.
// Takes raw string[][] from PapaParse + user-configured mappings and produces typed objects.

import { Student, CourseRequest, Course, Teacher, Room } from '../types';

// ─── SIS auto-detection ───────────────────────────────────────────────────────

/**
 * Maps normalized SIS column header names → our internal field keys.
 * Covers PowerSchool (underscores) and Infinite Campus (spaces) export formats.
 */
export const SIS_FIELD_ALIASES: Record<string, string> = {
  // ── Student ID ──
  'student_number': 'student_id',     // PowerSchool
  'student number': 'student_id',     // Infinite Campus
  'studentnumber': 'student_id',
  'student_id': 'student_id',
  'student id': 'student_id',
  'studentid': 'student_id',
  'dcid': 'student_id',               // PowerSchool internal ID
  'studentsdcid': 'student_id',
  'state_studentnumber': 'student_id',
  'local_student_number': 'student_id',
  'permid': 'student_id',

  // ── Student name (combined) ──
  'lastfirst': 'student_name',        // PowerSchool default display
  'student name': 'student_name',
  'studentname': 'student_name',
  'student_name': 'student_name',
  'name': 'student_name',

  // ── Student name (split columns — PS and IC both export these) ──
  'first_name': 'first_name',
  'firstname': 'first_name',
  'first name': 'first_name',
  'last_name': 'last_name',
  'lastname': 'last_name',
  'last name': 'last_name',

  // ── Grade level ──
  'grade_level': 'student_grade',     // PowerSchool
  'grade level': 'student_grade',     // Infinite Campus
  'grade': 'student_grade',
  'gradelevel': 'student_grade',
  'student_grade': 'student_grade',

  // ── Course identifier ──
  'course_number': 'course_id',       // PowerSchool
  'course number': 'course_id',       // Infinite Campus
  'coursenumber': 'course_id',
  'course_id': 'course_id',
  'course id': 'course_id',
  'courseid': 'course_id',
  'course code': 'course_id',
  'course_code': 'course_id',

  // ── Course name ──
  'course_name': 'course_name',
  'course name': 'course_name',
  'coursename': 'course_name',
  'course title': 'course_name',
  'course_title': 'course_name',

  // ── Priority / sequence ──
  'priority': 'priority',
  'req_sequence': 'priority',         // PowerSchool
  'request sequence': 'priority',     // Infinite Campus
  'requestsequence': 'priority',
  'sched_priority': 'priority',

  // ── PowerSchool-specific request fields ──
  'alternate_flag': 'ps_alternate_flag', // 0=primary, 1=alternate
  'alt_seq': 'ps_alt_seq',              // alternate group sequence
  'req_alt_seq': 'ps_alt_seq',

  // ── Infinite Campus-specific request field ──
  'request type': 'ic_request_type',    // R=Required, E=Elective, A=Alternate
  'requesttype': 'ic_request_type',
  'request_type': 'ic_request_type',

  // ── Alternate group (generic) ──
  'alternate_group': 'alternate_group',
  'alternate group': 'alternate_group',

  // ── Course info — teacher ──
  'teacher_name': 'teacher_name',
  'teacher name': 'teacher_name',
  'teachername': 'teacher_name',
  'teacher': 'teacher_name',
  'staff name': 'teacher_name',
  'staff_name': 'teacher_name',
  'instructor': 'teacher_name',
  'instructor name': 'teacher_name',

  // ── Course info — room ──
  'room_number': 'room_number',
  'room number': 'room_number',
  'roomnumber': 'room_number',
  'room': 'room_number',
  'room name': 'room_number',
  'classroom': 'room_number',

  // ── Course info — department ──
  'department': 'department',
  'dept': 'department',
  'subject': 'department',
  'subject type': 'department',
  'subject_type': 'department',

  // ── Course info — sections ──
  'section_count': 'section_count',
  'sections': 'section_count',
  'number of sections': 'section_count',
  'num_sections': 'section_count',

  // ── Course info — enrollment ──
  'student_count': 'student_count',
  'enrollment': 'student_count',
  'total students': 'student_count',
  'student enrollment': 'student_count',
  'projected enrollment': 'student_count',

  // ── Course info — capacity ──
  'max_class_size': 'max_class_size',
  'max class size': 'max_class_size',
  'max_enrollment': 'max_class_size',
  'max enrollment': 'max_class_size',
  'maximum students': 'max_class_size',
  'max students': 'max_class_size',
  'maxenrollment': 'max_class_size',
  'capacity': 'max_class_size',
  'max_size': 'max_class_size',

  // ── Course info — grade level of course ──
  'grade_level_course': 'grade_level',
  'course_grade': 'grade_level',
};

export type SISFormat = 'powerschool' | 'infinite_campus' | 'generic';

/**
 * Identifies whether a file looks like a PowerSchool or Infinite Campus export
 * by checking the header row for signature column names.
 */
export function detectSISFormat(headerRow: string[]): SISFormat {
  const normalized = headerRow.map(h => h.trim().toLowerCase());

  // PowerSchool signature: uses underscores, has PS-only fields
  const psSignature = ['student_number', 'alternate_flag', 'grade_level', 'last_name', 'first_name', 'alt_seq', 'dcid'];
  const psHits = psSignature.filter(f => normalized.includes(f)).length;

  // Infinite Campus signature: uses spaces, has IC-only fields
  const icSignature = ['request type', 'student number', 'course number', 'first name', 'last name', 'grade level'];
  const icHits = icSignature.filter(f => normalized.includes(f)).length;

  if (psHits >= 2) return 'powerschool';
  if (icHits >= 2) return 'infinite_campus';
  return 'generic';
}

/**
 * Scans a header row and returns pre-filled column mappings by matching
 * against SIS_FIELD_ALIASES. Ready to merge into the mapping step's state.
 */
export function buildAutoMappings(headerRow: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  headerRow.forEach((rawHeader, colIdx) => {
    const normalized = rawHeader.trim().toLowerCase();
    const mapped = SIS_FIELD_ALIASES[normalized];
    if (mapped) result[String(colIdx)] = mapped;
  });
  return result;
}

// ─── Column mapping helpers ───────────────────────────────────────────────────

/** Returns the column index for a given field name, or -1 if not mapped. */
function colFor(mappings: Record<string, string>, field: string): number {
  const entry = Object.entries(mappings).find(([, v]) => v === field);
  return entry ? parseInt(entry[0], 10) : -1;
}

/** Returns all column indices mapped to a given field (for multi-mapped fields like course_col). */
function colsFor(mappings: Record<string, string>, field: string): number[] {
  return Object.entries(mappings)
    .filter(([, v]) => v === field)
    .map(([k]) => parseInt(k, 10));
}

function cell(row: string[], idx: number): string {
  return idx >= 0 ? (row[idx] ?? '').trim() : '';
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ─── Multi-row course requests ─────────────────────────────────────────────────

export interface MultiRowParseOpts {
  assumeEqualPriority?: boolean; // true → all rows default to priority 1 when priority col not mapped
}

/**
 * Parses a CSV where each row is one student course request.
 * Required: one of (student_id | student_name) AND one of (course_id | course_name).
 * Optional: student_grade, priority, alternate_group.
 */
export function parseRequestsMultiRow(
  data: string[][],
  _headerRow: number,
  dataStartRow: number,
  mappings: Record<string, string>,
  opts: MultiRowParseOpts = {}
): Student[] {
  const sidCol      = colFor(mappings, 'student_id');
  const snameCol    = colFor(mappings, 'student_name');
  // Split-name columns (PowerSchool / Infinite Campus)
  const fnameCol    = colFor(mappings, 'first_name');
  const lnameCol    = colFor(mappings, 'last_name');
  const cidCol      = colFor(mappings, 'course_id');
  const cnameCol    = colFor(mappings, 'course_name');
  const gradeCol    = colFor(mappings, 'student_grade');
  const priorityCol = colFor(mappings, 'priority');
  const altGroupCol = colFor(mappings, 'alternate_group');
  // SIS-specific priority/alternate fields
  const icReqTypeCol  = colFor(mappings, 'ic_request_type');   // IC: R/E/A
  const psAltFlagCol  = colFor(mappings, 'ps_alternate_flag'); // PS: 0/1
  const psAltSeqCol   = colFor(mappings, 'ps_alt_seq');        // PS: alternate grouping sequence

  const studentMap = new Map<string, Student>();

  for (let i = dataStartRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every(c => !c.trim())) continue;

    const rawId = cell(row, sidCol);
    // Build student name from combined column OR first+last split columns
    const combinedName = cell(row, snameCol);
    const firstName = fnameCol >= 0 ? cell(row, fnameCol) : '';
    const lastName  = lnameCol >= 0 ? cell(row, lnameCol) : '';
    const splitName = [firstName, lastName].filter(Boolean).join(' ');
    const rawName = combinedName || splitName;

    const studentKey = rawId || rawName;
    if (!studentKey) continue;

    const courseId = cell(row, cidCol);
    const courseName = cell(row, cnameCol);
    const courseKey = courseId || courseName;
    if (!courseKey) continue;

    // ── Derive priority + alternate group from SIS-specific fields ──
    let priority = 1;
    let sisAltGroup: string | undefined;

    if (icReqTypeCol >= 0) {
      // Infinite Campus: Request Type column (R/E/A)
      const reqType = cell(row, icReqTypeCol).toUpperCase().trim();
      if (reqType === 'A' || reqType === 'ALT' || reqType === 'ALTERNATE') {
        priority = 10;
        sisAltGroup = `${studentKey}_ic_alt`;
      } else if (reqType === 'E' || reqType === 'ELECTIVE') {
        priority = 2;
      } else {
        priority = 1; // R, Required, empty, or unknown
      }
    } else if (psAltFlagCol >= 0) {
      // PowerSchool: Alternate_Flag column (0=primary, 1=alternate)
      const isAlt = cell(row, psAltFlagCol).trim() === '1';
      if (isAlt) {
        priority = 10;
        const seq = psAltSeqCol >= 0 ? cell(row, psAltSeqCol) || '1' : '1';
        sisAltGroup = `${studentKey}_alt_${seq}`;
      } else if (priorityCol >= 0) {
        const p = parseInt(cell(row, priorityCol), 10);
        if (!isNaN(p) && p > 0) priority = p;
      }
    } else if (priorityCol >= 0) {
      const p = parseInt(cell(row, priorityCol), 10);
      if (!isNaN(p) && p > 0) priority = p;
    } else if (!opts.assumeEqualPriority) {
      priority = 1; // default; assumeEqualPriority doesn't change the value but documents intent
    }

    // Explicit alternate_group column takes precedence over SIS-derived group
    const alternateGroup = altGroupCol >= 0
      ? (cell(row, altGroupCol) || sisAltGroup || undefined)
      : sisAltGroup;
    const gradeLevel = gradeCol >= 0 ? cell(row, gradeCol) : '';

    if (!studentMap.has(studentKey)) {
      studentMap.set(studentKey, {
        id: rawId || slugify(rawName),
        name: rawName || rawId,
        gradeLevel,
        requests: [],
      });
    }

    const student = studentMap.get(studentKey)!;
    // Update grade if we got one and didn't have it yet
    if (!student.gradeLevel && gradeLevel) student.gradeLevel = gradeLevel;

    const request: CourseRequest = {
      courseId: courseId || slugify(courseName),
      priority,
      ...(alternateGroup ? { alternateGroupId: alternateGroup } : {}),
    };

    // Avoid duplicate requests for the same course
    if (!student.requests.some(r => r.courseId === request.courseId)) {
      student.requests.push(request);
    }
  }

  return Array.from(studentMap.values());
}

// ─── Wide-format course requests ──────────────────────────────────────────────

export interface CourseColMeta {
  mode: 'priority' | 'equal' | 'alternate';
  priority?: number;        // used when mode === 'priority' or as fallback
  alternateGroup?: string;  // used when mode === 'alternate'
}

export interface WideParseOpts {
  courseColMeta?: Record<string, CourseColMeta>; // keyed by string column index
}

/**
 * Parses a CSV where each row is one student with multiple course columns.
 * Required: one of (student_id | student_name).
 * Course columns are mapped to "course_col"; each has associated priority metadata.
 */
export function parseRequestsWide(
  data: string[][],
  headerRow: number,
  dataStartRow: number,
  mappings: Record<string, string>,
  opts: WideParseOpts = {}
): Student[] {
  const sidCol    = colFor(mappings, 'student_id');
  const snameCol  = colFor(mappings, 'student_name');
  const fnameCol  = colFor(mappings, 'first_name');
  const lnameCol  = colFor(mappings, 'last_name');
  const gradeCol  = colFor(mappings, 'student_grade');
  const courseCols = colsFor(mappings, 'course_col');

  const headerRowData = data[headerRow] ?? [];
  const meta = opts.courseColMeta ?? {};

  // Determine a shared priority for "equal" columns (lowest explicit priority assigned, or 1)
  const equalPriority = (() => {
    const explicit = Object.values(meta)
      .filter(m => m.mode === 'priority' && m.priority != null)
      .map(m => m.priority!);
    return explicit.length ? Math.min(...explicit) : 1;
  })();

  const students: Student[] = [];

  for (let i = dataStartRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every(c => !c.trim())) continue;

    const rawId = cell(row, sidCol);
    const combinedName = cell(row, snameCol);
    const firstName = fnameCol >= 0 ? cell(row, fnameCol) : '';
    const lastName  = lnameCol >= 0 ? cell(row, lnameCol) : '';
    const rawName = combinedName || [firstName, lastName].filter(Boolean).join(' ');
    const studentKey = rawId || rawName;
    if (!studentKey) continue;

    const gradeLevel = gradeCol >= 0 ? cell(row, gradeCol) : '';
    const requests: CourseRequest[] = [];

    for (const colIdx of courseCols) {
      const rawCourse = cell(row, colIdx);
      if (!rawCourse) continue; // student didn't request this course

      const colMeta = meta[String(colIdx)];
      const headerLabel = headerRowData[colIdx]?.trim() ?? '';
      // Use CSV header as course name if the cell value itself looks like a Y/N marker
      const isMarker = /^(y|yes|x|1|true)$/i.test(rawCourse);
      const courseId = isMarker
        ? slugify(headerLabel) || `col_${colIdx}`
        : slugify(rawCourse);

      let priority = 1;
      let alternateGroupId: string | undefined;

      if (colMeta) {
        if (colMeta.mode === 'priority') {
          priority = colMeta.priority ?? 1;
        } else if (colMeta.mode === 'equal') {
          priority = equalPriority;
        } else if (colMeta.mode === 'alternate') {
          priority = 10; // engine convention: alternates are priority ≥ 10
          alternateGroupId = colMeta.alternateGroup || `alt_group_${colIdx}`;
        }
      }

      if (!requests.some(r => r.courseId === courseId)) {
        requests.push({
          courseId,
          priority,
          ...(alternateGroupId ? { alternateGroupId } : {}),
        });
      }
    }

    if (requests.length > 0) {
      students.push({
        id: rawId || slugify(rawName),
        name: rawName || rawId,
        gradeLevel,
        requests,
      });
    }
  }

  return students;
}

// ─── Course information ────────────────────────────────────────────────────────

export interface CourseInfoParseOpts {
  defaultSections?: number;   // fallback sections per course (default 1)
  defaultMaxSize?: number;    // global default max class size (default 30)
  floaterTeachers?: string[]; // teacher names explicitly marked as floaters
}

export interface CourseInfoResult {
  courses: Course[];
  teachers: Teacher[];
  rooms: Room[];
}

/**
 * Parses a CSV where each row describes a course (and optionally its teacher/room).
 * Required: one of (course_id | course_name).
 * Optional: teacher_name, room_number, department, section_count, student_count,
 *           max_class_size, grade_level.
 *
 * Room logic:
 *   - If room_number column IS mapped: build rooms from distinct values; blank = floater.
 *   - If room_number NOT mapped: auto-generate one room per non-floater teacher.
 */
export function parseCourseInfo(
  data: string[][],
  _headerRow: number,
  dataStartRow: number,
  mappings: Record<string, string>,
  opts: CourseInfoParseOpts = {}
): CourseInfoResult {
  const cidCol = colFor(mappings, 'course_id');
  const cnameCol = colFor(mappings, 'course_name');
  const teacherCol = colFor(mappings, 'teacher_name');
  const roomCol = colFor(mappings, 'room_number');
  const deptCol = colFor(mappings, 'department');
  const secCountCol = colFor(mappings, 'section_count');
  const studCountCol = colFor(mappings, 'student_count');
  const maxSizeCol = colFor(mappings, 'max_class_size');
  const gradeCol = colFor(mappings, 'grade_level');

  const hasRoomCol = roomCol >= 0;
  const floaterSet = new Set((opts.floaterTeachers ?? []).map(n => n.trim().toLowerCase()));
  const defaultSections = opts.defaultSections ?? 1;
  const defaultMaxSize = opts.defaultMaxSize ?? 30;

  // Accumulators
  const courseMap = new Map<string, Course>();
  const teacherMap = new Map<string, Teacher>();  // key: lowercase name
  const roomMap = new Map<string, Room>();        // key: room label

  for (let i = dataStartRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every(c => !c.trim())) continue;

    const rawCourseId = cell(row, cidCol);
    const rawCourseName = cell(row, cnameCol);
    const courseKey = rawCourseId || rawCourseName;
    if (!courseKey) continue;

    const courseId = rawCourseId || slugify(rawCourseName);
    const courseName = rawCourseName || rawCourseId;
    const teacherName = teacherCol >= 0 ? cell(row, teacherCol) : '';
    const rawRoom = hasRoomCol ? cell(row, roomCol) : '';
    const department = deptCol >= 0 ? cell(row, deptCol) : 'Unassigned';
    const gradeLevel = gradeCol >= 0 ? cell(row, gradeCol) : undefined;

    const rawMaxSize = maxSizeCol >= 0 ? parseInt(cell(row, maxSizeCol), 10) : NaN;
    const maxSize = !isNaN(rawMaxSize) && rawMaxSize > 0 ? rawMaxSize : defaultMaxSize;

    // Section count: explicit > derived from student count > default
    let sections = defaultSections;
    if (secCountCol >= 0) {
      const s = parseInt(cell(row, secCountCol), 10);
      if (!isNaN(s) && s > 0) sections = s;
    } else if (studCountCol >= 0) {
      const sc = parseInt(cell(row, studCountCol), 10);
      if (!isNaN(sc) && sc > 0) sections = Math.max(1, Math.ceil(sc / maxSize));
    }

    // Upsert course (first row wins for metadata; accumulate sections across rows)
    if (!courseMap.has(courseId)) {
      courseMap.set(courseId, {
        id: courseId,
        name: courseName,
        department: department || 'Unassigned',
        sections,
        maxSize,
        ...(gradeLevel ? { gradeLevel } : {}),
      });
    } else {
      // If same course appears on multiple rows (e.g. multiple sections listed),
      // sum up section counts
      const existing = courseMap.get(courseId)!;
      existing.sections = (existing.sections ?? 1) + sections - defaultSections;
    }

    // Upsert teacher
    if (teacherName) {
      const tKey = teacherName.toLowerCase();
      if (!teacherMap.has(tKey)) {
        const isFloater = floaterSet.has(tKey) || (hasRoomCol && !rawRoom);
        teacherMap.set(tKey, {
          id: slugify(teacherName),
          name: teacherName,
          isFloater,
          departments: department ? [department] : undefined,
        });
      } else {
        // Add department if new
        const existing = teacherMap.get(tKey)!;
        if (department && existing.departments && !existing.departments.includes(department)) {
          existing.departments.push(department);
        }
        // If room column exists and this row has no room, mark as floater
        if (hasRoomCol && !rawRoom) {
          existing.isFloater = true;
        }
      }

      // Upsert room (only if room column is mapped and value is present)
      if (hasRoomCol && rawRoom) {
        if (!roomMap.has(rawRoom)) {
          roomMap.set(rawRoom, {
            id: slugify(rawRoom),
            name: rawRoom,
            type: 'regular',
          });
        }
      }
    }
  }

  // Auto-generate rooms for non-floater teachers when no room column was mapped
  if (!hasRoomCol) {
    for (const [, teacher] of teacherMap) {
      const isFloater = floaterSet.has(teacher.name.toLowerCase());
      teacher.isFloater = isFloater;
      if (!isFloater) {
        const roomName = `${teacher.name}'s Room`;
        const roomId = `room_${teacher.id}`;
        if (!roomMap.has(roomId)) {
          roomMap.set(roomId, { id: roomId, name: roomName, type: 'regular' });
        }
      }
    }
  }

  return {
    courses: Array.from(courseMap.values()),
    teachers: Array.from(teacherMap.values()),
    rooms: Array.from(roomMap.values()),
  };
}
