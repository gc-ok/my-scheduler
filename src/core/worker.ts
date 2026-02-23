import { generateSchedule } from './engine';
import { EngineConfig, Section } from '../types';

self.onmessage = (e: MessageEvent<{ 
  action: 'GENERATE' | 'GENERATE_WITH_OVERRIDES', 
  config: EngineConfig, 
  sizeOverrides?: { sectionId: string, enrollment: number }[] 
}>) => {
  const { action, config, sizeOverrides } = e.data;

  try {
    // 1. Run the heavy scheduling algorithm with progress reporting
    const result = generateSchedule(config, (msg, pct) => {
      self.postMessage({ status: 'PROGRESS', message: msg, percentage: pct });
    });

    // 2. Apply size overrides if this was a regeneration request
    if (action === 'GENERATE_WITH_OVERRIDES' && sizeOverrides && sizeOverrides.length > 0) {
      result.sections = result.sections.map((sec: Section) => {
        const override = sizeOverrides.find((o) => o.sectionId === sec.id);
        if (override) return { ...sec, enrollment: override.enrollment };
        return sec;
      });
    }

    // 3. Strip heavy debug data before crossing the worker boundary.
    //    Structured cloning of logs/placementHistory can block the main thread.
    const { logs, placementHistory, ...leanResult } = result;
    self.postMessage({ status: 'SUCCESS', data: leanResult });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred during generation.";
    self.postMessage({ status: 'ERROR', error: message });
  }
};