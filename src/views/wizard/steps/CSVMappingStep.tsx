// src/views/wizard/steps/CSVMappingStep.tsx
import React, { useState, useMemo } from 'react';
import useScheduleStore from '../../../store/useScheduleStore';
import { Btn } from '../../../components/ui/CoreUI';
import { COLORS } from '../../../utils/theme';
import {
  parseRequestsMultiRow,
  parseRequestsWide,
  parseCourseInfo,
  CourseColMeta,
} from '../../../utils/csvParser';

interface StepProps {
  onNext: () => void;
  onBack: () => void;
}

// ─── Field definitions ────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  description?: string;
}

const MULTI_ROW_FIELDS: FieldDef[] = [
  { key: 'student_id',     label: 'Student ID',      description: 'Unique student identifier' },
  { key: 'student_name',   label: 'Student Name',    description: 'Full name of the student' },
  { key: 'course_id',      label: 'Course ID',       description: 'Unique course identifier' },
  { key: 'course_name',    label: 'Course Name',     description: 'Name of the course being requested' },
  { key: 'student_grade',  label: 'Grade Level',     description: 'Student grade (optional)' },
  { key: 'priority',       label: 'Priority',        description: 'Request priority number — lower = higher priority (optional)' },
  { key: 'alternate_group',label: 'Alternate Group', description: 'Groups alternates together — e.g. "pick one from Art or Music" (optional)' },
];

const WIDE_FIELDS: FieldDef[] = [
  { key: 'student_id',    label: 'Student ID',   description: 'Unique student identifier' },
  { key: 'student_name',  label: 'Student Name', description: 'Full name of the student' },
  { key: 'student_grade', label: 'Grade Level',  description: 'Student grade (optional)' },
  { key: 'course_col',    label: 'Course Column', description: 'A column containing a course request — select for each course column' },
];

const COURSE_INFO_FIELDS: FieldDef[] = [
  { key: 'course_name',    label: 'Course Name',         description: 'Name of the course', required: true },
  { key: 'course_id',      label: 'Course ID',           description: 'Unique course identifier (optional if name is mapped)' },
  { key: 'teacher_name',   label: 'Teacher Name',        description: 'Name of the teacher (optional)' },
  { key: 'room_number',    label: 'Room Number',         description: 'Room identifier (optional — if absent, teachers get their own rooms)' },
  { key: 'department',     label: 'Department',          description: 'Department / subject area (optional)' },
  { key: 'section_count',  label: 'Number of Sections',  description: 'How many sections of this course (optional)' },
  { key: 'student_count',  label: 'Student Enrollment',  description: 'Total students requesting this course — used to derive section count if section count not mapped (optional)' },
  { key: 'max_class_size', label: 'Max Class Size',      description: 'Maximum students per section override (optional)' },
  { key: 'grade_level',    label: 'Grade Level',         description: 'Grade level for this course (optional)' },
];

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function PhaseHeader({ phase, total, label }: { phase: number; total: number; label: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 4 }}>
        Step {phase} of {total}
      </div>
      <h3 style={{ fontSize: 16, color: COLORS.primaryDark, margin: 0 }}>{label}</h3>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: COLORS.accentLight, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: COLORS.primaryDark, marginBottom: 16, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0,
          background: value ? COLORS.primary : COLORS.midGray, transition: 'background 0.2s', cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 19 : 3, width: 14, height: 14,
          borderRadius: '50%', background: COLORS.white, transition: 'left 0.2s',
        }} />
      </div>
      <span style={{ fontSize: 14, color: COLORS.text }}>{label}</span>
    </label>
  );
}

// ─── Preview table ─────────────────────────────────────────────────────────────

function PreviewTable({ rows, highlightRow }: { rows: string[][]; highlightRow?: number }) {
  if (!rows.length) return null;
  return (
    <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 8px', background: COLORS.lightGray, border: '1px solid #e2e8f0', textAlign: 'center', color: COLORS.textLight, fontWeight: 600 }}>#</th>
            {rows[0].map((_, ci) => (
              <th key={ci} style={{ padding: '4px 8px', background: COLORS.lightGray, border: '1px solid #e2e8f0', textAlign: 'left', color: COLORS.textLight, fontWeight: 600, whiteSpace: 'nowrap' }}>
                Col {ci + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri === highlightRow ? COLORS.accentLight : 'transparent' }}>
              <td style={{ padding: '3px 8px', border: '1px solid #e2e8f0', textAlign: 'center', color: COLORS.textLight, fontWeight: ri === highlightRow ? 700 : 400 }}>
                {ri + 1}{ri === highlightRow ? ' ★' : ''}
              </td>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '3px 8px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: ri === highlightRow ? 600 : 400 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export const CSVMappingStep: React.FC<StepProps> = ({ onNext, onBack }) => {
  const { csvData, csvUploadType, csvRequestFormat } = useScheduleStore((s) => s.config);
  const updateConfig = useScheduleStore((s) => s.updateConfig);

  const rows = csvData ?? [];
  const isRequests = csvUploadType === 'requests';
  const isWide = csvRequestFormat === 'wide';
  const isCourseInfo = csvUploadType === 'course-info';

  // ── Phase state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);

  // Phase 1: header/data row config
  const [headerRow, setHeaderRow] = useState(1);    // 1-based UI
  const [dataStartRow, setDataStartRow] = useState(2); // 1-based UI

  // Phase 2: column mappings
  // key = column index string, value = field key
  const [mappings, setMappings] = useState<Record<string, string>>({});
  // Wide-format course column metadata
  const [courseColMeta, setCourseColMeta] = useState<Record<string, CourseColMeta>>({});

  // Phase 3: staging answers
  const [enforceSectionCaps, setEnforceSectionCaps] = useState(false);
  const [defaultMaxSize, setDefaultMaxSize] = useState(30);
  const [useAlternates, setUseAlternates] = useState(false);
  const [defaultSections, setDefaultSections] = useState(1);
  const [floaterTeachers, setFloaterTeachers] = useState<Set<string>>(new Set());

  const [parseError, setParseError] = useState('');

  // ── Derived values ────────────────────────────────────────────────────────

  // 0-indexed
  const headerIdx = headerRow - 1;
  const dataStartIdx = dataStartRow - 1;

  const headerCells: string[] = useMemo(
    () => (rows[headerIdx] ?? []).map((c) => c.trim()),
    [rows, headerIdx]
  );

  const previewRows = useMemo(
    () => rows.slice(0, Math.min(rows.length, dataStartIdx + 5)),
    [rows, dataStartIdx]
  );

  const dataRows = rows.slice(dataStartIdx);

  // Available field options for the current upload type
  const fieldDefs: FieldDef[] = isRequests
    ? (isWide ? WIDE_FIELDS : MULTI_ROW_FIELDS)
    : COURSE_INFO_FIELDS;

  // Detect teacher names from mapped data (for floater selection in phase 3)
  const detectedTeachers: string[] = useMemo(() => {
    if (!isCourseInfo) return [];
    const teacherColIdx = Object.entries(mappings).find(([, v]) => v === 'teacher_name')?.[0];
    if (!teacherColIdx) return [];
    const ci = parseInt(teacherColIdx, 10);
    const names = new Set<string>();
    for (let i = dataStartIdx; i < rows.length; i++) {
      const name = (rows[i]?.[ci] ?? '').trim();
      if (name) names.add(name);
    }
    return Array.from(names).sort();
  }, [isCourseInfo, mappings, rows, dataStartIdx]);

  // Detect whether room column is mapped
  const roomColMapped = useMemo(
    () => Object.values(mappings).includes('room_number'),
    [mappings]
  );

  // Teachers with blank room value (when room col is mapped)
  const inferredFloaters: string[] = useMemo(() => {
    if (!isCourseInfo || !roomColMapped) return [];
    const teacherColIdx = Object.entries(mappings).find(([, v]) => v === 'teacher_name')?.[0];
    const roomColIdx = Object.entries(mappings).find(([, v]) => v === 'room_number')?.[0];
    if (!teacherColIdx || !roomColIdx) return [];
    const tci = parseInt(teacherColIdx, 10);
    const rci = parseInt(roomColIdx, 10);
    const floaters = new Set<string>();
    for (let i = dataStartIdx; i < rows.length; i++) {
      const name = (rows[i]?.[tci] ?? '').trim();
      const room = (rows[i]?.[rci] ?? '').trim();
      if (name && !room) floaters.add(name);
    }
    return Array.from(floaters).sort();
  }, [isCourseInfo, roomColMapped, mappings, rows, dataStartIdx]);

  // Mapping validation warnings
  const validationWarnings: string[] = useMemo(() => {
    const warns: string[] = [];
    const mapped = new Set(Object.values(mappings));
    if (isRequests && !isWide) {
      if (!mapped.has('student_id') && !mapped.has('student_name'))
        warns.push('Map at least one of: Student ID or Student Name');
      if (!mapped.has('course_id') && !mapped.has('course_name'))
        warns.push('Map at least one of: Course ID or Course Name');
    }
    if (isRequests && isWide) {
      if (!mapped.has('student_id') && !mapped.has('student_name'))
        warns.push('Map at least one of: Student ID or Student Name');
      if (!mapped.has('course_col'))
        warns.push('Mark at least one column as Course Column');
    }
    if (isCourseInfo) {
      if (!mapped.has('course_name') && !mapped.has('course_id'))
        warns.push('Map at least one of: Course Name or Course ID');
    }
    return warns;
  }, [mappings, isRequests, isWide, isCourseInfo]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const setMapping = (colIdx: number, fieldKey: string) => {
    setMappings((prev) => {
      const next = { ...prev };
      if (fieldKey === '__unmapped__') {
        delete next[String(colIdx)];
        // also clear course col meta if removing
        setCourseColMeta((m) => { const n = { ...m }; delete n[String(colIdx)]; return n; });
      } else {
        // For non-repeatable fields: remove from any other column first
        if (fieldKey !== 'course_col') {
          Object.keys(next).forEach((k) => { if (next[k] === fieldKey) delete next[k]; });
        }
        next[String(colIdx)] = fieldKey;
      }
      return next;
    });
  };

  const setColMeta = (colIdx: number, meta: CourseColMeta) => {
    setCourseColMeta((prev) => ({ ...prev, [String(colIdx)]: meta }));
  };

  const toggleFloater = (name: string) => {
    setFloaterTeachers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // ── Final parse & store ───────────────────────────────────────────────────

  const handleProcess = () => {
    setParseError('');
    try {
      if (isRequests && !isWide) {
        const students = parseRequestsMultiRow(rows, headerIdx, dataStartIdx, mappings, {
          assumeEqualPriority: true,
        });
        updateConfig({
          students,
          csvHeaderRow: headerIdx,
          csvDataStartRow: dataStartIdx,
          csvColumnMappings: mappings,
          csvEnforceSectionCaps: enforceSectionCaps,
          csvDefaultMaxSize: defaultMaxSize,
          csvUseAlternates: useAlternates,
          ...(enforceSectionCaps ? { maxClassSize: defaultMaxSize } : {}),
        });
      } else if (isRequests && isWide) {
        const students = parseRequestsWide(rows, headerIdx, dataStartIdx, mappings, {
          courseColMeta,
        });
        updateConfig({
          students,
          csvHeaderRow: headerIdx,
          csvDataStartRow: dataStartIdx,
          csvColumnMappings: mappings,
          csvCourseColMeta: courseColMeta,
          csvEnforceSectionCaps: enforceSectionCaps,
          csvDefaultMaxSize: defaultMaxSize,
          csvUseAlternates: useAlternates,
          ...(enforceSectionCaps ? { maxClassSize: defaultMaxSize } : {}),
        });
      } else if (isCourseInfo) {
        const { courses, teachers, rooms } = parseCourseInfo(rows, headerIdx, dataStartIdx, mappings, {
          defaultSections,
          defaultMaxSize,
          floaterTeachers: Array.from(floaterTeachers),
        });
        updateConfig({
          courses,
          teachers,
          rooms,
          csvHeaderRow: headerIdx,
          csvDataStartRow: dataStartIdx,
          csvColumnMappings: mappings,
          csvDefaultSections: defaultSections,
          csvFloaterTeachers: Array.from(floaterTeachers),
          maxClassSize: defaultMaxSize,
        });
      }
      // Drop the raw CSV grid from the store — the typed objects above are all we need going
      // forward. Keeping csvData would re-persist potentially megabytes of raw strings to
      // IndexedDB on every subsequent config change.
      updateConfig({ csvData: undefined });
      onNext();
    } catch (err) {
      setParseError(`Processing error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ── Phase renderers ───────────────────────────────────────────────────────

  const renderPhase1 = () => (
    <div>
      <PhaseHeader phase={1} total={4} label="Configure header and data rows" />
      <InfoBox>
        Tell us which row contains your column labels and where your data begins.
        The preview below updates as you change these.
      </InfoBox>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Header row</span>
          <input
            type="number"
            min={1}
            max={rows.length}
            value={headerRow}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1) {
                setHeaderRow(v);
                if (dataStartRow <= v) setDataStartRow(v + 1);
              }
            }}
            style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 14 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Data starts on row</span>
          <input
            type="number"
            min={headerRow + 1}
            max={rows.length}
            value={dataStartRow}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v > headerRow) setDataStartRow(v);
            }}
            style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 14 }}
          />
        </label>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textLight, marginBottom: 6 }}>
        Preview — row {headerRow} highlighted as header
      </div>
      <PreviewTable rows={previewRows} highlightRow={headerIdx} />

      <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 10 }}>
        {rows.length} total rows detected · {dataRows.length} data rows
      </div>
    </div>
  );

  const renderPhase2 = () => (
    <div>
      <PhaseHeader phase={2} total={4} label="Map your columns to fields" />
      <InfoBox>
        For each column, choose what it represents. Leave columns set to "— Unmapped —" to ignore them.
        {validationWarnings.length > 0 && (
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 18, color: COLORS.warning }}>
            {validationWarnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
      </InfoBox>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {headerCells.map((header, ci) => {
          const currentMapping = mappings[String(ci)] ?? '__unmapped__';
          const isCoursCol = currentMapping === 'course_col';
          const meta = courseColMeta[String(ci)];
          const sampleValues = dataRows.slice(0, 3).map(r => r[ci] ?? '').filter(Boolean);

          return (
            <div key={ci} style={{
              border: `1.5px solid ${currentMapping !== '__unmapped__' ? COLORS.primary : '#e2e8f0'}`,
              borderRadius: 8, padding: '10px 14px',
              background: currentMapping !== '__unmapped__' ? '#f8faff' : COLORS.white,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                {/* Column label + samples */}
                <div style={{ minWidth: 140, flex: '0 0 auto' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.primaryDark }}>
                    Col {ci + 1}{header ? `: ${header}` : ''}
                  </div>
                  {sampleValues.length > 0 && (
                    <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 3 }}>
                      e.g. {sampleValues.map((v, i) => <span key={i} style={{ marginRight: 6, fontStyle: 'italic' }}>{v}</span>)}
                    </div>
                  )}
                </div>

                {/* Field selector */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <select
                    value={currentMapping}
                    onChange={(e) => setMapping(ci, e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 13 }}
                  >
                    <option value="__unmapped__">— Unmapped —</option>
                    {fieldDefs.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                    ))}
                  </select>
                  {currentMapping !== '__unmapped__' && (
                    <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>
                      {fieldDefs.find(f => f.key === currentMapping)?.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Wide-format course col metadata */}
              {isCoursCol && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, color: COLORS.textLight }}>Priority type</span>
                    <select
                      value={meta?.mode ?? 'equal'}
                      onChange={(e) => setColMeta(ci, { ...meta, mode: e.target.value as CourseColMeta['mode'] })}
                      style={{ padding: '5px 8px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 12 }}
                    >
                      <option value="equal">Equal priority</option>
                      <option value="priority">Assign priority number</option>
                      <option value="alternate">Alternate / elective</option>
                    </select>
                  </label>

                  {(meta?.mode === 'priority') && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: COLORS.textLight }}>Priority #</span>
                      <input
                        type="number"
                        min={1}
                        value={meta?.priority ?? 1}
                        onChange={(e) => setColMeta(ci, { ...meta, mode: 'priority', priority: parseInt(e.target.value, 10) || 1 })}
                        style={{ width: 70, padding: '5px 8px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 12 }}
                      />
                    </label>
                  )}

                  {(meta?.mode === 'alternate') && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: COLORS.textLight }}>Alternate group name (optional)</span>
                      <input
                        type="text"
                        placeholder="e.g. Arts Elective"
                        value={meta?.alternateGroup ?? ''}
                        onChange={(e) => setColMeta(ci, { ...meta, mode: 'alternate', alternateGroup: e.target.value })}
                        style={{ width: 180, padding: '5px 8px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 12 }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderPhase3 = () => (
    <div>
      <PhaseHeader phase={3} total={4} label="Staging questions" />

      {isRequests && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ padding: '14px 16px', border: '1.5px solid #e2e8f0', borderRadius: 8 }}>
            <Toggle
              value={enforceSectionCaps}
              onChange={setEnforceSectionCaps}
              label="Are sections capacity-limited? (enforce a max students per section)"
            />
            {enforceSectionCaps && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Default max students per section</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="number"
                      min={1}
                      value={defaultMaxSize}
                      onChange={(e) => setDefaultMaxSize(parseInt(e.target.value, 10) || 30)}
                      style={{ width: 90, padding: '6px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: COLORS.textLight }}>students</span>
                  </div>
                </label>
                <Toggle
                  value={useAlternates}
                  onChange={setUseAlternates}
                  label="If a section fills up, try the student's alternate requests"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {isCourseInfo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Default sections */}
          <div style={{ padding: '14px 16px', border: '1.5px solid #e2e8f0', borderRadius: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                Default number of sections per course
              </span>
              <span style={{ fontSize: 12, color: COLORS.textLight }}>
                Used when your file doesn't include a section count column.
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <input
                  type="number"
                  min={1}
                  value={defaultSections}
                  onChange={(e) => setDefaultSections(parseInt(e.target.value, 10) || 1)}
                  style={{ width: 90, padding: '6px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 14 }}
                />
                <span style={{ fontSize: 12, color: COLORS.textLight }}>section(s)</span>
              </div>
            </label>
          </div>

          {/* Default max class size */}
          <div style={{ padding: '14px 16px', border: '1.5px solid #e2e8f0', borderRadius: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                Default max class size
              </span>
              <span style={{ fontSize: 12, color: COLORS.textLight }}>
                Used when a course doesn't have its own max size in the file. Also used to derive section count from student enrollment.
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <input
                  type="number"
                  min={1}
                  value={defaultMaxSize}
                  onChange={(e) => setDefaultMaxSize(parseInt(e.target.value, 10) || 30)}
                  style={{ width: 90, padding: '6px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 14 }}
                />
                <span style={{ fontSize: 12, color: COLORS.textLight }}>students</span>
              </div>
            </label>
          </div>

          {/* Floater selection */}
          {roomColMapped ? (
            <div style={{ padding: '14px 16px', background: COLORS.accentLight, borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.primaryDark, marginBottom: 6 }}>
                Room column detected
              </div>
              {inferredFloaters.length > 0 ? (
                <div style={{ fontSize: 13, color: COLORS.primaryDark }}>
                  <strong>{inferredFloaters.length}</strong> teacher{inferredFloaters.length !== 1 ? 's' : ''} have no room assigned and will be treated as floaters:
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {inferredFloaters.map((name) => (
                      <span key={name} style={{ background: COLORS.primary, color: COLORS.white, borderRadius: 12, padding: '2px 10px', fontSize: 12 }}>{name}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: COLORS.primaryDark }}>All teachers have room assignments. No floaters detected.</div>
              )}
            </div>
          ) : detectedTeachers.length > 0 ? (
            <div style={{ padding: '14px 16px', border: '1.5px solid #e2e8f0', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
                Which teachers are floaters? (travel between rooms)
              </div>
              <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 12 }}>
                Everyone else will be assigned their own room. You can update this later in the Constraints step.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {detectedTeachers.map((name) => (
                  <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={floaterTeachers.has(name)}
                      onChange={() => toggleFloater(name)}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  const renderPhase4 = () => {
    const mappedFields = Object.entries(mappings)
      .filter(([, v]) => v !== '__unmapped__')
      .map(([k, v]) => {
        const def = fieldDefs.find(f => f.key === v);
        const header = headerCells[parseInt(k, 10)];
        return `${header || `Col ${parseInt(k, 10) + 1}`} → ${def?.label ?? v}`;
      });

    return (
      <div>
        <PhaseHeader phase={4} total={4} label="Confirm and process" />

        <div style={{ background: COLORS.accentLight, borderRadius: 8, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.primaryDark, marginBottom: 10 }}>Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '6px 12px', fontSize: 13 }}>
            <span style={{ color: COLORS.textLight }}>Type</span>
            <span style={{ fontWeight: 600 }}>{csvUploadType === 'requests' ? `Course Requests (${isWide ? 'wide' : 'multi-row'})` : 'Course Information'}</span>
            <span style={{ color: COLORS.textLight }}>Data rows</span>
            <span style={{ fontWeight: 600 }}>{dataRows.length}</span>
            <span style={{ color: COLORS.textLight }}>Mapped columns</span>
            <span style={{ fontWeight: 600 }}>{mappedFields.length}</span>
          </div>
          {mappedFields.length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px solid #d9e6f7', paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 6 }}>Column mappings:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {mappedFields.map((f) => (
                  <span key={f} style={{ background: COLORS.white, border: `1px solid ${COLORS.primary}`, borderRadius: 12, padding: '2px 10px', fontSize: 12, color: COLORS.primaryDark }}>{f}</span>
                ))}
              </div>
            </div>
          )}
          {isCourseInfo && (
            <div style={{ marginTop: 10, fontSize: 13, color: COLORS.primaryDark }}>
              <strong>Sections default:</strong> {defaultSections} · <strong>Max class size:</strong> {defaultMaxSize}
              {floaterTeachers.size > 0 && <> · <strong>Floaters:</strong> {Array.from(floaterTeachers).join(', ')}</>}
            </div>
          )}
          {isRequests && enforceSectionCaps && (
            <div style={{ marginTop: 10, fontSize: 13, color: COLORS.primaryDark }}>
              <strong>Section caps:</strong> {defaultMaxSize} students max · <strong>Alternates:</strong> {useAlternates ? 'Yes' : 'No'}
            </div>
          )}
        </div>

        {validationWarnings.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
            <strong>Warnings — you can still continue:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {validationWarnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}

        {parseError && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#991b1b' }}>
            {parseError}
          </div>
        )}
      </div>
    );
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const canAdvancePhase2 = validationWarnings.length === 0;

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Map CSV Data</h2>
      <div style={{ background: COLORS.accentLight, borderRadius: 8, padding: '8px 14px', marginBottom: 22, fontSize: 13, color: COLORS.primaryDark }}>
        {rows.length} rows loaded from your file. Configure your column mappings below.
      </div>

      {/* Phase progress indicator */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {(['Header Rows', 'Map Columns', 'Staging', 'Confirm'] as const).map((label, i) => {
          const pNum = (i + 1) as 1 | 2 | 3 | 4;
          const isActive = phase === pNum;
          const isDone = phase > pNum;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <button
                onClick={() => pNum < phase && setPhase(pNum)}
                disabled={pNum > phase}
                style={{
                  flex: 1, padding: '6px 4px', borderRadius: 6, border: 'none',
                  background: isActive ? COLORS.primary : isDone ? COLORS.accentLight : COLORS.lightGray,
                  color: isActive ? COLORS.white : isDone ? COLORS.primary : COLORS.midGray,
                  fontSize: 11, fontWeight: isActive ? 700 : 500, cursor: pNum < phase ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                }}
              >
                {isDone ? '✓ ' : ''}{label}
              </button>
              {i < 3 && <div style={{ width: 8, height: 2, background: isDone ? COLORS.accent : COLORS.lightGray, flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>

      {phase === 1 && renderPhase1()}
      {phase === 2 && renderPhase2()}
      {phase === 3 && renderPhase3()}
      {phase === 4 && renderPhase4()}

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
        <Btn variant="secondary" onClick={phase === 1 ? onBack : () => setPhase((p) => (p - 1) as 1 | 2 | 3 | 4)}>
          ← Back
        </Btn>

        {phase < 4 ? (
          <Btn
            onClick={() => setPhase((p) => (p + 1) as 1 | 2 | 3 | 4)}
            disabled={phase === 2 && !canAdvancePhase2}
          >
            {phase === 2 && !canAdvancePhase2 ? 'Fix warnings to continue' : 'Next →'}
          </Btn>
        ) : (
          <Btn onClick={handleProcess}>
            Process &amp; Continue →
          </Btn>
        )}
      </div>
    </div>
  );
};
