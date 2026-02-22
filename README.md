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

## Directory Structure
my-scheduler/
├── public/                     # Static assets served directly without Vite processing
│   └── vite.svg                # Vite logo icon
├── src/                        # Main application source code
│   ├── assets/                 # Processed static assets (images, icons)
│   │   └── react.svg           # React logo icon
│   ├── components/             # Reusable React UI components
│   │   ├── grid/               # Components for the final generated schedule view
│   │   │   ├── MasterGrid.tsx       # Main combined grid layout
│   │   │   ├── RoomGrid.tsx         # Schedule view organized by rooms
│   │   │   ├── ScheduleGridView.tsx # Core wrapper for displaying the finished schedule
│   │   │   └── TeacherGrid.tsx      # Schedule view organized by teachers
│   │   ├── modals/             # Popup dialog components
│   │   │   ├── PLCOrganizerModal.jsx        # UI for creating and managing PLCs
│   │   │   └── TeacherAvailabilityModal.jsx # UI for managing teacher blocked periods
│   │   └── ui/
│   │       └── CoreUI.tsx      # Shared atomic UI elements (Buttons, Logos, Cards)
│   ├── core/                   # The algorithmic brain of the application
│   │   ├── strategies/         # Specialized scheduling algorithms
│   │   │   ├── Block4x4Strategy.ts   # Logic for 4x4 block schedules
│   │   │   └── ScheduleStrategies.ts # Standard/AB/Trimester scheduling logic
│   │   ├── engine.ts           # The main master schedule generation engine
│   │   ├── ResourceTracker.ts  # Tracks teacher and room availability during generation
│   │   └── worker.ts           # Web Worker to run the engine in the background
│   ├── types/                  # TypeScript interface definitions
│   │   └── index.ts            # Core data models (Teacher, Section, Config, etc.)
│   ├── utils/                  # Helper functions and constants
│   │   ├── ScheduleConfig.ts   # Utilities for parsing and building the schedule config
│   │   └── theme.ts            # Global color palette and styling constants
│   ├── views/                  # High-level page views
│   │   ├── wizard/             # The multi-step setup flow for creating a schedule
│   │   │   ├── steps/          # Individual screens for the wizard flow
│   │   │   │   ├── BellScheduleStep.tsx # Timeframe and period length config
│   │   │   │   ├── ConstraintsStep.tsx  # Hard locks and scheduling rules
│   │   │   │   ├── CSVUploadStep.tsx    # Bulk data import handler
│   │   │   │   ├── LunchStep.tsx        # Split/Unit/Multi-period lunch config
│   │   │   │   ├── PlanPLCStep.tsx      # Planning and Professional Learning Communities
│   │   │   │   ├── RecessStep.tsx       # Elementary recess duty/time config
│   │   │   │   ├── ScheduleTypeStep.tsx # Standard vs Block vs Trimester selection
│   │   │   │   ├── SchoolTypeStep.tsx   # Elementary vs Middle vs High School setup
│   │   │   │   ├── WINTimeStep.tsx      # "What I Need" / Intervention time config
│   │   │   │   ├── DataInputStep.tsx    # Manual data entry hub
│   │   │   │   ├── GenericInputStep.tsx # Quick-setup input forms
│   │   │   │   └── index.ts             # Exports all steps for easy importing
│   │   │   └── WizardController.tsx     # Manages state and routing between wizard steps
│   │   └── WizardSteps.jsx     # Legacy/Alternative wizard component structure
│   ├── App.css                 # Global application styling
│   ├── App.tsx                 # Root React component connecting the Wizard and Engine
│   ├── index.css               # Base CSS reset and font imports
│   └── main.jsx                # React DOM entry point
├── .gitignore                  # Specifies intentionally untracked files to ignore
├── eslint.config.js            # Linter configuration for code quality
├── index.html                  # Main HTML entry point for the Vite application
├── package.json                # Project metadata, scripts, and dependencies
├── package-lock.json           # Exact dependency version tree
├── README.md                   # Project documentation
├── tsconfig.json               # TypeScript compiler configuration for the frontend
├── tsconfig.node.json          # TypeScript compiler configuration for Vite/Node
├── vite.config.ts              # Vite bundler configuration
└── oldengine.txt / formerappjsx.txt # Archived/Legacy reference files