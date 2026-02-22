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

export class BaseStrategy {
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
  
  execute(_sections: Section[], _periodList: Period[], _rooms: Room[]): any[] {
    throw new Error("Execute method must be implemented by subclass");
  }

  attemptBacktrack(sec: Section, candidateSlots: string[], sections: Section[], rooms: Room[]): boolean {
    // Shuffle slots to avoid deterministic loops
    const slots = [...candidateSlots].sort(() => Math.random() - 0.5);

    for (const slot of slots) {
      // 1. Check if the blocker is a Teacher Conflict (the most common bottleneck)
      const blockerId = this.tracker.getBlocker(sec.teacher!, slot);
      
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
  execute(sections: Section[], periodList: Period[], rooms: Room[]): any[] {
    const teachingPeriodIds = periodList.map(p => String(p.id));
    teachingPeriodIds.forEach(id => this.secsInPeriod[`FY-ALL-${id}`] = 0);

    const placementOrder = [...sections].filter(s => !s.locked && !s.hasConflict).sort((a,b) => {
      return a.isCore === b.isCore ? 0 : a.isCore ? -1 : 1;
    });

    placementOrder.forEach(sec => {
      let bestSlot: string | null = null;
      let minCost = Infinity;
      let periodEvaluations: any[] = []; 
      
      const shuffled = [...teachingPeriodIds].sort(()=>Math.random()-0.5);

      for(const pid of shuffled) {
        if(pid === "WIN") continue;
        const timeSlotId = `FY-ALL-${pid}`; 
        
        let cost = 0;
        let fails: string[] = [];
        let softFails: string[] = []; 

        // 1. HARD CONSTRAINTS (Must Reject)
        if (!this.tracker.isTeacherAvailable(sec.teacher, timeSlotId)) fails.push("Teacher booked");
        if (sec.coTeacher && !this.tracker.isTeacherAvailable(sec.coTeacher, timeSlotId)) fails.push("Co-Teacher booked");

        if (fails.length > 0) {
          periodEvaluations.push({ period: timeSlotId, cost: Infinity, reasons: fails });
          continue; 
        }

        // 2. SOFT CONSTRAINTS (Adds to Cost Score)
        if (this.tracker.getTeacherLoad(sec.teacher, 'FY') >= this.tracker.maxLoad) { 
          cost += 500; softFails.push("Exceeds target load"); 
        }
        if (sec.room && !this.tracker.isRoomAvailable(sec.room, timeSlotId)) { 
          cost += 100; softFails.push("Preferred room occupied"); 
        }
        const sibs = sections.filter(s => s.courseId === sec.courseId && s.period === timeSlotId).length;
        if (!sec.isCore && sibs > 0) { 
          cost += 200; softFails.push("Elective overlap"); 
        }

        cost += (this.secsInPeriod[timeSlotId] || 0) * 10;
        periodEvaluations.push({ period: timeSlotId, cost, reasons: softFails });

        if(cost < minCost) { minCost = cost; bestSlot = timeSlotId; }
      }

      if (bestSlot) {
        this.secsInPeriod[bestSlot]++;
        
        // Resolve final room
        let finalRoom: string | null | undefined = sec.room;
        if (!finalRoom || !this.tracker.isRoomAvailable(finalRoom, bestSlot)) {
          const availableRooms = rooms.filter(r => r.type === sec.roomType && this.tracker.isRoomAvailable(r.id, bestSlot as string));
          availableRooms.sort((a, b) => (!!this.tracker.roomOwners[b.id] ? 1 : 0) - (!!this.tracker.roomOwners[a.id] ? 1 : 0));
          if(availableRooms.length > 0) finalRoom = availableRooms[0].id; 
        }

        if(finalRoom) { sec.roomName = rooms.find(r=>r.id===finalRoom)?.name; }
        
        this.tracker.assignPlacement(sec, bestSlot, sec.teacher, sec.coTeacher, finalRoom, 'FY');
        this.logger.logPlacement(sec, bestSlot, minCost, periodEvaluations);
      } else {
        // Attempt Backtracking
        const bumped = this.attemptBacktrack(sec, shuffled, sections, rooms);
        if (!bumped) {
          sec.hasConflict = true; sec.conflictReason = "Scheduling Gridlock"; 
          this.conflicts.push({ type: "unscheduled", message: `${sec.courseName} S${sec.sectionNum}: No valid period found`, sectionId: sec.id });
          this.logger.logFailure(sec, periodEvaluations);
        }
      }
    });

    return this.conflicts;
  }
}

export class ABStrategy extends BaseStrategy {
  execute(sections: Section[], periodList: Period[], rooms: Room[]): any[] {
    const timeSlots: string[] = [];
    
    periodList.forEach(p => {
      if (p.id === "WIN" || p.type === "win") return;
      
      const aSlot = `FY-A-${p.id}`;
      const bSlot = `FY-B-${p.id}`;
      timeSlots.push(aSlot, bSlot);
      
      this.secsInPeriod[aSlot] = 0;
      this.secsInPeriod[bSlot] = 0;
    });

    const placementOrder = [...sections].filter(s => !s.locked && !s.hasConflict).sort((a,b) => {
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

        if (!this.tracker.isTeacherAvailable(sec.teacher, slotId)) fails.push("Teacher booked");
        if (sec.coTeacher && !this.tracker.isTeacherAvailable(sec.coTeacher, slotId)) fails.push("Co-Teacher booked");

        if (fails.length > 0) {
          periodEvaluations.push({ period: slotId, cost: Infinity, reasons: fails });
          continue;
        }

        if (this.tracker.getTeacherLoad(sec.teacher, 'FY') >= this.tracker.maxLoad) { 
          cost += 500; softFails.push("Exceeds A/B target load"); 
        }
        if (sec.room && !this.tracker.isRoomAvailable(sec.room, slotId)) { 
          cost += 100; softFails.push("Preferred room occupied"); 
        }
        const sibs = sections.filter(s => s.courseId === sec.courseId && s.period === slotId).length;
        if (!sec.isCore && sibs > 0) { 
          cost += 200; softFails.push("Elective overlap"); 
        }

        cost += (this.secsInPeriod[slotId] || 0) * 10;
        periodEvaluations.push({ period: slotId, cost, reasons: softFails });

        if (cost < minCost) { minCost = cost; bestSlot = slotId; }
      }

      if (bestSlot) {
        this.secsInPeriod[bestSlot]++;
        
        let finalRoom: string | null | undefined = sec.room;
        if (!finalRoom || !this.tracker.isRoomAvailable(finalRoom, bestSlot)) {
          const availableRooms = rooms.filter(r => r.type === sec.roomType && this.tracker.isRoomAvailable(r.id, bestSlot as string));
          availableRooms.sort((a, b) => (!!this.tracker.roomOwners[b.id] ? 1 : 0) - (!!this.tracker.roomOwners[a.id] ? 1 : 0));
          if(availableRooms.length > 0) finalRoom = availableRooms[0].id; 
        }

        if(finalRoom) { sec.roomName = rooms.find(r=>r.id===finalRoom)?.name; }
        
        this.tracker.assignPlacement(sec, bestSlot, sec.teacher, sec.coTeacher, finalRoom, 'FY');
        this.logger.logPlacement(sec, bestSlot, minCost, periodEvaluations);
      } else {
        // Attempt Backtracking
        const bumped = this.attemptBacktrack(sec, shuffledSlots, sections, rooms);
        if (!bumped) {
          sec.hasConflict = true; sec.conflictReason = "A/B Scheduling Gridlock"; 
          this.conflicts.push({ type: "unscheduled", message: `${sec.courseName} S${sec.sectionNum}: No valid A/B slot found`, sectionId: sec.id });
          this.logger.logFailure(sec, periodEvaluations);
        }
      }
    });

    return this.conflicts;
  }
}

export class Block4x4Strategy extends BaseStrategy {
  execute(sections: Section[], periodList: Period[], rooms: Room[]): any[] {
    const timeSlots: string[] = [];
    
    periodList.forEach(p => {
      if (p.id === "WIN" || p.type === "win") return;
      const s1Slot = `S1-ALL-${p.id}`;
      const s2Slot = `S2-ALL-${p.id}`;
      timeSlots.push(s1Slot, s2Slot);
      this.secsInPeriod[s1Slot] = 0;
      this.secsInPeriod[s2Slot] = 0;
    });

    const placementOrder = [...sections].filter(s => !s.locked && !s.hasConflict).sort((a,b) => {
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
        
        const term = slotId.startsWith("S1") ? "S1" : "S2";

        if (!this.tracker.isTeacherAvailable(sec.teacher, slotId)) fails.push("Teacher booked");
        if (sec.coTeacher && !this.tracker.isTeacherAvailable(sec.coTeacher, slotId)) fails.push("Co-Teacher booked");

        if (fails.length > 0) {
          periodEvaluations.push({ period: slotId, cost: Infinity, reasons: fails });
          continue;
        }

        if (this.tracker.getTeacherLoad(sec.teacher, term) >= this.tracker.maxLoad) { 
          cost += 500; softFails.push(`Exceeds ${term} target load`); 
        }
        if (sec.room && !this.tracker.isRoomAvailable(sec.room, slotId)) { 
          cost += 100; softFails.push("Preferred room occupied"); 
        }

        const s1Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("S1")).length;
        const s2Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("S2")).length;
        
        if (term === "S1" && s1Count > s2Count) cost += 150; 
        if (term === "S2" && s2Count > s1Count) cost += 150; 

        cost += (this.secsInPeriod[slotId] || 0) * 10;
        periodEvaluations.push({ period: slotId, cost, reasons: softFails });

        if (cost < minCost) { minCost = cost; bestSlot = slotId; }
      }

      if (bestSlot) {
        this.secsInPeriod[bestSlot]++;
        const term = bestSlot.startsWith("S1") ? "S1" : "S2";
        
        let finalRoom: string | null | undefined = sec.room;
        if (!finalRoom || !this.tracker.isRoomAvailable(finalRoom, bestSlot)) {
          const availableRooms = rooms.filter(r => r.type === sec.roomType && this.tracker.isRoomAvailable(r.id, bestSlot as string));
          availableRooms.sort((a, b) => (!!this.tracker.roomOwners[b.id] ? 1 : 0) - (!!this.tracker.roomOwners[a.id] ? 1 : 0));
          if(availableRooms.length > 0) finalRoom = availableRooms[0].id; 
        }

        if(finalRoom) sec.roomName = rooms.find(r=>r.id===finalRoom)?.name;
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

export class TrimesterStrategy extends BaseStrategy {
  execute(sections: Section[], periodList: Period[], rooms: Room[]): any[] {
    const timeSlots: string[] = [];
    
    periodList.forEach(p => {
      if (p.id === "WIN" || p.type === "win") return;
      const t1Slot = `T1-ALL-${p.id}`;
      const t2Slot = `T2-ALL-${p.id}`;
      const t3Slot = `T3-ALL-${p.id}`;
      timeSlots.push(t1Slot, t2Slot, t3Slot);
      this.secsInPeriod[t1Slot] = 0;
      this.secsInPeriod[t2Slot] = 0;
      this.secsInPeriod[t3Slot] = 0;
    });

    const placementOrder = [...sections].filter(s => !s.locked && !s.hasConflict).sort((a,b) => {
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
        
        const term = slotId.startsWith("T1") ? "T1" : slotId.startsWith("T2") ? "T2" : "T3";

        if (!this.tracker.isTeacherAvailable(sec.teacher, slotId)) fails.push("Teacher booked");
        if (sec.coTeacher && !this.tracker.isTeacherAvailable(sec.coTeacher, slotId)) fails.push("Co-Teacher booked");

        if (fails.length > 0) {
          periodEvaluations.push({ period: slotId, cost: Infinity, reasons: fails });
          continue;
        }

        if (this.tracker.getTeacherLoad(sec.teacher, term) >= this.tracker.maxLoad) { 
          cost += 500; softFails.push(`Exceeds ${term} target load`); 
        }
        if (sec.room && !this.tracker.isRoomAvailable(sec.room, slotId)) { 
          cost += 100; softFails.push("Preferred room occupied"); 
        }

        const t1Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("T1")).length;
        const t2Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("T2")).length;
        const t3Count = sections.filter(s => s.courseId === sec.courseId && String(s.period).startsWith("T3")).length;
        
        if (term === "T1" && t1Count > (t2Count + t3Count)/2) cost += 150; 
        if (term === "T2" && t2Count > (t1Count + t3Count)/2) cost += 150; 
        if (term === "T3" && t3Count > (t1Count + t2Count)/2) cost += 150; 

        cost += (this.secsInPeriod[slotId] || 0) * 10;
        periodEvaluations.push({ period: slotId, cost, reasons: softFails });

        if (cost < minCost) { minCost = cost; bestSlot = slotId; }
      }

      if (bestSlot) {
        this.secsInPeriod[bestSlot]++;
        const term = bestSlot.startsWith("T1") ? "T1" : bestSlot.startsWith("T2") ? "T2" : "T3";
        
        let finalRoom: string | null | undefined = sec.room;
        if (!finalRoom || !this.tracker.isRoomAvailable(finalRoom, bestSlot)) {
          const availableRooms = rooms.filter(r => r.type === sec.roomType && this.tracker.isRoomAvailable(r.id, bestSlot as string));
          availableRooms.sort((a, b) => (!!this.tracker.roomOwners[b.id] ? 1 : 0) - (!!this.tracker.roomOwners[a.id] ? 1 : 0));
          if(availableRooms.length > 0) finalRoom = availableRooms[0].id; 
        }

        if(finalRoom) sec.roomName = rooms.find(r=>r.id===finalRoom)?.name;
        this.tracker.assignPlacement(sec, bestSlot, sec.teacher, sec.coTeacher, finalRoom, term);
        this.logger.logPlacement(sec, bestSlot, minCost, periodEvaluations);
      } else {
        sec.hasConflict = true; sec.conflictReason = "Trimester Gridlock"; 
        this.conflicts.push({ type: "unscheduled", message: `${sec.courseName} S${sec.sectionNum}: No valid Trimester slot found`, sectionId: sec.id });
        this.logger.logFailure(sec, periodEvaluations);
      }
    });

    return this.conflicts;
  }
}