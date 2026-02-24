import { ScheduleResult, Section } from "../types";

export type ExportFormat = 'generic' | 'powerschool' | 'infinite_campus';

// --- Helpers ---

/**
 * Build a PowerSchool Expression string: "{periodNum}({termCode})"
 * Period values may be composite strings like "A-1", "S1-2", "T1-3"
 * or plain numbers/strings like 1, "3".
 */
function buildPSExpression(period: string | number | null, term: string | null | undefined): string {
  if (period === null || period === undefined) return '';
  const p = String(period);
  let periodNum: string;
  let termFromPeriod: string | null = null;

  if (p.includes('-')) {
    // Composite: "A-1", "S1-2", "T1-3"
    const dashIdx = p.lastIndexOf('-');
    termFromPeriod = p.slice(0, dashIdx);    // "A", "S1", "T1"
    periodNum = p.slice(dashIdx + 1);        // "1", "2", "3"
  } else {
    periodNum = p;
  }

  const effectiveTerm = term || termFromPeriod || 'FY';
  // PS uses "Y" for full year; everything else passes through (S1, S2, T1, A, B, Q1…)
  const psTermCode = (effectiveTerm === 'FY' || effectiveTerm === 'Full Year') ? 'Y' : effectiveTerm;

  return `${periodNum}(${psTermCode})`;
}

/** Extract the numeric period from composite period strings. */
function extractPeriodNum(period: string | number | null): string {
  if (period === null || period === undefined) return '';
  const p = String(period);
  if (p.includes('-')) return p.slice(p.lastIndexOf('-') + 1);
  return p;
}

/** Derive a term abbreviation — prefer explicit term field, then parse period prefix. */
function extractTerm(period: string | number | null, term: string | null | undefined): string {
  if (term && term !== 'FY') return term;
  const p = String(period || '');
  if (p.includes('-')) {
    const prefix = p.slice(0, p.lastIndexOf('-'));
    // Map short prefix to human term: A→A-Day, S1→Semester 1, etc. (keep raw for IC import)
    return prefix;
  }
  return term || 'FY';
}

/** Wrap a value in CSV-safe double quotes. */
const safe = (val: string | number | null | undefined): string =>
  `"${String(val ?? '').replace(/"/g, '""')}"`;

/** Trigger a file download in the browser. */
function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Export builders ---

function buildGenericRows(sections: Section[], variantLabel: string | null): string[] {
  const header = [
    'Course_ID', 'Course_Name', 'Section_ID', 'Section_Number', 'Department',
    'Teacher_ID', 'Teacher_Name', 'Room_ID', 'Room_Name', 'Period', 'Term',
    'Enrollment', 'Max_Size', 'Has_Conflict', 'Cohort_ID',
    ...(variantLabel !== null ? ['Variant'] : []),
  ].join(',');

  const rows = sections.map((s) => [
    safe(s.courseId),
    safe(s.courseName),
    safe(s.id),
    s.sectionNum,
    safe(s.department),
    safe(s.teacher),
    safe(s.teacherName),
    safe(s.room),
    safe(s.roomName || s.room),
    safe(s.period),
    safe(s.term || 'FY'),
    s.enrollment,
    s.maxSize,
    s.hasConflict ? 'YES' : 'NO',
    safe(s.cohortId),
    ...(variantLabel !== null ? [safe(variantLabel)] : []),
  ].join(','));

  return [header, ...rows];
}

/**
 * PowerSchool master schedule section import format.
 * Key field: Expression = "{period}({term})" e.g. "1(Y)", "2(S1)", "3(A)"
 * Use Course_Number + Section_Number + Expression + Teacher_Number + Room
 * to populate the PS Section Builder / MCM upload.
 */
function buildPSRows(sections: Section[], variantLabel: string | null): string[] {
  const header = [
    'Course_Number', 'Section_Number', 'Expression',
    'Teacher_Number', 'Teacher_Name', 'Room', 'Max_Enrollment', 'Department',
    ...(variantLabel !== null ? ['Variant'] : []),
  ].join(',');

  const rows = sections.map((s) => [
    safe(s.courseId),
    s.sectionNum,
    safe(buildPSExpression(s.period, s.term)),
    safe(s.teacher),
    safe(s.teacherName),
    safe(s.roomName || s.room),
    s.maxSize,
    safe(s.department),
    ...(variantLabel !== null ? [safe(variantLabel)] : []),
  ].join(','));

  return [header, ...rows];
}

/**
 * Infinite Campus master schedule section import format.
 * Period and Term are separate columns; Teacher_Name is the full name string.
 */
function buildICRows(sections: Section[], variantLabel: string | null): string[] {
  const header = [
    'Course_Number', 'Course_Name', 'Section_Number',
    'Period', 'Term', 'Teacher_Name', 'Room', 'Max_Enrollment',
    'Department', 'Enrollment',
    ...(variantLabel !== null ? ['Variant'] : []),
  ].join(',');

  const rows = sections.map((s) => [
    safe(s.courseId),
    safe(s.courseName),
    s.sectionNum,
    safe(extractPeriodNum(s.period)),
    safe(extractTerm(s.period, s.term)),
    safe(s.teacherName),
    safe(s.roomName || s.room),
    s.maxSize,
    safe(s.department),
    s.enrollment,
    ...(variantLabel !== null ? [safe(variantLabel)] : []),
  ].join(','));

  return [header, ...rows];
}

// --- Main hook ---

export function useScheduleExport(schedule: ScheduleResult | null) {
  const exportCSV = (format: ExportFormat = 'generic') => {
    if (!schedule) return;

    const isMulti =
      schedule.structure === 'multiple' && (schedule.variantDefs?.length ?? 0) > 1;

    const dateStr = new Date().toISOString().slice(0, 10);
    const formatLabel = format === 'powerschool' ? 'PS' : format === 'infinite_campus' ? 'IC' : 'generic';
    const filename = `master_schedule_${formatLabel}_${dateStr}.csv`;

    let allLines: string[] = [];

    if (isMulti) {
      // Combine all variants into one file with a Variant column.
      // Include the header once (from the first variant), then data rows for all.
      let headerWritten = false;

      for (const varDef of schedule.variantDefs) {
        const sections = schedule.variants[varDef.id]?.sections ?? [];
        const label = varDef.name;

        let lines: string[];
        if (format === 'powerschool') lines = buildPSRows(sections, label);
        else if (format === 'infinite_campus') lines = buildICRows(sections, label);
        else lines = buildGenericRows(sections, label);

        if (!headerWritten) {
          allLines = lines; // includes header
          headerWritten = true;
        } else {
          allLines.push(...lines.slice(1)); // skip repeated header
        }
      }
    } else {
      // Single variant
      const sections =
        schedule.variants['default']?.sections ??
        schedule.variants[schedule.variantDefs?.[0]?.id ?? '']?.sections ??
        [];

      if (format === 'powerschool') allLines = buildPSRows(sections, null);
      else if (format === 'infinite_campus') allLines = buildICRows(sections, null);
      else allLines = buildGenericRows(sections, null);
    }

    if (allLines.length <= 1) {
      alert('No sections found to export.');
      return;
    }

    downloadCSV(allLines.join('\n'), filename);
  };

  return { exportCSV };
}
