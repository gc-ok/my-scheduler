// src/utils/scheduleConfig.ts
// Bridges WizardState (flat UI fields) → EngineConfig (resolved, nested)
import { WizardState, EngineConfig, ScheduleVariantDef } from '../types';

function buildSingleConfig(config: Partial<WizardState>): EngineConfig {
  const pc = config.periodsCount || 7;
  const periodsConfig = (Array.isArray(config.periods) && config.periods.length > 0) ? config.periods : [];

  return {
    schoolType: config.schoolType,
    scheduleType: config.scheduleType,
    periodsCount: config.periodsCount,
    schoolEnd: config.schoolEnd,
    scheduleMode: config.scheduleMode,
    plcEnabled: config.plcEnabled,
    plcFrequency: config.plcFrequency,
    plcGroups: config.plcGroups,
    teacherAvailability: config.teacherAvailability,
    courseRelationships: config.courseRelationships,

    periods: periodsConfig,
    schoolStart: config.schoolStart || "08:00",
    periodLength: config.periodLength || 50,
    passingTime: config.passingTime || 5,
    lunchConfig: {
      style: (config.lunchStyle || "unit") as "unit" | "split" | "multi_period",
      lunchPeriod: config.lunchPeriod ?? Math.ceil(pc / 2),
      lunchPeriods: config.lunchPeriods || [],
      lunchDuration: config.lunchDuration || 30,
      numWaves: config.numLunchWaves || 1,
      minClassTime: config.minClassTime || 45,
    },
    winConfig: {
      enabled: config.winEnabled || false,
      winPeriod: config.winPeriod,
      model: config.winModel || "uses_period",
      afterPeriod: config.winAfterPeriod || 1,
      winDuration: config.winDuration || 30,
    },
    recessConfig: {
      enabled: config.recessConfig?.enabled || false,
      duration: config.recessConfig?.duration || 20,
      afterPeriod: config.recessConfig?.afterPeriod || 2,
    },
    teachers: config.teachers || [],
    courses: config.courses || [],
    cohorts: config.cohorts || [],
    rooms: config.rooms || [],
    constraints: config.constraints || [],
    studentCount: config.studentCount || 800,
    maxClassSize: config.maxClassSize || 30,
    planPeriodsPerDay: config.planPeriodsPerDay ?? 1,
    elementaryModel: config.elementaryModel,
    cohortGrades: config.cohortGrades,
    useTeams: config.useTeams,
    teams: config.teams,
    customGradeRange: config.customGradeRange,
    modifiedBlockPeriods: config.modifiedBlockPeriods,
  };
}


export function buildScheduleConfig(config: WizardState): {
  structure: 'single' | 'multiple',
  variantDefs: ScheduleVariantDef[],
  configs: Record<string, EngineConfig>
} {
  if (config.scheduleStructure === 'multiple' && config.scheduleVariantDefs && config.variantConfigs) {
    const multiConfigs: Record<string, EngineConfig> = {};
    for (const variantDef of config.scheduleVariantDefs) {
      const variantSpecificConfig = config.variantConfigs[variantDef.id] || {};
      const mergedConfig = { ...config, ...variantSpecificConfig };
      multiConfigs[variantDef.id] = buildSingleConfig(mergedConfig);
    }
    return {
      structure: 'multiple',
      variantDefs: config.scheduleVariantDefs,
      configs: multiConfigs,
    };
  }

  // Default to single structure
  const singleVariantDef = { id: 'default', name: 'Default', assignedDays: [1,2,3,4,5]};
  return {
    structure: 'single',
    variantDefs: [singleVariantDef],
    configs: {
      'default': buildSingleConfig(config)
    }
  };
}
