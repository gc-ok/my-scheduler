import { EngineConfig, Section, Student, CourseRequest } from '../types';

export interface StudentSchedule {
  studentId: string;
  schedule: Map<string | number, Section>; // Map<periodId, Section>
  conflicts: CourseRequest[]; // List of requests that could not be scheduled
}

/**
 * Groups sections by Course ID for quick lookups.
 * @param masterSchedule The flat array of sections from the master schedule generator.
 * @returns A Map where keys are course IDs and values are arrays of sections for that course.
 */
function indexScheduleByCourse(masterSchedule: Section[]): Map<string, Section[]> {
  const courseMap = new Map<string, Section[]>();
  for (const section of masterSchedule) {
    if (!section.period || section.hasConflict) continue; // Only consider schedulable sections

    if (!courseMap.has(section.courseId)) {
      courseMap.set(section.courseId, []);
    }
    courseMap.get(section.courseId)!.push(section);
  }
  return courseMap;
}

/**
 * Phase 2 of the scheduling process.
 * Takes a generated master schedule and a list of students with course requests,
 * then attempts to place students into sections.
 *
 * @param masterSchedule The sections array from the master schedule generator.
 * @param students The list of students with their course requests.
 * @param config The engine configuration.
 * @returns An array of student schedule results.
 */
export function runStudentScheduler(
  masterSchedule: Section[],
  students: Student[],
  _config: EngineConfig // _config is unused for now but kept for future enhancements
): StudentSchedule[] {
  
  const results: StudentSchedule[] = [];
  const courseMap = indexScheduleByCourse(masterSchedule);
  const sectionEnrollment: Map<string, number> = new Map();
  masterSchedule.forEach(s => sectionEnrollment.set(s.id, 0));

  for (const student of students) {
    const studentSchedule: StudentSchedule = {
      studentId: student.id,
      schedule: new Map<string | number, Section>(),
      conflicts: [],
    };

    // Sort requests by priority (lower number is higher priority)
    const sortedRequests = [...student.requests].sort((a, b) => a.priority - b.priority);

    for (const request of sortedRequests) {
      const potentialSections = courseMap.get(request.courseId) || [];
      let successfullyPlaced = false;

      // Find a section that fits the student's schedule
      for (const section of potentialSections) {
        const currentEnrollment = sectionEnrollment.get(section.id) ?? 0;

        // 1. Check if the section is full
        if (currentEnrollment >= section.maxSize) {
          continue; // Try next section
        }

        // 2. Check if the period is already taken in the student's schedule
        if (studentSchedule.schedule.has(section.period!)) {
          continue; // Conflict, try next section
        }

        // 3. This section is a valid placement
        studentSchedule.schedule.set(section.period!, section);
        sectionEnrollment.set(section.id, currentEnrollment + 1);
        successfullyPlaced = true;
        break; // Move to the next course request
      }

      if (!successfullyPlaced) {
        studentSchedule.conflicts.push(request);
      }
    }
    results.push(studentSchedule);
  }

  // Optional: Update original master schedule sections with final enrollment counts
  for(const section of masterSchedule) {
    section.enrollment = sectionEnrollment.get(section.id) ?? 0;
  }

  return results;
}
