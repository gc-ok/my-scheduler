// c:\Users\castillog\Downloads\Random codes\Master Course\my-scheduler\src\utils\validator.ts
import { ScheduleConfig } from "../types";

export const validateConfig = (config: Partial<ScheduleConfig>): string[] => {
  const errors: string[] = [];

  // 1. Critical Resources
  if (!config.teachers || config.teachers.length === 0) {
    errors.push("No teachers defined. Please add teachers in the 'Teachers' step.");
  }

  if ((!config.courses || config.courses.length === 0) && (!config.cohorts || config.cohorts.length === 0)) {
    errors.push("No courses or cohorts defined. Please add data in the 'Data Input' step.");
  }

  // 2. Bell Schedule Validation
  const hasPeriods = config.periods && config.periods.length > 0;
  const hasCount = config.periodsCount && config.periodsCount > 0;

  if (!hasPeriods && !hasCount) {
    errors.push("Bell Schedule is incomplete. Please configure periods or start/end times.");
  }

  // 3. Time Frame Logic (if applicable)
  if (config.scheduleMode === "time_frame") {
    if (!config.schoolStart || !config.schoolEnd) {
      errors.push("School Start and End times are required for Time Frame mode.");
    }
  }

  // 4. School Type
  if (!config.schoolType) {
    errors.push("School Type is not selected.");
  }

  return errors;
};
