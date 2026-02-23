// src/utils/csvParser.ts
// Pure parsing utilities — no store access, no side effects.
// Takes raw string[][] from PapaParse + user-configured mappings and produces typed objects.

import { Student, CourseRequest, Course, Teacher, Room } from '../types';

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
  const sidCol = colFor(mappings, 'student_id');
  const snameCol = colFor(mappings, 'student_name');
  const cidCol = colFor(mappings, 'course_id');
  const cnameCol = colFor(mappings, 'course_name');
  const gradeCol = colFor(mappings, 'student_grade');
  const priorityCol = colFor(mappings, 'priority');
  const altGroupCol = colFor(mappings, 'alternate_group');

  const studentMap = new Map<string, Student>();

  for (let i = dataStartRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every(c => !c.trim())) continue;

    const rawId = cell(row, sidCol);
    const rawName = cell(row, snameCol);
    const studentKey = rawId || rawName;
    if (!studentKey) continue;

    const courseId = cell(row, cidCol);
    const courseName = cell(row, cnameCol);
    const courseKey = courseId || courseName;
    if (!courseKey) continue;

    let priority = 1;
    if (priorityCol >= 0) {
      const p = parseInt(cell(row, priorityCol), 10);
      if (!isNaN(p) && p > 0) priority = p;
    } else if (!opts.assumeEqualPriority) {
      priority = 1;
    }

    const alternateGroup = altGroupCol >= 0 ? cell(row, altGroupCol) || undefined : undefined;
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
  const sidCol = colFor(mappings, 'student_id');
  const snameCol = colFor(mappings, 'student_name');
  const gradeCol = colFor(mappings, 'student_grade');
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
    const rawName = cell(row, snameCol);
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
