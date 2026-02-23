# K-12 Master Schedule Generator

A fully client-side React application for building, evaluating, and fine-tuning K-12 master schedules. Runs entirely in the browser — no servers, no accounts, no data collection.

---

## Architecture

```
src/
├── core/                     # Scheduling engine
│   ├── engine.ts             # Main generation engine (cohort, departmental, block)
│   ├── ResourceTracker.ts    # Teacher & room availability tracking during placement
│   ├── studentScheduler.ts   # MRV-heuristic student-to-section placement
│   ├── worker.ts             # Web Worker — runs engine off the main thread
│   └── strategies/
│       ├── ScheduleStrategies.ts   # Standard / A-B Block / Trimester strategies
│       └── Block4x4Strategy.ts     # 4×4 Semester Block strategy
├── store/
│   └── useScheduleStore.ts   # Zustand global store (config, schedule, UI state)
├── hooks/
│   ├── useScheduleWorker.ts  # Sends work to worker, surfaces progress + errors
│   ├── useSessionRestore.ts  # IndexedDB session detection on startup
│   └── useScheduleExport.ts  # CSV export helpers
├── utils/
│   ├── db.ts                 # IndexedDB persistence (async + sync-flush for beforeunload)
│   ├── csvParser.ts          # Pure parse functions: requests (multi-row / wide) + course info
│   ├── ScheduleConfig.ts     # WizardState → EngineConfig normalizer
│   └── theme.ts              # Color palette
├── types/
│   └── index.ts              # All shared TypeScript interfaces
├── components/
│   ├── grid/                 # Schedule output views
│   │   ├── ScheduleGridView.tsx
│   │   ├── MasterGrid.tsx
│   │   ├── TeacherGrid.tsx
│   │   └── RoomGrid.tsx
│   ├── ErrorBoundary.tsx
│   └── ui/CoreUI.tsx         # Shared atomic UI (Btn, Card, NumInput, Logo…)
└── views/
    └── wizard/
        ├── WizardController.tsx
        └── steps/
            ├── SchoolTypeStep.tsx        # Step 1 — school type + elementary model
            ├── ScheduleStructureStep.tsx # Step 2 — single vs multi-variant
            ├── ScheduleTypeStep.tsx      # Step 3 — standard/block/trimester
            ├── BellScheduleStep.tsx      # Step 4 — times, periods, passing
            ├── LunchStep.tsx             # Step 5 — unit/split/multi lunch
            ├── PlanPLCStep.tsx           # Step 6 — planning + PLC
            ├── WINTimeStep.tsx           # Step 7 — intervention time
            ├── RecessStep.tsx            # Step 8 — elementary recess
            ├── DataInputStep.tsx         # Step 9 — input mode selector
            ├── GenericInputStep.tsx      # Step 10 — quick setup / cohort builder
            ├── CSVUploadStep.tsx         # Step 10 (CSV) — upload + type/format selection
            ├── CSVMappingStep.tsx        # Step 11 (CSV) — header/column/staging config
            ├── MultiScheduleStepWrapper.tsx
            └── ConstraintsStep.tsx       # Final step — locks, rules, availability
```

---

## Elementary Scheduling Models

Four models, selectable per school or overridden per cohort:

| Model | Description |
|-------|-------------|
| **Self-Contained** | One homeroom teacher covers all core subjects for their cohort. |
| **Departmentalized** | Subject specialists cover all cohorts at the grade level. Teacher is `null` pre-placement; bulk load-balancing loop assigns them. |
| **Split Band** | K-2 auto-assigned self-contained, grades 3-5 departmentalized. |
| **Partner / Platooning** | Two teachers split subjects — STEM teacher (Math, Science) and Humanities teacher (ELA, Social Studies). Cohorts swap between them. The placement engine produces the interleaved schedule naturally via cohort conflict + teacher conflict rules. |

Cohort-level `scheduleModel` overrides the school-level `elementaryModel` setting, enabling mixed models within one building.

---

## Schedule Types

| Type | Details |
|------|---------|
| Standard Daily | 6-8 equal periods every day |
| A/B Alternating Block | 4 long blocks across 2 alternating days |
| 4×4 Semester Block | 4 courses per semester, full-year credit in one term |
| Trimester | Three-term course rotation |
| Team-Based (MS) | Interdisciplinary teams with shared cohort and auto-assigned common planning |
| Modified Block | Hybrid daily + block days (e.g., M/W/F standard, T/Th block) |
| Rotating Drop | N-period bank, N-1 meet daily, one drops in rotation |
| Multi-Variant | Multiple day-type configs (A-day, B-day, Wednesday) in one project |

---

## CSV Import

Two upload types, each with a guided column-mapping flow:

**Course Requests**
- Multi-row format: one row = one student–course pair
- Wide format: one row = one student, multiple course columns with per-column priority / equal / alternate settings
- Staging questions: section caps, default max class size, use alternates when full

**Course Information**
- Maps course name, teacher, room, department, section count, student count, max class size, grade level
- Auto-generates one room per non-floater teacher when no room column is mapped
- Floater teachers selected from a detected-names checkbox list

CSV data is processed entirely in-browser via PapaParse (Web Worker off-thread) and cleared from the store after mapping to keep IndexedDB footprint small.

---

## Session Persistence

Schedule and wizard state auto-save to IndexedDB:
- Immediate save on each step advance
- 1-second debounce for in-progress edits
- Synchronous flush on `beforeunload` via a cached IDB connection (avoids async-chain reliability issues)

On next load, the user is offered "Continue Session" or "Start Over."

---

## Data Flow

```
WizardState (flat)
  └─ buildScheduleConfig() ──→ EngineConfig (nested, resolved)
       └─ worker.ts (postMessage) ──→ engine.ts
            ├─ Section generation (per school type / cohort model)
            ├─ ResourceTracker (teacher + room availability)
            ├─ Strategy placement (Standard / AB / 4x4 / Trimester / Elementary)
            ├─ studentScheduler.ts (MRV-sorted request placement)
            └─ ScheduleResult ──→ postMessage back ──→ Zustand store ──→ ScheduleGridView
```

---

## Getting Started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

Requires Node 18+.

---

## Tech Stack

- **React 18** + TypeScript
- **Vite** (dev server + build)
- **Zustand** (global state)
- **PapaParse** (CSV parsing, Web Worker mode)
- **IndexedDB** (session persistence, no external dependency)
- Web Workers (off-thread schedule generation)
