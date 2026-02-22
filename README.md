# K-12 Master Schedule Generator (GC Education Analytics)

A completely in-browser, fully client-side React application for building, evaluating, and fine-tuning K-12 school master schedules. Designed with a modular architecture to handle the extreme edge-cases of educational time management.

## 🏗️ Architecture
The codebase has been refactored from a monolithic `App.jsx` into a maintainable, feature-driven structure:
* `src/core/engine.js`: The greedy scheduling algorithm, constraint evaluator, and structured logger.
* `src/components/grid/`: The visual output layers (Master Grid, Teacher Grid, Room Grid).
* `src/components/ui/CoreUI.jsx`: Reusable buttons, inputs, and layout wrappers.
* `src/views/WizardSteps.jsx`: The state-driven setup forms to map school data before generation.
* `src/App.jsx`: The primary orchestrator routing between setup state and the final grid view.

## ✨ Core Features Implemented
* **Smart Bell Schedule Math:** Auto-calculates period lengths based on hard start/end times, or strictly adheres to fixed minute requirements.
* **Split Lunch Waves (A/B/C Lunch):** Automatically balances departments across fractional blocks within a supersized lunch period, ensuring cafeteria capacity constraints are met while protecting minimum seat time.
* **Dynamic WIN Time (What I Need):** Can inject standalone 30-minute intervention blocks mid-morning and cascade shift all subsequent bell times, or absorb an existing period.
* **Common PLC Engine:** Groups teachers by department and enforces a "hard block" on a shared period, ensuring math teachers get a common prep before their classes are scheduled.
* **Stateful Manual Editing:** Fully integrated drag-and-drop. Moving a section instantly updates room availability, teacher loads, and conflict checkers without regenerating the whole schedule.
* **Structured Constraint Logger:** A developer-focused log view tracing the exact "Cost Score" of every section placement, explicitly showing why a period failed (e.g., "Exceeds target load", "Preferred room occupied").

## 🚀 The Roadmap: Future Features & Logic Targets
As discussed during architectural planning, the following core features are necessary to cross from a "great scheduling tool" to a "production-ready master scheduler."

### 1. Singletons & Double-Blocked Courses
* **The Issue:** The current engine only handles single-period courses.
* **The Fix:** Add properties to the Section object (`isDoubleBlock: true`, `singletonPriority: 1`). The engine must evaluate consecutive periods (e.g., P4 and P5 must be open simultaneously) and schedule singletons *first* before core classes eat up available slots.

### 2. Floating Teachers & Room Constraints
* **The Issue:** We currently assign a "Home Room" to a teacher. If the room is double-booked, the algorithm hunts for an empty room.
* **The Fix:** We need explicit `isFloater: true` toggles for teachers. The algorithm must dynamically map them to the rooms of teachers who are currently on their Plan/PLC period. 

### 3. Part-Time Staff & Custom Blocked Periods
* **The Issue:** The engine assumes all teachers are available for the entire timeline (effective slots). 
* **The Fix:** Expand the Setup Wizard to allow explicit `UNAVAILABLE` blocking for specific teachers (e.g., "Mornings Only"). The engine will seed `teacherBlocked` with these periods before the greedy loop starts.

### 4. Co-Teaching & Inclusion
* **The Issue:** One section currently maps to one teacher.
* **The Fix:** Allow a `coTeacherId` property on the section. The greedy evaluation loop will need to run the hard constraints check (`teacherBlocked`, `teacherSchedule`) against *both* IDs simultaneously before placing the section.

### 5. True Student Cohort Matrixing
* **The Issue:** The current algorithm focuses on *Seat Coverage* (making sure 800 seats exist in Period 1). It does not track actual student schedules.
* **The Fix:** Advanced feature implementation. We will need to define `Student` objects or "Cohorts" (e.g., "9th Grade Honors"). If a cohort needs AP Bio and Band, the engine must add massive cost penalties if it schedules those two singletons in the same period, forcing students to choose.