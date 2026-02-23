// src/core/strategies/ScheduleStrategies.ts
import { ResourceTracker } from '../ResourceTracker';
import { Section, Period, Room, EngineConfig } from '../../types';

const getTermFromSlot = (slot: string) => {
  if (slot.startsWith("S1")) return "S1";
  if (slot.startsWith("S2")) return "S2";
  if (slot.startsWith("T1")) return "T1";
  if (slot.startsWith("T2")) return "T2";
  if (slot.startsWith("T3")) return "T3";
  return "FY";
};

interface PeriodEvaluation {
  period: string;
  cost: number;
  reasons: string[];
}

export interface ScheduleLogger {
  info(msg: string, data?: Record<string, unknown> | null): void;
  warn(msg: string, data?: Record<string, unknown> | null): void;
  error(msg: string, data?: Record<string, unknown> | null): void;
  logPlacement(section: Section, period: string | number, finalCost: number, evaluations: PeriodEvaluation[]): void;
  logFailure(section: Section, evaluations: PeriodEvaluation[]): void;
}

export interface ScheduleConflict {
  type: string;
  message: string;
  sectionId?: string;
}

export abstract class BaseStrategy {
  tracker: ResourceTracker;
  config: EngineConfig;
  logger: ScheduleLogger;
  conflicts: ScheduleConflict[];
  secsInPeriod: Record<string, number>;
  rng: () => number;

  constructor(tracker: ResourceTracker, config: EngineConfig, logger: ScheduleLogger, rng?: () => number) {
    this.tracker = tracker;
    this.config = config;
    this.logger = logger;
    this.conflicts = [];
    this.secsInPeriod = {};
    this.rng = rng || Math.random;
  }

  /** Fisher-Yates shuffle using the seeded RNG */
  protected shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  
  // Abstract methods to be implemented by subclasses
  abstract generateTimeSlots(periodList: Period[]): string[];
  
  // Hook for term-specific load checking (e.g. "S1", "T2", or "FY")
  getLoadTerm(_slot: string): string {
    return "FY";
  }

  // Hook for strategy-specific costs (e.g. term balancing)
  calculateCustomCost(_sec: Section, _slot: string, _sections: Section[]): { cost: number, reasons: string[] } {
    return { cost: 0, reasons: [] };
  }

  // NEW: Check if teacher has enough travel time between periods
  checkTravelTime(teacherId: string | null, slotId: string, periodList: Period[]): boolean {
    if (!teacherId) return true;
    const teacher = this.config.teachers?.find(t => t.id === teacherId);
    if (!teacher || !teacher.travelTime) return true;
    
    const passing = this.config.passingTime || 5;
    if (teacher.travelTime <= passing) return true;

    // Extract Period ID and Prefix from Slot ID (e.g., "FY-A-1" -> prefix="FY-A-", id=1)
    const lastDash = slotId.lastIndexOf('-');
    if (lastDash === -1) return true;
    
    const prefix = slotId.substring(0, lastDash + 1);
    const pIdStr = slotId.substring(lastDash + 1);
    const pId = isNaN(Number(pIdStr)) ? pIdStr : Number(pIdStr);

    const pIndex = periodList.findIndex(p => p.id == pId);
    if (pIndex === -1) return true;

    // Check Previous Period for conflict
    if (pIndex > 0) {
      const prevSlot = `${prefix}${periodList[pIndex - 1].id}`;
      // If teacher is NOT available in previous slot, it means they are booked/blocked.
      // Since travel time > passing time, they cannot be in this current slot.
      if (!this.tracker.isTeacherAvailable(teacherId, prevSlot)) return false;
    }

    // Check Next Period for conflict
    if (pIndex < periodList.length - 1) {
      const nextSlot = `${prefix}${periodList[pIndex + 1].id}`;
      if (!this.tracker.isTeacherAvailable(teacherId, nextSlot)) return false;
    }

    return true;
  }

  execute(sections: Section[], periodList: Period[], rooms: Room[]): ScheduleConflict[] {
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
      let periodEvaluations: PeriodEvaluation[] = [];
      
      const shuffledSlots = this.shuffle(timeSlots);

      for (const slotId of shuffledSlots) {
        let cost = 0;
        let fails: string[] = [];
        let softFails: string[] = [];

        // 1. HARD CONSTRAINTS
        if (!this.tracker.isTeacherAvailable(sec.teacher, slotId)) fails.push("Teacher booked");
        if (sec.coTeacher && !this.tracker.isTeacherAvailable(sec.coTeacher, slotId)) fails.push("Co-Teacher booked");
        if (!this.checkTravelTime(sec.teacher, slotId, periodList)) fails.push("Travel time violation");

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

  placeSection(sec: Section, slot: string, rooms: Room[], cost: number, evals: PeriodEvaluation[]) {
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

  private static readonly MAX_BACKTRACK_DEPTH = 3;
  private static readonly HARD_BLOCKS = ["LUNCH", "PLC", "PLAN", "BLOCKED"];

  attemptBacktrack(sec: Section, candidateSlots: string[], sections: Section[], rooms: Room[]): boolean {
    return this.backtrackChain(sec, candidateSlots, sections, rooms, BaseStrategy.MAX_BACKTRACK_DEPTH, new Set());
  }

  /**
   * Multi-level backtracking: tries to free a slot for `sec` by displacing
   * a chain of up to `depth` sections. Uses `visited` to prevent cycles.
   */
  private backtrackChain(
    sec: Section, candidateSlots: string[], sections: Section[],
    rooms: Room[], depth: number, visited: Set<string>
  ): boolean {
    if (depth <= 0) return false;
    visited.add(sec.id);

    const slots = this.shuffle(candidateSlots);

    for (const slot of slots) {
      // 1. Identify the blocker in this slot
      let blockerId = this.tracker.getBlocker(sec.teacher!, slot);
      if (!blockerId && sec.coTeacher) {
        blockerId = this.tracker.getBlocker(sec.coTeacher, slot);
      }
      if (!blockerId || BaseStrategy.HARD_BLOCKS.includes(blockerId)) continue;

      // 2. Find the victim section
      const victim = sections.find(s => s.id === blockerId);
      if (!victim || victim.locked || visited.has(victim.id)) continue;

      // 3. Try to move the victim directly first (cheapest option)
      const victimSlots = candidateSlots.filter(s => s !== slot);
      const directMove = this.findDirectMove(victim, victimSlots, rooms);

      if (directMove) {
        // Direct move succeeded — execute the swap
        this.executeSwap(sec, victim, slot, directMove.slot, directMove.room, rooms, depth);
        return true;
      }

      // 4. Direct move failed — try to chain: recursively free a slot for the victim
      if (depth > 1) {
        // Temporarily remove victim from its current slot so the recursive call
        // sees realistic availability
        const victimOldTerm = getTermFromSlot(slot);
        this.tracker.removePlacement(victim.id, slot, victim.teacher, victim.coTeacher, victim.room, victimOldTerm);

        const chainSuccess = this.backtrackChain(victim, victimSlots, sections, rooms, depth - 1, new Set(visited));

        if (chainSuccess) {
          // Victim was relocated by the recursive call. Place sec in the freed slot.
          let secRoom = this.findRoom(sec, slot, rooms);
          if (secRoom) sec.roomName = rooms.find(r => r.id === secRoom)?.name;
          this.tracker.assignPlacement(sec, slot, sec.teacher, sec.coTeacher, secRoom, victimOldTerm);
          this.logger.logPlacement(sec, slot, 999, [{ period: slot, cost: 0, reasons: [`Chained backtrack (depth ${BaseStrategy.MAX_BACKTRACK_DEPTH - depth + 1})`] }]);
          return true;
        }

        // Chain failed — restore victim to its original slot
        this.tracker.assignPlacement(victim, slot, victim.teacher, victim.coTeacher, victim.room, victimOldTerm);
      }
    }
    return false;
  }

  /** Find a slot where the victim can move directly (teacher + room available). */
  private findDirectMove(victim: Section, candidateSlots: string[], rooms: Room[]): { slot: string; room: string | null } | null {
    for (const vSlot of candidateSlots) {
      if (!this.tracker.isTeacherAvailable(victim.teacher, vSlot)) continue;
      if (victim.coTeacher && !this.tracker.isTeacherAvailable(victim.coTeacher, vSlot)) continue;

      let room: string | null = null;
      if (victim.room) {
        if (!this.tracker.isRoomAvailable(victim.room, vSlot)) continue;
        room = victim.room;
      } else {
        const available = rooms.filter(r => r.type === victim.roomType && this.tracker.isRoomAvailable(r.id, vSlot));
        if (available.length === 0) continue;
        room = available[0].id;
      }
      return { slot: vSlot, room };
    }
    return null;
  }

  /** Execute the swap: move victim to newSlot, place sec in freed slot. */
  private executeSwap(
    sec: Section, victim: Section, freedSlot: string,
    victimNewSlot: string, victimNewRoom: string | null, rooms: Room[], depth: number
  ) {
    const oldTerm = getTermFromSlot(freedSlot);
    const newTerm = getTermFromSlot(victimNewSlot);

    this.logger.info(`Backtracking (depth ${BaseStrategy.MAX_BACKTRACK_DEPTH - depth + 1}): Bumping ${victim.courseName} from ${freedSlot} to ${victimNewSlot}`);

    this.tracker.removePlacement(victim.id, freedSlot, victim.teacher, victim.coTeacher, victim.room, oldTerm);
    this.tracker.assignPlacement(victim, victimNewSlot, victim.teacher, victim.coTeacher, victimNewRoom, newTerm);
    if (victimNewRoom) victim.roomName = rooms.find(r => r.id === victimNewRoom)?.name;

    let secRoom = this.findRoom(sec, freedSlot, rooms);
    if (secRoom) sec.roomName = rooms.find(r => r.id === secRoom)?.name;
    this.tracker.assignPlacement(sec, freedSlot, sec.teacher, sec.coTeacher, secRoom, oldTerm);

    this.logger.logPlacement(sec, freedSlot, 999, [{ period: freedSlot, cost: 0, reasons: ["Backtracked"] }]);
  }

  /** Find an available room for a section in a given slot. */
  private findRoom(sec: Section, slot: string, rooms: Room[]): string | null {
    if (sec.room && this.tracker.isRoomAvailable(sec.room, slot)) return sec.room;
    const available = rooms.filter(r => r.type === sec.roomType && this.tracker.isRoomAvailable(r.id, slot));
    return available.length > 0 ? available[0].id : null;
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