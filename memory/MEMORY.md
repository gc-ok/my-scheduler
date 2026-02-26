# K-12 Master Scheduler — Project Memory

## Stack
- React + TypeScript (Vite), Zustand store, CSS Modules
- No external UI library — all custom components in `src/components/ui/CoreUI.tsx`

## Key File Paths
- Store: `src/store/useScheduleStore.ts`
- Types: `src/types/index.ts`
- Wizard controller: `src/views/wizard/WizardController.tsx`
- Wizard steps: `src/views/wizard/steps/` (GenericInputStep, ConstraintsStep, etc.)
- Grid views: `src/components/grid/` (MasterGrid, TeacherGrid, ScheduleGridView, RoomGrid, CohortGrid)
- Engine: `src/core/engine.ts`, `src/core/worker.ts`
- Theme: `src/utils/theme.ts`

## Architecture
- Wizard (steps 1–12) collects `WizardState` (config) → engine runs → `ScheduleResult` with variants
- `ScheduleGridView` is the post-generation view; it holds local variant state and renders grids
- `MasterGrid` = course × period matrix; `TeacherGrid` = teacher × period matrix
- Section data flows: engine output → `schedule.variants[id].sections`

## Fixed Bugs
1. **Teacher name edit now updates grid**: onSave in ScheduleGridView.tsx patches teachers[] and section.teacherName/coTeacherName in the variant, pushes to undo history.
2. **Stale conflicts after section edits**: Added `reconcileVariant()` helper that purges stale conflict entries and recomputes stats. Called from delete, save, drag-drop, and move-to-period handlers.
3. **Max classes explanation**: GenericInputStep.tsx now shows full breakdown e.g. "Max: 12 (7 periods −1 Plan −1 Lunch = 5/day × 2 semesters). If wrong, go back to Bell Schedule."
4. **Wizard forward navigation**: Store now has `maxStep` (separate from `step`). `setStep` auto-advances `maxStep`. WizardController pills use `maxStep` for enable/disable; connector lines also use `maxStep`.
5. **Non-standard schedule blocking (Critical)**: Added `getStrategySlots(pid, schedType)` in engine.ts (~L337). All pre-blocking (lunch, PLC, availability, team planning) now uses strategy-appropriate slot keys instead of always FY-ALL-. Fixes AB, 4x4, Trimester, Modified Block.
6. **Plan period marking for block types**: Plan loop uses `getStrategySlots()` per period. Plan violation check uses `termMultiplier` (2 for AB/4x4/modified, 3 for trimester) to scale `effectiveSlots`.
7. **lock_period for block types**: Uses `getStrategySlots()[0]` for correct slot format. Locked section registration extracts real term (S1/T1/FY).
8. **Elective section count capping**: Capped to `teachersForDept.length × dailyMaxLoad` to prevent unassignable sections.
9. **Block4x4Strategy.ts**: Marked with dead-code warning comment — not imported anywhere.

## GenericInputStep.tsx — Quick Setup Logic
- `depts` array now: { id, name, teacherCount, required, roomType, teacherNames[], teacherFloaters[], teacherLoadOverrides[]?, teacherExtraDepts[]? }
- Expanded dept panel has two modes: Individual (one row per teacher) and Paste List (textarea → `parseTeacherList`)
- `parseTeacherList()` handles newline/CSV/TSV, first+last columns, optional Floater column — defined outside component
- Per-teacher load override and cross-dept "Also teaches" checkboxes in individual mode
- Max classes calc: `dailyTeachable = periodsCount - planPeriodsPerDay - lunchConsumes - winConsumes`; for block ×2, trimester ×3

## TeacherGrid.tsx
- `onSectionDrop?: (sectionId, newTeacherId, newPeriod) => void` prop added
- Local `dragSection` state; section cards are draggable (unless locked)
- Drop targets: empty "Plan" cells and the outer cell container
- `RenderCell` now accepts `targetPid` prop
- Wire in ScheduleGridView via `handleTeacherGridDrop` which updates teacher + period + reconciles variant

## WizardController Step Numbers
- Step 9 = DataInput, Step 10 = GenericInput OR CSV Upload, Step 11 = Constraints (generic) OR CSV Mapping, Step 12 = Constraints (csv)
- Recess step (8) only shown for elementary-containing schools

## User Preferences
- Prefers thorough analysis before implementing; asks questions before coding
