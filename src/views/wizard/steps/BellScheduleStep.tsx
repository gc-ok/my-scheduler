// src/views/wizard/steps/BellScheduleStep.tsx
import { useState } from "react";
import { COLORS } from "../../../utils/theme";
import { Btn, Card, NumInput, TimeInput, Toggle } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const toMins = (t?: string): number => {
  if (!t) return 480;
  const [hStr, mStr] = t.split(":");
  return parseInt(hStr) * 60 + parseInt(mStr);
};

const toTime = (mins: number): string => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
};

const toTime24 = (mins: number): string => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export function BellScheduleStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  const [mode, setMode] = useState(c.scheduleMode || "period_length");
  const isBlock = c.scheduleType === "ab_block" || c.scheduleType === "4x4_block";
  const isMod = c.scheduleType === "modified_block";

  const [start, setStart] = useState(c.schoolStart || "08:00");
  const [end, setEnd] = useState(c.schoolEnd || "15:00");
  const [count, setCount] = useState(c.periodsCount || (isBlock ? 4 : 7));
  const [len, setLen] = useState(c.periodLength || (isBlock ? 90 : 50));
  const [pass, setPass] = useState(c.passingTime || 5);
  // Modified block: number of block periods on T/Th days (default 4 ≈ 90-min blocks)
  const [modCount, setModCount] = useState(c.modifiedBlockPeriods || 4);

  const [hasZero, setHasZero] = useState(false);
  const [hasAfter, setHasAfter] = useState(false);

  const calculateBaseTimeline = () => {
    const sMin = toMins(start);
    let calculatedPeriods: any[] = [];
    let calculatedLen = len;
    let calculatedEnd = end;
    let calculatedEndMin = toMins(end);

    if (mode === "time_frame") {
      const eMin = toMins(end);
      const totalTime = eMin - sMin;
      const totalPassing = Math.max(0, count - 1) * pass;
      const availableForClass = Math.max(0, totalTime - totalPassing);

      calculatedLen = Math.max(10, Math.floor(availableForClass / count));

      let cur = sMin;
      for (let i = 0; i < count; i++) {
        calculatedPeriods.push({
          id: i + 1, label: isBlock ? `Block ${i + 1}` : `Period ${i + 1}`,
          startMin: cur, endMin: cur + calculatedLen,
          startTime: toTime(cur), endTime: toTime(cur + calculatedLen),
          duration: calculatedLen
        });
        cur += calculatedLen + pass;
      }
    } else {
      let cur = sMin;
      for (let i = 0; i < count; i++) {
        calculatedPeriods.push({
          id: i + 1, label: isBlock ? `Block ${i + 1}` : `Period ${i + 1}`,
          startMin: cur, endMin: cur + len,
          startTime: toTime(cur), endTime: toTime(cur + len),
          duration: len
        });
        cur += len + pass;
      }
      calculatedEnd = toTime(cur - pass);
      calculatedEndMin = cur - pass;
    }

    // Inject 0 Hour
    if (hasZero) {
      const zDur = len > 60 ? 60 : len;
      const zEnd = calculatedPeriods[0].startMin - pass;
      const zStart = zEnd - zDur;
      calculatedPeriods.unshift({
        id: 0, label: "0 Hour",
        startMin: zStart, endMin: zEnd,
        startTime: toTime(zStart), endTime: toTime(zEnd),
        duration: zDur, type: "class"
      });
    }

    // Inject After School
    if (hasAfter) {
      const last = calculatedPeriods[calculatedPeriods.length - 1];
      const aStart = last.endMin + pass;
      const aEnd = aStart + len;
      calculatedPeriods.push({
        id: calculatedPeriods.length + (hasZero ? 0 : 1), label: "After School",
        startMin: aStart, endMin: aEnd,
        startTime: toTime(aStart), endTime: toTime(aEnd),
        duration: len, type: "class"
      });
    }

    // Modified block: append block-day periods tagged with days:[2,4]
    // Block periods use ~1.8× the standard period length to approximate 90-min blocks.
    if (isMod) {
      const blkLen = Math.round(calculatedLen * 1.8);
      let blkCur = sMin;
      for (let i = 0; i < modCount; i++) {
        calculatedPeriods.push({
          id: `BLK${i + 1}`,
          label: `Block ${i + 1}`,
          startMin: blkCur, endMin: blkCur + blkLen,
          startTime: toTime(blkCur), endTime: toTime(blkCur + blkLen),
          duration: blkLen,
          days: [2, 4],   // Tuesday / Thursday
        });
        blkCur += blkLen + pass;
      }
      // Tag the standard periods as M/W/F
      calculatedPeriods = calculatedPeriods.map(p =>
        p.days ? p : { ...p, days: [1, 3, 5] }
      );
    }

    return { periods: calculatedPeriods, resultLen: calculatedLen, resultEnd: calculatedEnd, resultEndMin: calculatedEndMin };
  };

  const handleNext = () => {
    const calc = calculateBaseTimeline();
    setConfig({
      ...c, scheduleMode: mode, schoolStart: hasZero ? toTime24(calc.periods[0].startMin) : start,
      schoolEnd: mode === "time_frame" ? end : toTime24(calc.resultEndMin),
      periodsCount: count, periodLength: mode === "time_frame" ? calc.resultLen : len,
      passingTime: pass, periods: calc.periods,
      ...(isMod ? { modifiedBlockPeriods: modCount } : {}),
    });
    onNext();
  };

  const title = isMod ? "Modified Block — Bell Schedule" : isBlock ? "Block Schedule Logic" : "Bell Schedule Logic";
  const subtitle = isMod
    ? `Configure standard-day periods (M/W/F) and block-day periods (T/Th). The engine places sections into both tracks.`
    : isBlock
      ? "Define the timeline for a single day (e.g., 4 blocks). The engine will automatically generate the alternating A/B days."
      : "Define your base teaching structure. Lunch and WIN blocks will be configured in the next steps.";

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>{title}</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>{subtitle}</p>

      <div style={{ display: "flex", gap: 16, marginBottom: 24, maxWidth: 600 }}>
        <Card selected={mode === "time_frame"} onClick={() => setMode("time_frame")} style={{ flex: 1, textAlign: "center", padding: 16 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Fit to Timeframe</div>
        </Card>
        <Card selected={mode === "period_length"} onClick={() => setMode("period_length")} style={{ flex: 1, textAlign: "center", padding: 16 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📏</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Exact Length</div>
        </Card>
      </div>

      <div style={{ maxWidth: 500 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12, color: COLORS.primary }}>
          {isMod ? "Standard Day Configuration (M/W/F)" : "Configuration"}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <TimeInput label="Base Start Time" value={start} onChange={setStart} />
          {mode === "time_frame" && <TimeInput label="Base End Time" value={end} onChange={setEnd} />}
          {mode === "period_length" && <NumInput label={isBlock ? "Block Duration (min)" : "Period Duration (min)"} value={len} onChange={setLen} min={10} max={120} />}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <NumInput label={isMod ? "Standard Periods (M/W/F)" : isBlock ? "Blocks per Day" : "Number of Periods"} value={count} onChange={setCount} min={1} max={15} style={{ flex: 1 }} />
          <NumInput label="Passing Time (min)" value={pass} onChange={setPass} min={0} max={20} style={{ flex: 1 }} />
        </div>

        {isMod && (
          <div style={{ marginTop: 20, padding: 14, background: COLORS.offWhite, borderRadius: 8, border: `1px solid ${COLORS.lightGray}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.primary, marginBottom: 10 }}>Block Day Configuration (T/Th)</h3>
            <NumInput
              label="Block Periods per Day"
              value={modCount}
              onChange={setModCount}
              min={1} max={8}
              helperText={`Each block ≈ ${Math.round(len * 1.8)} min (${Math.round(len * 1.8 / 60 * 10) / 10} hrs)`}
            />
            <p style={{ fontSize: 12, color: COLORS.textLight, marginTop: 8, lineHeight: 1.5 }}>
              The engine creates <strong>{count}</strong> standard slots (STD) and <strong>{modCount}</strong> block slots (BLK).
              Core classes are balanced across both tracks.
            </p>
          </div>
        )}

        {!isMod && (
          <div style={{ marginTop: 20, padding: 12, background: COLORS.offWhite, borderRadius: 8 }}>
            <Toggle label="Include 0 Hour (Before School)" checked={hasZero} onChange={setHasZero} />
            <div style={{ height: 8 }} />
            <Toggle label="Include After School Period" checked={hasAfter} onChange={setHasAfter} />
          </div>
        )}
      </div>

      <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", maxWidth: 600 }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={handleNext}>Continue →</Btn>
      </div>
    </div>
  );
}
