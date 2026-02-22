import { generateSchedule } from './engine';
import { ScheduleConfig, Section } from '../types';

self.onmessage = (e: MessageEvent<{ 
  action: 'GENERATE' | 'GENERATE_WITH_OVERRIDES', 
  config: ScheduleConfig, 
  sizeOverrides?: { sectionId: string, enrollment: number }[] 
}>) => {
  const { action, config, sizeOverrides } = e.data;

  try {
    // 1. Run the heavy scheduling algorithm
    const result = generateSchedule(config);

    // 2. Apply size overrides if this was a regeneration request
    if (action === 'GENERATE_WITH_OVERRIDES' && sizeOverrides && sizeOverrides.length > 0) {
      result.sections = result.sections.map((sec: Section) => {
        const override = sizeOverrides.find((o) => o.sectionId === sec.id);
        if (override) return { ...sec, enrollment: override.enrollment };
        return sec;
      });
    }

    // 3. Send the completed schedule back to the main thread
    self.postMessage({ status: 'SUCCESS', data: result });
  } catch (error: any) {
    self.postMessage({ status: 'ERROR', error: error.message || "An unknown error occurred during generation." });
  }
};