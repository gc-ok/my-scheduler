import { create } from 'zustand';
import { WizardState, ScheduleResult } from '../types';

export interface PendingRestore {
  config: WizardState;
  step: number;
  schedule: ScheduleResult | null;
}

// Define the state shape
interface ScheduleState {
  step: number;
  config: WizardState;
  schedule: ScheduleResult | null;
  isGenerating: boolean;
  genProgress: { pct: number; msg: string };
  errorState: { title: string; messages: string[] } | null;
  pendingRestore: PendingRestore | null;
}

// Define the actions
interface ScheduleActions {
  setStep: (step: number) => void;
  setConfig: (config: WizardState) => void;
  updateConfig: (update: Partial<WizardState>) => void;
  setSchedule: (schedule: ScheduleResult | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setGenProgress: (progress: { pct: number; msg: string }) => void;
  setErrorState: (error: { title: string; messages: string[] } | null) => void;
  setPendingRestore: (pendingRestore: PendingRestore | null) => void;
  reset: () => void;
}

const initialState: ScheduleState = {
  step: 0,
  config: {},
  schedule: null,
  isGenerating: false,
  genProgress: { pct: 0, msg: '' },
  errorState: null,
  pendingRestore: null,
};

// Create the store
const useScheduleStore = create<ScheduleState & ScheduleActions>((set, get) => ({
  ...initialState,

  // Actions
  setStep: (step) => set({ step }),
  setConfig: (config) => set({ config }),
  updateConfig: (update) => set({ config: { ...get().config, ...update } }),
  setSchedule: (schedule) => set({ schedule }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGenProgress: (genProgress) => set({ genProgress }),
  setErrorState: (errorState) => set({ errorState }),
  setPendingRestore: (pendingRestore) => set({ pendingRestore }),
  reset: () => {
    set(initialState);
  },
}));

export default useScheduleStore;

