// src/views/wizard/steps/CSVUploadStep.tsx
import { useState, ChangeEvent } from 'react';
import Papa from 'papaparse';
import useScheduleStore from '../../../store/useScheduleStore';
import { COLORS } from '../../../utils/theme';
import { Btn } from '../../../components/ui/CoreUI';
import { WizardState } from '../../../types';

interface StepProps {
  onNext: () => void;
  onBack: () => void;
  config: WizardState;
  setConfig: (c: WizardState) => void;
}

type UploadType = 'requests' | 'course-info';
type RequestFormat = 'multi-row' | 'wide';

// ─── Shared sub-components ────────────────────────────────────────────────────

function RadioCard({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        padding: '14px 18px',
        borderRadius: 10,
        border: `2px solid ${selected ? COLORS.primary : COLORS.lightGray}`,
        background: selected ? COLORS.accentLight : COLORS.white,
        cursor: 'pointer',
        textAlign: 'left',
        flex: 1,
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `2px solid ${selected ? COLORS.primary : COLORS.midGray}`,
            background: selected ? COLORS.primary : 'transparent',
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{title}</span>
      </div>
      <p style={{ fontSize: 13, color: COLORS.textLight, margin: 0, paddingLeft: 26, lineHeight: 1.5 }}>
        {description}
      </p>
    </button>
  );
}

function SectionHeader({ number, label }: { number: number; label: string }) {
  return (
    <h3 style={{ fontSize: 15, color: COLORS.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: '50%', background: COLORS.primary, color: COLORS.white,
        fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}>{number}</span>
      {label}
    </h3>
  );
}

// ─── Preview table ─────────────────────────────────────────────────────────────

function PreviewTable({ rows }: { rows: string[][] }) {
  if (!rows.length) return null;
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', minWidth: 400 }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 8px', background: COLORS.lightGray, color: COLORS.textLight, fontWeight: 600, border: '1px solid #e2e8f0', textAlign: 'center' }}>#</th>
            {rows[0].map((_, ci) => (
              <th key={ci} style={{ padding: '4px 8px', background: COLORS.lightGray, color: COLORS.textLight, fontWeight: 600, border: '1px solid #e2e8f0', textAlign: 'left' }}>
                Col {ci + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              <td style={{ padding: '3px 8px', border: '1px solid #e2e8f0', color: COLORS.textLight, textAlign: 'center' }}>{ri + 1}</td>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '3px 8px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

export function CSVUploadStep({ onNext, onBack }: StepProps) {
  const updateConfig = useScheduleStore((state) => state.updateConfig);

  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [uploadType, setUploadType] = useState<UploadType>('requests');
  const [requestFormat, setRequestFormat] = useState<RequestFormat>('multi-row');
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');

  // Warn when file is large enough that parsing may take a noticeable moment
  const fileSizeMB = file ? file.size / (1024 * 1024) : 0;
  const isLargeFile = fileSizeMB > 5;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');
    setPreviewRows([]);
    setIsParsing(true);

    Papa.parse<string[]>(selectedFile, {
      header: false,
      skipEmptyLines: true,
      worker: true, // parse off the main thread — prevents UI freeze on large files
      complete: (results) => {
        const rows = results.data as string[][];
        setTotalRows(rows.length);
        setPreviewRows(rows.slice(0, 6));
        setIsParsing(false);
        updateConfig({
          csvData: rows,
          csvUploadType: uploadType,
          csvRequestFormat: uploadType === 'requests' ? requestFormat : undefined,
        });
      },
      error: (err) => {
        setIsParsing(false);
        setError(`Error reading file: ${err.message}`);
      },
    });
  };

  const handleContinue = () => {
    if (!file || previewRows.length === 0) {
      setError('Please select a CSV file to upload.');
      return;
    }
    onNext();
  };

  // ── Phase 1: Upload type ──────────────────────────────────────────────────

  const phase1 = (
    <div>
      <SectionHeader number={1} label="What kind of data are you uploading?" />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <RadioCard
          selected={uploadType === 'requests'}
          onClick={() => { setUploadType('requests'); setFile(null); setPreviewRows([]); }}
          title="Course Requests"
          description="Student course selections — who wants to take which courses. Used to schedule students into sections."
        />
        <RadioCard
          selected={uploadType === 'course-info'}
          onClick={() => { setUploadType('course-info'); setFile(null); setPreviewRows([]); }}
          title="Course Information"
          description="Existing courses, teachers, and rooms. Seeds the master schedule with your school's offerings."
        />
      </div>
    </div>
  );

  // ── Phase 2: Format sub-questions ────────────────────────────────────────

  const phase2 = (
    <div>
      {uploadType === 'requests' ? (
        <>
          <SectionHeader number={2} label="What format is your course request file?" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <RadioCard
              selected={requestFormat === 'multi-row'}
              onClick={() => setRequestFormat('multi-row')}
              title="One row per request (multi-row)"
              description="Each row is a single student-course pairing. Typical SIS export format."
            />
            <div style={{ fontSize: 12, color: COLORS.textLight, padding: '6px 14px', background: COLORS.accentLight, borderRadius: 6, lineHeight: 1.6 }}>
              Example: <code>Smith, John | 9 | Algebra I | 1</code>
            </div>
            <RadioCard
              selected={requestFormat === 'wide'}
              onClick={() => setRequestFormat('wide')}
              title="One row per student (wide format)"
              description="Each row is one student with multiple course columns. Common in counselor-built spreadsheets."
            />
            <div style={{ fontSize: 12, color: COLORS.textLight, padding: '6px 14px', background: COLORS.accentLight, borderRadius: 6, lineHeight: 1.6 }}>
              Example: <code>Smith, John | 9 | Algebra I | English 9 | PE | Art</code>
            </div>
          </div>
        </>
      ) : (
        <>
          <SectionHeader number={2} label="About your course information file" />
          <div style={{ background: COLORS.accentLight, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: COLORS.primaryDark, lineHeight: 1.7 }}>
            <strong>You'll map your columns in the next step.</strong> Common fields include:
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
              <li><strong>Course name</strong> or course ID — required</li>
              <li>Teacher name — optional</li>
              <li>Room number — optional (if absent, each teacher gets their own room)</li>
              <li>Department, grade level — optional</li>
              <li>Section count or student count — optional (used to derive section count)</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );

  // ── Phase 3: File upload + preview ───────────────────────────────────────

  const phase3 = (
    <div>
      <SectionHeader number={3} label="Choose your CSV file" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <label style={{
          display: 'inline-block', padding: '10px 20px', borderRadius: 8,
          cursor: isParsing ? 'default' : 'pointer',
          background: isParsing ? COLORS.midGray : COLORS.primary,
          color: COLORS.white, fontWeight: 600, fontSize: 14,
        }}>
          {isParsing ? 'Reading…' : 'Choose File'}
          <input type="file" accept=".csv" onChange={handleFileChange} disabled={isParsing} style={{ display: 'none' }} />
        </label>
        {file && !isParsing && (
          <span style={{ color: COLORS.success, fontSize: 14 }}>
            ✓ {file.name} &nbsp;·&nbsp; {totalRows.toLocaleString()} rows detected
            {fileSizeMB > 0 && <span style={{ color: COLORS.textLight }}> &nbsp;·&nbsp; {fileSizeMB.toFixed(1)} MB</span>}
          </span>
        )}
        {isParsing && (
          <span style={{ color: COLORS.textLight, fontSize: 13 }}>
            Parsing file off-thread…
          </span>
        )}
      </div>

      {isLargeFile && !isParsing && previewRows.length > 0 && (
        <div style={{ marginTop: 10, background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#92400e' }}>
          Large file ({fileSizeMB.toFixed(1)} MB). Column mapping and processing may be slower than usual. Ensure your data starts on the correct row.
        </div>
      )}

      {error && <div style={{ color: 'red', marginTop: 10, fontSize: 13 }}>{error}</div>}

      {previewRows.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textLight, marginBottom: 4 }}>
            Preview (first {previewRows.length} rows)
          </div>
          <PreviewTable rows={previewRows} />
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 8 }}>
            You'll configure which row is the header and map columns in the next step.
          </div>
        </div>
      )}
    </div>
  );

  // ── Layout ───────────────────────────────────────────────────────────────

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Upload Your Data</h2>
      <div style={{ background: COLORS.accentLight, borderRadius: 8, padding: '8px 14px', marginBottom: 22, fontSize: 13, color: COLORS.primaryDark }}>
        🔒 Your data is processed entirely in your browser and never sent to any server.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {phase1}
        {phase >= 2 && phase2}
        {phase >= 3 && phase3}
      </div>

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Btn variant="secondary" onClick={phase === 1 ? onBack : () => setPhase((p) => (p - 1) as 1 | 2 | 3)}>
          ← Back
        </Btn>

        {phase < 3 ? (
          <Btn onClick={() => setPhase((p) => (p + 1) as 1 | 2 | 3)}>
            Next →
          </Btn>
        ) : (
          <Btn onClick={handleContinue} disabled={!file || previewRows.length === 0 || isParsing}>
            Continue to Mapping →
          </Btn>
        )}
      </div>
    </div>
  );
}
