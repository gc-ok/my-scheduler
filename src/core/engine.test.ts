// src/core/engine.test.ts
import { describe, it, expect } from 'vitest';
import { generateSchedule } from './engine';
import { ScheduleConfig, Teacher, Course, Room } from '../types';

// Mock Data
const mockTeachers: Teacher[] = [
  { id: 't1', name: 'Mr. Math', departments: ['Math'], planPeriods: 1 },
  { id: 't2', name: 'Mrs. Science', departments: ['Science'], planPeriods: 1 }
];

const mockCourses: Course[] = [
  { id: 'c1', name: 'Algebra I', department: 'Math', sections: 2, maxSize: 30, required: true },
  { id: 'c2', name: 'Biology', department: 'Science', sections: 1, maxSize: 30, required: true }
];

const mockRooms: Room[] = [
  { id: 'r1', name: 'Room 101', type: 'regular' },
  { id: 'r2', name: 'Lab 1', type: 'lab' }
];

describe('Scheduling Engine', () => {
  
  it('should generate a valid schedule structure', () => {
    const config: ScheduleConfig = {
      teachers: mockTeachers,
      courses: mockCourses,
      rooms: mockRooms,
      periodsCount: 7,
      schoolStart: "08:00",
      periodLength: 50,
      passingTime: 5,
      scheduleType: "standard",
      studentCount: 100
    };

    const result = generateSchedule(config);

    expect(result).toBeDefined();
    expect(result.sections.length).toBe(3); // 2 Math + 1 Science
    expect(result.conflicts).toBeDefined();
  });

  it('should assign teachers to sections correctly', () => {
    const config: ScheduleConfig = {
      teachers: mockTeachers,
      courses: mockCourses,
      rooms: mockRooms,
      periodsCount: 7
    };

    const result = generateSchedule(config);
    const mathSection = result.sections.find(s => s.courseId === 'c1');
    
    expect(mathSection?.teacher).toBe('t1');
    expect(mathSection?.department).toBe('Math');
  });

  it('should detect conflicts if no teachers exist', () => {
    const config: ScheduleConfig = {
      teachers: [], // Empty
      courses: mockCourses,
      rooms: mockRooms,
      periodsCount: 7
    };

    const result = generateSchedule(config);
    const section = result.sections[0];
    
    expect(section.hasConflict).toBe(true);
    expect(section.conflictReason).toBe("No Teacher");
  });

  it('should respect period counts', () => {
    const config: ScheduleConfig = {
      teachers: mockTeachers,
      courses: mockCourses,
      rooms: mockRooms,
      periodsCount: 4 // Short day
    };

    const result = generateSchedule(config);
    expect(result.periodList.length).toBe(4);
  });
});
