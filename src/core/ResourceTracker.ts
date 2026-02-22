// src/core/ResourceTracker.ts
import { Teacher, Room, Section } from '../types';

export class ResourceTracker {
  teacherSchedule: Record<string, Record<string, string>>; 
  roomSchedule: Record<string, Record<string, string>>;    
  teacherLoad: Record<string, Record<string, number>>;     
  roomOwners: Record<string, string>;
  maxLoad: number;

  constructor(teachers: Teacher[], rooms: Room[], maxLoad: number) {
    this.teacherSchedule = {}; 
    this.roomSchedule = {};    
    this.teacherLoad = {};     
    this.roomOwners = {};
    
    // In block/trimesters, maxLoad is per term.
    this.maxLoad = maxLoad; 

    teachers.forEach(t => {
      this.teacherSchedule[t.id] = {};
      // Track loads independently for every possible term
      this.teacherLoad[t.id] = { FY: 0, S1: 0, S2: 0, T1: 0, T2: 0, T3: 0, A: 0, B: 0 };
    });
    
    rooms.forEach(r => {
      this.roomSchedule[r.id] = {};
    });
  }

  setRoomOwner(roomId: string, teacherId: string) {
    this.roomOwners[roomId] = teacherId;
  }

  blockTeacher(teacherId: string, timeSlotId: string | number, reason: string = "BLOCKED") {
    if (!this.teacherSchedule[teacherId]) return;
    this.teacherSchedule[teacherId][String(timeSlotId)] = reason;
  }

  isTeacherAvailable(teacherId: string | null | undefined, timeSlotId: string | number): boolean {
    if (!teacherId || !this.teacherSchedule[teacherId]) return false;
    return !this.teacherSchedule[teacherId][String(timeSlotId)];
  }

  isRoomAvailable(roomId: string | null | undefined, timeSlotId: string | number): boolean {
    if (!roomId || !this.roomSchedule[roomId]) return false;
    return !this.roomSchedule[roomId][String(timeSlotId)];
  }

  getBlocker(resourceId: string, timeSlotId: string | number): string | null {
    if (!this.teacherSchedule[resourceId]) return null;
    return this.teacherSchedule[resourceId][String(timeSlotId)] || null;
  }

  // UPDATED: Now requires the term being queried
  getTeacherLoad(teacherId: string | null | undefined, term: string = 'FY'): number {
    if (!teacherId || !this.teacherLoad[teacherId]) return 0;
    return this.teacherLoad[teacherId][term] || 0;
  }

  // UPDATED: Now increments the specific term's load
  assignPlacement(section: Section, timeSlotId: string | number, teacherId: string | null | undefined, coTeacherId: string | null | undefined, roomId: string | null | undefined, term: string = 'FY') {
    const slotIdStr = String(timeSlotId);
    
    if (teacherId && this.teacherSchedule[teacherId]) {
      this.teacherSchedule[teacherId][slotIdStr] = section.id;
      if (this.teacherLoad[teacherId]) {
        this.teacherLoad[teacherId][term] = (this.teacherLoad[teacherId][term] || 0) + 1;
      }
    }
    
    if (coTeacherId && this.teacherSchedule[coTeacherId]) {
      this.teacherSchedule[coTeacherId][slotIdStr] = section.id;
      if (this.teacherLoad[coTeacherId]) {
        this.teacherLoad[coTeacherId][term] = (this.teacherLoad[coTeacherId][term] || 0) + 1;
      }
    }
    
    if (roomId && this.roomSchedule[roomId]) {
      this.roomSchedule[roomId][slotIdStr] = section.id;
    }
    
    section.period = timeSlotId;
    
    // Using a quick any cast here just in case 'term' isn't explicitly in your Section interface yet
    (section as any).term = term; 
  }

  removePlacement(sectionId: string, timeSlotId: string | number, teacherId: string | null | undefined, coTeacherId: string | null | undefined, roomId: string | null | undefined, term: string = 'FY') {
    const slotIdStr = String(timeSlotId);

    if (teacherId && this.teacherSchedule[teacherId] && this.teacherSchedule[teacherId][slotIdStr] === sectionId) {
      delete this.teacherSchedule[teacherId][slotIdStr];
      if (this.teacherLoad[teacherId]) {
        this.teacherLoad[teacherId][term] = Math.max(0, (this.teacherLoad[teacherId][term] || 0) - 1);
      }
    }

    if (coTeacherId && this.teacherSchedule[coTeacherId] && this.teacherSchedule[coTeacherId][slotIdStr] === sectionId) {
      delete this.teacherSchedule[coTeacherId][slotIdStr];
      if (this.teacherLoad[coTeacherId]) {
        this.teacherLoad[coTeacherId][term] = Math.max(0, (this.teacherLoad[coTeacherId][term] || 0) - 1);
      }
    }

    if (roomId && this.roomSchedule[roomId] && this.roomSchedule[roomId][slotIdStr] === sectionId) {
      delete this.roomSchedule[roomId][slotIdStr];
    }
  }
}