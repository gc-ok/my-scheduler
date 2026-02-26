// src/core/strategies/Block4x4Strategy.ts
//
// ⚠️  DEAD CODE — This file is NOT imported anywhere.
//
// The active Block4x4Strategy is defined inside ScheduleStrategies.ts and imported
// from there by engine.ts.  That version inherits BaseStrategy.execute() which gives
// it full backtracking, room-capacity checks, cohort tracking, parallel block support,
// travel-time checking, and course-relationship costs that this standalone file lacks.
//
// Do NOT wire this file in without first reconciling it with BaseStrategy.execute().
// It is kept here only for reference.
//
import { BaseStrategy, ScheduleConflict } from './ScheduleStrategies';
import { Section, Period, Room } from '../../types';

export class Block4x4Strategy extends BaseStrategy {
  generateTimeSlots(periodList: Period[]): string[] {
    const timeSlots: string[] = [];
    periodList.forEach(p => {
      timeSlots.push(`S1-ALL-${p.id}`, `S2-ALL-${p.id}`);
    });
    return timeSlots;
  }

  execute(sections: Section[], periodList: Period[], rooms: Room[]): ScheduleConflict[] {
    const timeSlots: string[] = [];
    
    // 1. Generate Semester 1 and Semester 2 Universal TimeSlots
    periodList.forEach(p => {
      if (p.id === "WIN" || p.type === "win") return;
      const s1Slot = `S1-ALL-${p.id}`;
      const s2Slot = `S2-ALL-${p.id}`;
      timeSlots.push(s1Slot, s2Slot);
      this.secsInPeriod[s1Slot] = 0;
      this.secsInPeriod[s2Slot] = 0;
    });

    const placementOrder = [...sections].filter(s => !s.locked && !s.hasConflict).sort((a,b) => {
      // 1. Singletons First
      if (!!a.isSingleton !== !!b.isSingleton) return a.isSingleton ? -1 : 1;
      // 2. Core vs Elective
      return a.isCore === b.isCore ? 0 : a.isCore ? -1 : 1;
    });

    placementOrder.forEach(sec => {
      let bestSlot: string | null = null;
      let minCost = Infinity;
      let periodEvaluations: { period: string; cost: number; reasons: string[] }[] = [];
      
      const shuffledSlots = this.shuffle(timeSlots);

      for (const slotId of shuffledSlots) {
        let cost = 0;
        let fails: string[] = [];
        let softFails: string[] = [];
        
        // Extract the term (S1 or S2) from the slot string
        const term = slotId.startsWith("S1") ? "S1" : "S2";

        // 1. HARD CONSTRAINTS
        if (!this.tracker.isTeacherAvailable(sec.teacher, slotId)) fails.push("Teacher booked");
        if (sec.coTeacher && !this.tracker.isTeacherAvailable(sec.coTeacher, slotId)) fails.push("Co-Teacher booked");

        if (fails.length > 0) {
          periodEvaluations.push({ period: slotId, cost: Infinity, reasons: fails });
          continue;
        }

        // 2. SOFT CONSTRAINTS & TERM BALANCING
        // Check load for THIS specific semester
        if (this.tracker.getTeacherLoad(sec.teacher, term) >= this.tracker.maxLoad) { 
          cost += 500; softFails.push(`Exceeds ${term} target load`); 
        }
        
        if (sec.room && !this.tracker.isRoomAvailable(sec.room, slotId)) { 
          cost += 100; softFails.push("Preferred room occupied"); 
        }

        // Term Balancing: Try to keep the same course evenly distributed between S1 and S2
        const s1Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("S1")).length;
        const s2Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("S2")).length;
        
        if (term === "S1" && s1Count > s2Count) cost += 150; // Penalize S1 if it's getting heavy
        if (term === "S2" && s2Count > s1Count) cost += 150; // Penalize S2 if it's getting heavy

        // 3. SINGLETON SPREADING
        if (sec.isSingleton) {
          const placedSingletons = sections.filter(s => s.period === slotId && s.isSingleton);
          const deptConflict = placedSingletons.some(s => s.department === sec.department);
          if (deptConflict) { cost += 1000; softFails.push("Dept Singleton Conflict"); }
          cost += (placedSingletons.length * 50);
        }

        cost += (this.secsInPeriod[slotId] || 0) * 10;
        periodEvaluations.push({ period: slotId, cost, reasons: softFails });

        if (cost < minCost) { minCost = cost; bestSlot = slotId; }
      }

      // 3. FINAL PLACEMENT
      if (bestSlot) {
        this.secsInPeriod[bestSlot]++;
        const term = bestSlot.startsWith("S1") ? "S1" : "S2";
        
        let finalRoom = sec.room;
        if (!finalRoom || !this.tracker.isRoomAvailable(finalRoom, bestSlot)) {
          const availableRooms = rooms.filter(r => r.type === sec.roomType && this.tracker.isRoomAvailable(r.id, bestSlot));
          availableRooms.sort((a, b) => (!!this.tracker.roomOwners[b.id] ? 1 : 0) - (!!this.tracker.roomOwners[a.id] ? 1 : 0));
          if(availableRooms.length > 0) finalRoom = availableRooms[0].id; 
        }

        if(finalRoom) { sec.roomName = rooms.find(r=>r.id===finalRoom)?.name; }
        
        this.tracker.assignPlacement(sec, bestSlot, sec.teacher, sec.coTeacher, finalRoom, term);
        this.logger.logPlacement(sec, bestSlot, minCost, periodEvaluations);
      } else {
        sec.hasConflict = true; sec.conflictReason = "Semester Block Gridlock"; 
        this.conflicts.push({ type: "unscheduled", message: `${sec.courseName} S${sec.sectionNum}: No valid S1/S2 slot found`, sectionId: sec.id });
        this.logger.logFailure(sec, periodEvaluations);
      }
    });

    return this.conflicts;
  }
}