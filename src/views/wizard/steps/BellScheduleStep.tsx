// src/views/wizard/steps/BellScheduleStep.tsx
import { useState } from "react";
import { COLORS } from "../../../utils/theme";
import { Btn, Card, NumInput, TimeInput } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const toMins = (t?: string): number => { if (!t) return 480; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (mins: number): string => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
};

export function BellScheduleStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  const [mode, setMode] = useState(c.scheduleMode || "period_length");
  const isBlock = c.scheduleType === "ab_block" || c.scheduleType === "4x4_block";
  
  const [start, setStart] = useState(c.schoolStart || "08:00");
  const [end, setEnd] = useState(c.schoolEnd || "15:00");
  const [count, setCount] = useState(c.periodsCount || (isBlock ? 4 : 7));
  const [len, setLen] = useState(c.periodLength || (isBlock ? 90 : 50));
  const [pass, setPass] = useState(c.passingTime || 5);

  const calculateBaseTimeline = () => {
    const sMin = toMins(start);
    let calculatedPeriods: any[] = [];
    let calculatedLen = len;
    let calculatedEnd = end;

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
    }
    return { periods: calculatedPeriods, resultLen: calculatedLen, resultEnd: calculatedEnd };
  };

  const handleNext = () => {
    const calc = calculateBaseTimeline();
    setConfig({
      ...c, scheduleMode: mode, schoolStart: start,
      schoolEnd: mode === "time_frame" ? end : calc.resultEnd, 
      periodsCount: count, periodLength: mode === "time_frame" ? calc.resultLen : len,
      passingTime: pass, periods: calc.periods
    });
    onNext();
  };

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>{isBlock ? "Block Schedule Logic" : "Bell Schedule Logic"}</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>
        {isBlock ? "Define the timeline for a single day (e.g., 4 blocks). The engine will automatically generate the alternating A/B days." : "Define your base teaching structure. Lunch and WIN blocks will be configured in the next steps."}
      </p>

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
        <h3 style={{ fontSize: 15, marginBottom: 12, color: COLORS.primary }}>Configuration</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <TimeInput label="Base Start Time" value={start} onChange={setStart} />
          {mode === "time_frame" && <TimeInput label="Base End Time" value={end} onChange={setEnd} />}
          {mode === "period_length" && <NumInput label={isBlock ? "Block Duration (min)" : "Period Duration (min)"} value={len} onChange={setLen} min={10} max={120} />}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <NumInput label={isBlock ? "Blocks per Day" : "Number of Periods"} value={count} onChange={setCount} min={1} max={15} style={{ flex: 1 }} />
          <NumInput label="Passing Time (min)" value={pass} onChange={setPass} min={0} max={20} style={{ flex: 1 }} />
        </div>
      </div>

      <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", maxWidth: 600 }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={handleNext}>Continue →</Btn>
      </div>
    </div>
  );
}