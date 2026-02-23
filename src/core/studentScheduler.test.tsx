// src/core/studentScheduler.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { runStudentScheduler } from './studentScheduler';
import { Section, Student, CourseRequest, EngineConfig } from '../types';

describe('Student Scheduler', () => {
  let masterSchedule: Section[];
  let students: Student[];
  const mockConfig = {} as EngineConfig; // Not used by current implementation, but required by signature

  beforeEach(() => {
    // A simple master schedule for testing
    masterSchedule = [
      { id: 'alg-s1', courseId: 'algebra', courseName: 'Algebra', sectionNum: 1, period: 1, maxSize: 2, enrollment: 0, department: 'Math', roomType: 'regular', isCore: true, teacher: 't1', room: 'r1' },
      { id: 'alg-s2', courseId: 'algebra', courseName: 'Algebra', sectionNum: 2, period: 2, maxSize: 1, enrollment: 0, department: 'Math', roomType: 'regular', isCore: true, teacher: 't1', room: 'r1' },
      { id: 'bio-s1', courseId: 'biology', courseName: 'Biology', sectionNum: 1, period: 2, maxSize: 2, enrollment: 0, department: 'Science', roomType: 'regular', isCore: true, teacher: 't2', room: 'r2' },
      { id: 'art-s1', courseId: 'art', courseName: 'Art', sectionNum: 1, period: 3, maxSize: 2, enrollment: 0, department: 'Arts', roomType: 'regular', isCore: false, teacher: 't3', room: 'r3' },
    ];
  });

  it('should schedule a student with non-conflicting requests', () => {
    students = [
      { id: 'stu1', name: 'Student One', gradeLevel: '9', requests: [
        { courseId: 'algebra', priority: 1 },
        { courseId: 'art', priority: 2 },
      ]}
    ];

    const result = runStudentScheduler(masterSchedule, students, mockConfig);
    const student1Schedule = result[0];

    expect(student1Schedule.conflicts.length).toBe(0);
    expect(student1Schedule.schedule.size).toBe(2);
    expect(student1Schedule.schedule.get(1)?.courseId).toBe('algebra');
    expect(student1Schedule.schedule.get(3)?.courseId).toBe('art');
  });

  it('should create a conflict if a section is at full capacity', () => {
    // Pre-fill a section to its max capacity
    masterSchedule.find(s => s.id === 'alg-s2')!.maxSize = 0;

    students = [
      { id: 'stu1', name: 'Student One', gradeLevel: '9', requests: [
        { courseId: 'biology', priority: 1 }, // This is fine
        { courseId: 'algebra', priority: 2 }, // Should conflict on period 2, then fail on period 1 due to capacity
      ]}
    ];
    // Re-index master schedule with the capacity change for this test
    const bioSection = masterSchedule.find(s => s.courseId === 'biology')!;
    const algSectionPeriod1 = masterSchedule.find(s => s.id === 'alg-s1')!;
    algSectionPeriod1.maxSize = 0; // Make Period 1 Algebra also full.
    
    const result = runStudentScheduler(masterSchedule, [students[0]], mockConfig);
    const student1Schedule = result[0];
    
    expect(student1Schedule.schedule.size).toBe(1); // Only Biology should be scheduled
    expect(student1Schedule.schedule.get(2)).toBe(bioSection);
    expect(student1Schedule.conflicts.length).toBe(1);
    expect(student1Schedule.conflicts[0].courseId).toBe('algebra');
  });

  it('should create a conflict if all sections for a course conflict with the schedule', () => {
    students = [
      { id: 'stu1', name: 'Student One', gradeLevel: '9', requests: [
        { courseId: 'algebra', priority: 1 }, // Takes period 2 (alg-s2)
        { courseId: 'biology', priority: 2 }, // Only offered in period 2, should conflict
      ]}
    ];
    
    // To make this deterministic, let's remove the period 1 algebra section
    const deterministicMasterSchedule = masterSchedule.filter(s => s.id !== 'alg-s1');

    const result = runStudentScheduler(deterministicMasterSchedule, students, mockConfig);
    const student1Schedule = result[0];

    expect(student1Schedule.schedule.size).toBe(1);
    expect(student1Schedule.schedule.get(2)?.courseId).toBe('algebra');
    expect(student1Schedule.conflicts.length).toBe(1);
    expect(student1Schedule.conflicts[0].courseId).toBe('biology');
  });

  it('should respect request priority when a conflict occurs', () => {
    students = [
      { id: 'stu1', name: 'Student One', gradeLevel: '9', requests: [
        // Both biology and algebra are offered in period 2.
        // Since biology has a higher priority (lower number), it should be scheduled.
        { courseId: 'biology', priority: 1 },
        { courseId: 'algebra', priority: 2 },
      ]}
    ];
    
    // Use a schedule where the conflict is guaranteed on period 2
    const deterministicMasterSchedule = masterSchedule.filter(s => s.id !== 'alg-s1');

    const result = runStudentScheduler(deterministicMasterSchedule, students, mockConfig);
    const student1Schedule = result[0];

    expect(student1Schedule.schedule.size).toBe(1);
    expect(student1Schedule.schedule.get(2)?.courseId).toBe('biology'); // Higher priority wins
    expect(student1Schedule.conflicts.length).toBe(1);
    expect(student1Schedule.conflicts[0].courseId).toBe('algebra'); // Lower priority conflicts
  });

  it('should update the final enrollment count in the master schedule', () => {
    students = [
      { id: 'stu1', name: 'Student One', gradeLevel: '9', requests: [{ courseId: 'algebra', priority: 1 }] },
      { id: 'stu2', name: 'Student Two', gradeLevel: '9', requests: [{ courseId: 'algebra', priority: 1 }] },
    ];

    runStudentScheduler(masterSchedule, students, mockConfig);

    // The current greedy algorithm places students in the first section it finds with capacity.
    // Both stu1 and stu2 will be placed in 'alg-s1' because it has a maxSize of 2.
    expect(masterSchedule.find(s => s.id === 'alg-s1')?.enrollment).toBe(2);
    expect(masterSchedule.find(s => s.id === 'alg-s2')?.enrollment).toBe(0);
  });
});
