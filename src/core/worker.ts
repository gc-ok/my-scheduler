import { generateSchedule } from './engine';
import { EngineConfig, Section, ScheduleVariantDef, SingleScheduleResult, ScheduleResult } from '../types';

type WorkerPayload = {
  action: 'GENERATE' | 'GENERATE_WITH_OVERRIDES';
  configPayload: {
    structure: 'single' | 'multiple';
    variantDefs: ScheduleVariantDef[];
    configs: Record<string, EngineConfig>;
  };
  sizeOverrides?: { sectionId: string; enrollment: number }[];
  targetVariantId?: string; // New: For targeted regeneration
};

self.onmessage = (e: MessageEvent<WorkerPayload>) => {
  const { action, configPayload, sizeOverrides, targetVariantId } = e.data;

  try {
    const { structure, variantDefs, configs } = configPayload;

    // Handle targeted regeneration for a single variant
    if (action === 'GENERATE_WITH_OVERRIDES' && targetVariantId) {
      const singleConfig = configs['default']; // In regen, the payload is structured as a single run
      const result = generateSchedule(singleConfig, (msg, pct) => {
        self.postMessage({ status: 'PROGRESS', message: msg, percentage: pct });
      });

      if (sizeOverrides && sizeOverrides.length > 0) {
        result.sections = result.sections.map((sec: Section) => {
          const override = sizeOverrides.find((o) => o.sectionId === sec.id);
          if (override) return { ...sec, enrollment: override.enrollment };
          return sec;
        });
      }
      
      const { logs, placementHistory, periodList, ...leanResult } = result;
      self.postMessage({ status: 'VARIANT_SUCCESS', data: { ...leanResult, periods: periodList }, variantId: targetVariantId });
      return;
    }

    // Handle full generation (single or multiple)
    if (structure === 'multiple') {
      const finalResult: ScheduleResult = {
        structure: 'multiple',
        variantDefs,
        variants: {},
      };
      
      const variantIds = Object.keys(configs);
      const totalVariants = variantIds.length;

      for (let i = 0; i < totalVariants; i++) {
        const variantId = variantIds[i];
        const variantConfig = configs[variantId];
        const progressOffset = (i / totalVariants) * 100;
        const progressScale = 1 / totalVariants;

        const result = generateSchedule(variantConfig, (msg, pct) => {
          const scaledPct = progressOffset + (pct * progressScale);
          self.postMessage({ status: 'PROGRESS', message: `${variantDefs[i].name}: ${msg}`, percentage: scaledPct });
        });
        
        const { logs, placementHistory, periodList, ...leanResult } = result;
        finalResult.variants[variantId] = { ...leanResult, periods: periodList } as unknown as SingleScheduleResult;
      }

      self.postMessage({ status: 'SUCCESS', data: finalResult });

    } else {
      // Single schedule generation
      const singleConfig = configs['default'];
      const result = generateSchedule(singleConfig, (msg, pct) => {
        self.postMessage({ status: 'PROGRESS', message: msg, percentage: pct });
      });

      if (action === 'GENERATE_WITH_OVERRIDES' && sizeOverrides && sizeOverrides.length > 0) {
        result.sections = result.sections.map((sec: Section) => {
          const override = sizeOverrides.find((o) => o.sectionId === sec.id);
          if (override) return { ...sec, enrollment: override.enrollment };
          return sec;
        });
      }

      const { logs, placementHistory, periodList, ...leanResult } = result;

      const finalResult: ScheduleResult = {
        structure: 'single',
        variantDefs,
        variants: {
          'default': { ...leanResult, periods: periodList } as unknown as SingleScheduleResult,
        },
      };
      self.postMessage({ status: 'SUCCESS', data: finalResult });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred during generation.";
    self.postMessage({ status: 'ERROR', error: message });
  }
};