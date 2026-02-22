// src/core/strategies/ScheduleStrategies.ts
import { ResourceTracker } from '../ResourceTracker';
import { Section, Period, Room, ScheduleConfig } from '../../types';

const getTermFromSlot = (slot: string) => {
  if (slot.startsWith("S1")) return "S1";
  if (slot.startsWith("S2")) return "S2";
  if (slot.startsWith("T1")) return "T1";
  if (slot.startsWith("T2")) return "T2";
  if (slot.startsWith("T3")) return "T3";
  return "FY";
};

export abstract class BaseStrategy {
  tracker: ResourceTracker;
  config: ScheduleConfig;
  logger: any; // Keeping logger flexible for now
  conflicts: any[];
  secsInPeriod: Record<string, number>;

  constructor(tracker: ResourceTracker, config: ScheduleConfig, logger: any) {
    this.tracker = tracker;
    this.config = config;
    this.logger = logger;
    this.conflicts = [];
    this.secsInPeriod = {};
  }
  
  // Abstract methods to be implemented by subclasses
  abstract generateTimeSlots(periodList: Period[]): string[];
  
  // Hook for term-specific load checking (e.g. "S1", "T2", or "FY")
  getLoadTerm(slot: string): string {
    return "FY";
  }

  // Hook for strategy-specific costs (e.g. term balancing)
  calculateCustomCost(sec: Section, slot: string, sections: Section[]): { cost: number, reasons: string[] } {
    return { cost: 0, reasons: [] };
  }

  execute(sections: Section[], periodList: Period[], rooms: Room[]): any[] {
    const schedulablePeriods = periodList.filter(p => p.id !== "WIN" && p.type !== "win" && p.type !== "recess");
    const timeSlots = this.generateTimeSlots(schedulablePeriods);
    timeSlots.forEach(slot => this.secsInPeriod[slot] = 0);

    const placementOrder = [...sections].filter(s => !s.locked && !s.hasConflict).sort((a,b) => {
      // 0. Double Blocks (Hardest to schedule)
      if (!!a.isDoubleBlock !== !!b.isDoubleBlock) return a.isDoubleBlock ? -1 : 1;
      // 1. Singletons (High Priority)
      if (!!a.isSingleton !== !!b.isSingleton) return a.isSingleton ? -1 : 1;
      // 2. Core vs Elective
      return a.isCore === b.isCore ? 0 : a.isCore ? -1 : 1;
    });

    placementOrder.forEach(sec => {
      let bestSlot: string | null = null;
      let minCost = Infinity;
      let periodEvaluations: any[] = []; 
      
      const shuffledSlots = [...timeSlots].sort(() => Math.random() - 0.5);

      for (const slotId of shuffledSlots) {
        let cost = 0;
        let fails: string[] = [];
        let softFails: string[] = [];

        // 1. HARD CONSTRAINTS
        if (!this.tracker.isTeacherAvailable(sec.teacher, slotId)) fails.push("Teacher booked");
        if (sec.coTeacher && !this.tracker.isTeacherAvailable(sec.coTeacher, slotId)) fails.push("Co-Teacher booked");

        if (fails.length > 0) {
          periodEvaluations.push({ period: slotId, cost: Infinity, reasons: fails });
          continue;
        }

        // 2. SOFT CONSTRAINTS
        const term = this.getLoadTerm(slotId);
        if (this.tracker.getTeacherLoad(sec.teacher, term) >= this.tracker.maxLoad) { 
          cost += 500; softFails.push(`Exceeds ${term} target load`); 
        }
        if (sec.room && !this.tracker.isRoomAvailable(sec.room, slotId)) { 
          cost += 100; softFails.push("Preferred room occupied"); 
        }

        // 3. SINGLETON SPREADING
        if (sec.isSingleton) {
          const placedSingletons = sections.filter(s => s.period === slotId && s.isSingleton);
          const deptConflict = placedSingletons.some(s => s.department === sec.department);
          if (deptConflict) { cost += 1000; softFails.push("Dept Singleton Conflict"); }
          cost += (placedSingletons.length * 50);
        }

        // 4. GENERAL CONGESTION
        cost += (this.secsInPeriod[slotId] || 0) * 10;

        // 5. CONFLICT MATRIX (Course Relationships)
        if (this.config.courseRelationships && this.config.courseRelationships.length > 0) {
          const placedInSlot = sections.filter(s => s.period === slotId);
          this.config.courseRelationships.forEach(rel => {
            if (rel.courseIds.includes(sec.courseId)) {
              // Check if any other course in this relationship is already in this slot
              const conflict = placedInSlot.find(s => rel.courseIds.includes(s.courseId) && s.courseId !== sec.courseId);
              if (conflict && rel.type === "avoid_overlap") {
                cost += (rel.penalty || 1000);
                softFails.push(`Conflict Matrix: ${rel.type}`);
              }
            }
          });
        }

        // 5. STRATEGY SPECIFIC COSTS
        const custom = this.calculateCustomCost(sec, slotId, sections);
        cost += custom.cost;
        softFails.push(...custom.reasons);

        periodEvaluations.push({ period: slotId, cost, reasons: softFails });

        if (cost < minCost) { minCost = cost; bestSlot = slotId; }
      }

      if (bestSlot) {
        this.placeSection(sec, bestSlot, rooms, minCost, periodEvaluations);
      } else {
        const bumped = this.attemptBacktrack(sec, shuffledSlots, sections, rooms);
        if (!bumped) {
          sec.hasConflict = true; sec.conflictReason = "Scheduling Gridlock"; 
          this.conflicts.push({ type: "unscheduled", message: `${sec.courseName} S${sec.sectionNum}: No valid slot found`, sectionId: sec.id });
          this.logger.logFailure(sec, periodEvaluations);
        }
      }
    });

    return this.conflicts;
  }

  placeSection(sec: Section, slot: string, rooms: Room[], cost: number, evals: any[]) {
    this.secsInPeriod[slot]++;
    const term = getTermFromSlot(slot);
    
    let finalRoom: string | null | undefined = sec.room;
    if (!finalRoom || !this.tracker.isRoomAvailable(finalRoom, slot)) {
      const availableRooms = rooms.filter(r => r.type === sec.roomType && this.tracker.isRoomAvailable(r.id, slot));
      availableRooms.sort((a, b) => (!!this.tracker.roomOwners[b.id] ? 1 : 0) - (!!this.tracker.roomOwners[a.id] ? 1 : 0));
      if(availableRooms.length > 0) finalRoom = availableRooms[0].id; 
    }

    if(finalRoom) { sec.roomName = rooms.find(r=>r.id===finalRoom)?.name; }
    
    this.tracker.assignPlacement(sec, slot, sec.teacher, sec.coTeacher, finalRoom, term);
    this.logger.logPlacement(sec, slot, cost, evals);
  }

  attemptBacktrack(sec: Section, candidateSlots: string[], sections: Section[], rooms: Room[]): boolean {
    // Shuffle slots to avoid deterministic loops
    const slots = [...candidateSlots].sort(() => Math.random() - 0.5);

    for (const slot of slots) {
      // 1. Check if the blocker is a Teacher Conflict (the most common bottleneck)
      let blockerId = this.tracker.getBlocker(sec.teacher!, slot);

      // NEW: Check Co-Teacher blocker if main teacher is free
      if (!blockerId && sec.coTeacher) {
        blockerId = this.tracker.getBlocker(sec.coTeacher, slot);
      }
      
      // We can only bump if it's a Section, not a hard block like LUNCH or PLC
      if (!blockerId || ["LUNCH", "PLC", "PLAN", "BLOCKED"].includes(blockerId)) continue;

      // 2. Identify the Victim
      const victim = sections.find(s => s.id === blockerId);
      if (!victim || victim.locked) continue;

      // 3. Try to move the Victim
      const victimSlots = candidateSlots.filter(s => s !== slot);
      let victimNewSlot: string | null = null;
      let victimNewRoom: string | null = null;

      for (const vSlot of victimSlots) {
        // Check Teacher Availability for Victim in new slot
        if (!this.tracker.isTeacherAvailable(victim.teacher, vSlot)) continue;
        if (victim.coTeacher && !this.tracker.isTeacherAvailable(victim.coTeacher, vSlot)) continue;
        
        // Check Room Availability for Victim
        if (victim.room) {
           if (!this.tracker.isRoomAvailable(victim.room, vSlot)) continue;
           victimNewRoom = victim.room;
        } else {
           const availableRooms = rooms.filter(r => r.type === victim.roomType && this.tracker.isRoomAvailable(r.id, vSlot));
           if (availableRooms.length === 0) continue;
           victimNewRoom = availableRooms[0].id;
        }

        victimNewSlot = vSlot;
        break;
      }

      if (victimNewSlot) {
        // 4. EXECUTE THE BUMP
        this.logger.info(`♻️ Backtracking: Bumping ${victim.courseName} from ${slot} to ${victimNewSlot}`);
        
        const oldTerm = getTermFromSlot(slot);
        const newTerm = getTermFromSlot(victimNewSlot);

        this.tracker.removePlacement(victim.id, slot, victim.teacher, victim.coTeacher, victim.room, oldTerm);
        this.tracker.assignPlacement(victim, victimNewSlot, victim.teacher, victim.coTeacher, victimNewRoom, newTerm);
        if (victimNewRoom) victim.roomName = rooms.find(r => r.id === victimNewRoom)?.name;

        // 5. Place the original Section in the now-free slot
        let secRoom = sec.room;
        if (!secRoom) {
           const availableRooms = rooms.filter(r => r.type === sec.roomType && this.tracker.isRoomAvailable(r.id, slot));
           if (availableRooms.length > 0) secRoom = availableRooms[0].id;
        }
        
        if (secRoom) sec.roomName = rooms.find(r => r.id === secRoom)?.name;
        this.tracker.assignPlacement(sec, slot, sec.teacher, sec.coTeacher, secRoom, oldTerm);
        
        this.logger.logPlacement(sec, slot, 999, [{ period: slot, cost: 0, reasons: ["Backtracked"] }]);
        return true;
      }
    }
    return false;
  }
}

export class StandardStrategy extends BaseStrategy {
  generateTimeSlots(periodList: Period[]): string[] {
    return periodList.map(p => `FY-ALL-${p.id}`);
  }

  calculateCustomCost(sec: Section, slot: string, sections: Section[]): { cost: number; reasons: string[]; } {
    const sibs = sections.filter(s => s.courseId === sec.courseId && s.period === slot).length;
    if (!sec.isCore && sibs > 0) { 
      return { cost: 200, reasons: ["Elective overlap"] };
    }
    return { cost: 0, reasons: [] };
  }
}

export class ABStrategy extends BaseStrategy {
  generateTimeSlots(periodList: Period[]): string[] {
    const timeSlots: string[] = [];
    periodList.forEach(p => {
      timeSlots.push(`FY-A-${p.id}`, `FY-B-${p.id}`);
    });
    return timeSlots;
  }

  calculateCustomCost(sec: Section, slot: string, sections: Section[]): { cost: number; reasons: string[]; } {
    const sibs = sections.filter(s => s.courseId === sec.courseId && s.period === slot).length;
    if (!sec.isCore && sibs > 0) { 
      return { cost: 200, reasons: ["Elective overlap"] };
    }
    return { cost: 0, reasons: [] };
  }
}

export class Block4x4Strategy extends BaseStrategy {
  generateTimeSlots(periodList: Period[]): string[] {
    const timeSlots: string[] = [];
    periodList.forEach(p => {
      timeSlots.push(`S1-ALL-${p.id}`, `S2-ALL-${p.id}`);
    });
    return timeSlots;
  }

  getLoadTerm(slot: string): string {
    return slot.startsWith("S1") ? "S1" : "S2";
  }

  calculateCustomCost(sec: Section, slot: string, sections: Section[]): { cost: number; reasons: string[]; } {
    const term = this.getLoadTerm(slot);
    const s1Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("S1")).length;
    const s2Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("S2")).length;
    
    if (term === "S1" && s1Count > s2Count) return { cost: 150, reasons: [] };
    if (term === "S2" && s2Count > s1Count) return { cost: 150, reasons: [] };

    return { cost: 0, reasons: [] };
  }
}

export class TrimesterStrategy extends BaseStrategy {
  generateTimeSlots(periodList: Period[]): string[] {
    const timeSlots: string[] = [];
    periodList.forEach(p => {
      timeSlots.push(`T1-ALL-${p.id}`, `T2-ALL-${p.id}`, `T3-ALL-${p.id}`);
    });
    return timeSlots;
  }

  getLoadTerm(slot: string): string {
    if (slot.startsWith("T1")) return "T1";
    if (slot.startsWith("T2")) return "T2";
    return "T3";
  }

  calculateCustomCost(sec: Section, slot: string, sections: Section[]): { cost: number; reasons: string[]; } {
    const term = this.getLoadTerm(slot);
    const t1Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("T1")).length;
    const t2Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("T2")).length;
    const t3Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("T3")).length;
    
    if (term === "T1" && t1Count > (t2Count + t3Count)/2) return { cost: 150, reasons: [] };
    if (term === "T2" && t2Count > (t1Count + t3Count)/2) return { cost: 150, reasons: [] };
    if (term === "T3" && t3Count > (t1Count + t2Count)/2) return { cost: 150, reasons: [] };
    
    return { cost: 0, reasons: [] };
  }
}