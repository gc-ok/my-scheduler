// src/views/wizard/steps/LunchStep.tsx
import { useState, useEffect } from "react";
import { COLORS } from "../../../utils/theme";
import { Btn, Card, NumInput } from "../../../components/ui/CoreUI";

interface StepProps {
  config: any;
  setConfig: (config: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const SELECT_STYLE = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: `1px solid ${COLORS.lightGray}`, fontSize: 14, outline: "none",
  boxSizing: "border-box" as const, fontFamily: "'Segoe UI', system-ui, sans-serif",
  backgroundColor: COLORS.white, color: COLORS.text, colorScheme: "light" as const,
  appearance: "auto" as const
};

const toMins = (t?: string): number => { if (!t) return 480; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (mins: number): string => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
};

export function LunchStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  const pc = c.periodsCount || 7;
  const periods = c.periods || [];
  const isBlock = c.scheduleType === "ab_block" || c.scheduleType === "4x4_block"; 
  
  const [style, setStyle] = useState(c.lunchConfig?.style || (isBlock ? "split" : "unit"));
  const [lunchPeriod, setLunchPeriod] = useState(c.lunchConfig?.lunchPeriod || (isBlock ? 3 : 4));
  
  const [lunchSpan, setLunchSpan] = useState(2); 
  const [lunchStartPeriod, setLunchStartPeriod] = useState(isBlock ? 2 : 4); 
  
  const [duration, setDuration] = useState(c.lunchConfig?.lunchDuration || 30);
  const [waves, setWaves] = useState(c.lunchConfig?.numWaves || 3);
  const [minClassTime, setMinClassTime] = useState(c.lunchConfig?.minClassTime || (isBlock ? 90 : 45));

  const derivedLunchPeriods = Array.from({ length: lunchSpan }).map((_, i) => lunchStartPeriod + i);

  useEffect(() => {
    if (lunchStartPeriod + lunchSpan - 1 > pc) {
      setLunchStartPeriod(Math.max(1, pc - lunchSpan + 1));
    }
  }, [lunchSpan, lunchStartPeriod, pc]);

  const selectedPeriod = periods.find((p: any) => p.id === lunchPeriod);
  
  const cafeteriaTime = style === "split" ? (duration * waves) : duration;
  const studentTime = style === "split" ? (minClassTime + duration) : duration;
  const requiredDuration = style === "split" ? Math.max(cafeteriaTime, studentTime) : duration;
  
  const currentDuration = selectedPeriod?.duration || 0;
  const isTooShort = style === "split" && selectedPeriod && currentDuration < requiredDuration;

  const autoAdjustTimeline = () => {
    const mode = c.scheduleMode || "period_length";
    const startMins = toMins(c.schoolStart || "08:00");
    const pass = c.passingTime || 5;
    
    let newPeriods: any[] = [];

    if (mode === "time_frame") {
      const endMins = toMins(c.schoolEnd || "15:00");
      const totalTime = endMins - startMins;
      const totalPassing = (pc - 1) * pass;
      const fixedTime = requiredDuration;
      const remainingTime = totalTime - fixedTime - totalPassing;
      
      if (remainingTime < (pc - 1) * 20) {
        alert("Cannot fit! The school day is too short to accommodate this lunch block.");
        return; 
      }

      const normalPeriodLen = Math.floor(remainingTime / (pc - 1));
      let cur = startMins;
      for (let i = 1; i <= pc; i++) {
        const dur = (i === lunchPeriod) ? requiredDuration : normalPeriodLen;
        newPeriods.push({
          id: i, label: isBlock ? `Block ${i}` : `Period ${i}`,
          startMin: cur, endMin: cur + dur,
          startTime: toTime(cur), endTime: toTime(cur + dur),
          duration: dur,
          type: (i === lunchPeriod) ? "split_lunch" : "class"
        });
        cur += dur + pass;
      }
    } else {
      let cur = startMins;
      for (let i = 1; i <= pc; i++) {
        const oldP = periods.find((p: any) => p.id === i);
        const dur = (i === lunchPeriod) ? requiredDuration : (oldP?.duration || (isBlock ? 90 : 50));
        newPeriods.push({
          id: i, label: isBlock ? `Block ${i}` : `Period ${i}`,
          startMin: cur, endMin: cur + dur,
          startTime: toTime(cur), endTime: toTime(cur + dur),
          duration: dur,
          type: (i === lunchPeriod) ? "split_lunch" : "class"
        });
        cur += dur + pass;
      }
    }

    setConfig({
      ...c,
      periods: newPeriods,
      lunchConfig: { style, lunchPeriod, lunchPeriods: derivedLunchPeriods, lunchDuration: duration, numWaves: waves, minClassTime }
    });
    
    onNext();
  };

  const handleNext = () => {
    const finalLunchPeriods = style === "multi_period" ? derivedLunchPeriods : [];
    
    const updatedPeriods = periods.map((p: any) => ({
        ...p,
        type: (style === "unit" && p.id === lunchPeriod) ? "unit_lunch" :
              (style === "split" && p.id === lunchPeriod) ? "split_lunch" :
              (style === "multi_period" && finalLunchPeriods.includes(p.id)) ? "multi_lunch" : "class"
    }));

    setConfig({ 
        ...c, 
        periods: updatedPeriods,
        lunchConfig: { 
            style, 
            lunchPeriod, 
            lunchPeriods: finalLunchPeriods, 
            lunchDuration: duration, 
            numWaves: style === "split" ? waves : 1, 
            minClassTime 
        } 
    });
    onNext();
  };

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>{isBlock ? "Block Lunch Setup" : "Lunch Configuration"}</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>
        {isBlock 
          ? "In a block schedule, you generally extend one block to embed staggered waves, or assign consecutive blocks." 
          : "Configure how lunch fits into your bell schedule."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card selected={style === "split"} onClick={() => setStyle("split")}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🌊</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{isBlock ? "Embedded Block (Waves)" : "Split (Waves)"}</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>
            {isBlock ? "Extends one block to fit lunch waves alongside instruction." : "Long period with rotating waves (e.g., Class-Lunch-Class)."}
          </div>
        </Card>
        <Card selected={style === "unit"} onClick={() => setStyle("unit")}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🍎</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{isBlock ? "Power Hour (Unit Lunch)" : "Unit Lunch"}</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>
            {isBlock ? "A dedicated chunk of time where everyone stops to eat." : "Whole school stops to eat at the exact same time."}
          </div>
        </Card>
        <Card selected={style === "multi_period"} onClick={() => setStyle("multi_period")}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🥪</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{isBlock ? "Multi-Block" : "Multi-Period"}</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>
            {isBlock ? "Lunch spans consecutive blocks. (Rare for blocks)" : "Students eat during different consecutive full class periods."}
          </div>
        </Card>
      </div>

      <div style={{ maxWidth: 550 }}>
        {style === "multi_period" ? (
          <div style={{ marginBottom: 16, padding: 16, background: COLORS.offWhite, borderRadius: 8, border: `1px solid ${COLORS.lightGray}` }}>
            <h4 style={{ margin: "0 0 12px 0", color: COLORS.primaryDark }}>Consecutive Period Setup</h4>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>How many consecutive {isBlock ? "blocks" : "periods"}?</label>
                    <select value={lunchSpan} onChange={e => setLunchSpan(parseInt(e.target.value))} style={SELECT_STYLE}>
                        <option value={2}>2 {isBlock ? "Blocks" : "Periods"}</option>
                        <option value={3}>3 {isBlock ? "Blocks" : "Periods"}</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Starts on which {isBlock ? "block" : "period"}?</label>
                    <select value={lunchStartPeriod} onChange={e => setLunchStartPeriod(parseInt(e.target.value))} style={SELECT_STYLE}>
                        {periods.map((p: any) => {
                            if (p.id + lunchSpan - 1 > pc) return null;
                            return <option key={p.id} value={p.id}>{p.label}</option>;
                        })}
                    </select>
                </div>
            </div>

            <div style={{ marginTop: 16, fontSize: 13, color: COLORS.text, background: COLORS.white, padding: 10, borderRadius: 6, border: `1px solid ${COLORS.lightGray}` }}>
                <strong>Generated Lunch Cycle:</strong><br/>
                {derivedLunchPeriods.map(id => isBlock ? `Block ${id}` : `Period ${id}`).join(" → ")}
                <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 6 }}>
                    * Normal passing times will occur between these. Teachers will automatically be distributed evenly so no department is fully empty.
                </div>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {style === "unit" ? (isBlock ? "Which block does lunch follow?" : "Which period is Lunch?") : (isBlock ? "Which block will be extended to embed the waves?" : "Which period contains the waves?")}
            </label>
            <select value={lunchPeriod} onChange={e => setLunchPeriod(parseInt(e.target.value))} style={{ ...SELECT_STYLE }}>
              {periods.map((p: any) => (
                <option key={p.id} value={p.id}>{p.label} ({p.startTime} - {p.endTime}, {p.duration}m)</option>
              ))}
            </select>
          </div>
        )}

        {style !== "multi_period" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <NumInput label="Lunch Duration (min)" value={duration} onChange={setDuration} min={15} max={60} />
              {style === "split" && <NumInput label="Number of Waves" value={waves} onChange={setWaves} min={2} max={4} />}
          </div>
        )}

        {style === "split" && (
            <div style={{ marginTop: 8, padding: 12, background: COLORS.white, border: `1px solid ${COLORS.lightGray}`, borderRadius: 8 }}>
                <NumInput label="Min. Class Time per Student (min)" value={minClassTime} onChange={setMinClassTime} min={20} max={120} style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 11, color: COLORS.textLight }}>
                   {isBlock 
                     ? "How many minutes of actual instruction should the student get in this block? (Typically 90m for an A/B block)." 
                     : "Ensures students have enough learning time even with lunch."}
                </div>
            </div>
        )}
            
        {isTooShort && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 8, background: "#FFF4E5", border: `1px solid ${COLORS.warning}`, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: COLORS.warning, marginBottom: 8 }}>⚠️ Timeline Adjustment Needed</div>
              <div style={{ marginBottom: 8, lineHeight: 1.5 }}>
                  {isBlock ? "Block" : "Period"} {lunchPeriod} is currently <strong>{currentDuration} min</strong>.<br/>
                  To fit your lunch waves AND instructional time, it must be automatically extended to <strong>{requiredDuration} min</strong>.
              </div>
              <ul style={{ margin: "0 0 12px 16px", padding: 0, fontSize: 12, color: COLORS.text }}>
                  <li>Cafeteria needs: {waves} waves × {duration}m = <strong>{cafeteriaTime}m</strong></li>
                  <li>Students need: {minClassTime}m class + {duration}m lunch = <strong>{studentTime}m</strong></li>
              </ul>
              <Btn onClick={autoAdjustTimeline} variant="warning" style={{ width: "100%", justifyContent: "center" }}>
                  ⚡ Auto-Adjust Timeline & Continue
              </Btn>
          </div>
        )}
      </div>

      <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        {!isTooShort && (
            <Btn onClick={handleNext}>
                Continue →
            </Btn>
        )}
      </div>
    </div>
  );
}