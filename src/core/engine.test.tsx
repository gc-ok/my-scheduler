// src/core/engine.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { generateSchedule } from './engine';
import { Teacher, Course, Room, EngineConfig } from '../types';

describe('Scheduling Engine', () => {
  let mockTeachers: Teacher[];
  let mockCourses: Course[];
  let mockRooms: Room[];
  let baseConfig: Omit<EngineConfig, 'teachers' | 'courses' | 'rooms'>;

  // Runs before each test to reset data
  beforeEach(() => {
    mockTeachers = [
      { id: 't1', name: 'Mr. Math', departments: ['Math'] },
      { id: 't2', name: 'Mrs. Science', departments: ['Science'] }
    ];

    mockCourses = [
      { id: 'c1', name: 'Algebra I', department: 'Math', sections: 2, maxSize: 25, required: true },
      { id: 'c2', name: 'Biology', department: 'Science', sections: 1, maxSize: 25, required: true }
    ];

    mockRooms = [
      { id: 'r1', name: 'Room 101', type: 'regular' },
      { id: 'r2', name: 'Lab 1', type: 'lab' }
    ];

    baseConfig = {
      periodsCount: 7,
      schoolStart: "08:00",
      schoolEnd: "15:00",
      periodLength: 50,
      passingTime: 5,
      scheduleType: "standard",
      planPeriodsPerDay: 1,
      studentCount: 50,
      maxClassSize: 30,
      cohorts: [],
      constraints: [],
      periods: [],
      lunchConfig: { style: 'unit', lunchPeriod: 4, lunchPeriods: [4], lunchDuration: 30, numWaves: 1, minClassTime: 15 },
      winConfig: { enabled: false, model: '', afterPeriod: 0, winDuration: 30 },
      recessConfig: { enabled: false, duration: 15, afterPeriod: 0 },
    };
  });
  
  it('should generate the correct number of sections and have no conflicts in a valid setup', () => {
    const config: EngineConfig = {
      ...baseConfig,
      teachers: mockTeachers,
      courses: mockCourses,
      rooms: mockRooms,
      // Lower student count to avoid "unaccounted for" conflicts, which aren't relevant here.
      // Total seats = (2 sections * 25) + (1 section * 25) = 75. 50 students fits comfortably.
      studentCount: 50, 
    };

    const result = generateSchedule(config);

    expect(result).toBeDefined();
    // 2 sections for Algebra I + 1 section for Biology = 3 total
    expect(result.sections.length).toBe(3);
    // With corrected logic and a reasonable student count, there should be no conflicts.
    expect(result.conflicts.length).toBe(0);
  });

  it('should assign teachers to sections correctly and respect departments', () => {
    const config: EngineConfig = {
      ...baseConfig,
      studentCount: 50,
      teachers: mockTeachers,
      courses: mockCourses,
      rooms: mockRooms,
    };

    const result = generateSchedule(config);
    const mathSections = result.sections.filter(s => s.courseId === 'c1');
    const scienceSection = result.sections.find(s => s.courseId === 'c2');

    // Both math sections should be taught by the math teacher
    expect(mathSections.every(s => s.teacher === 't1')).toBe(true);
    // The biology section should be taught by the science teacher
    expect(scienceSection?.teacher).toBe('t2');
  });

  it('should create a "No Teacher" conflict if a section cannot be assigned', () => {
    const config: EngineConfig = {
      ...baseConfig,
      studentCount: 50,
      teachers: [mockTeachers[0]], // Only the math teacher is available
      courses: mockCourses,
      rooms: mockRooms,
    };

    const result = generateSchedule(config);
    // Find the section that should have a conflict
    const scienceSection = result.sections.find(s => s.courseId === 'c2');

    // With the engine fix, this section should now correctly have a conflict
    expect(scienceSection?.hasConflict).toBe(true);
    expect(scienceSection?.conflictReason).toBe("No Teacher");
  });

  it('should generate the correct number of periods', () => {
    const config: EngineConfig = {
      ...baseConfig,
      studentCount: 50,
      periodsCount: 4, // Override base config for a short day
      teachers: mockTeachers,
      courses: mockCourses,
      rooms: mockRooms,
    };

    const result = generateSchedule(config);
    // Check that the period list matches the specified count
    expect(result.periodList.length).toBe(4);
  });

  it('should create a planning period violation conflict when a teacher is overloaded', () => {
    const config: EngineConfig = {
      ...baseConfig,
      studentCount: 50,
      periodsCount: 3,      // 3 periods total
      planPeriodsPerDay: 1,   // Teacher needs 1 plan period
      teachers: [mockTeachers[0]], // Only one teacher
      courses: [ // And that teacher must teach 3 sections
        { id: 'c1', name: 'Alg I', department: 'Math', sections: 3, required: true },
      ],
      rooms: mockRooms,
    };
    
    // With the corrected `effectiveSlots` logic:
    // effectiveSlots = 3 periods - 0 lunch - 0 recess = 3.
    // The teacher teaches 3 sections, so their `teaching` load is 3.
    // `free` periods = effectiveSlots - teaching = 3 - 3 = 0.
    // `expectedFree` = 1.
    // Since 0 < 1, a conflict must be generated.

    const result = generateSchedule(config);
    const planViolation = result.conflicts.find(c => c.type === 'plan_violation');
    
    expect(planViolation).toBeDefined();
    // The message should correctly state the teacher has 0 free periods.
    expect(planViolation?.message).toContain('Mr. Math has 0 free periods (needs 1 for Plan/PLC)');
  });

  it('should create a conflict if section enrollment exceeds room capacity', () => {
    const highEnrollmentCourse: Course[] = [
      { id: 'c1', name: 'Packed Lecture', department: 'Math', sections: 1, maxSize: 30, required: true, roomType: 'lecture_hall' }
    ];
    const smallRoom: Room[] = [
      { id: 'r1', name: 'Small Hall', type: 'lecture_hall', capacity: 20 }
    ];

    const config: EngineConfig = {
      ...baseConfig,
      studentCount: 30, // This will set enrollment to 30
      teachers: [mockTeachers[0]],
      courses: highEnrollmentCourse,
      rooms: smallRoom,
    };

    const result = generateSchedule(config);
    const lectureSection = result.sections.find(s => s.courseId === 'c1');
    const capacityConflict = result.conflicts.find(c => c.type === 'unscheduled');
    
    // The section should fail to schedule because no room has capacity
    expect(lectureSection?.hasConflict).toBe(true);
    expect(lectureSection?.conflictReason).toBe("Scheduling Gridlock");

    // A specific conflict should be logged
    expect(capacityConflict).toBeDefined();
    expect(capacityConflict?.message).toContain('No valid slot found');
  });
});
