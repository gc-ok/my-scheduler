// src/views/WizardSteps.jsx
import React, { useState } from "react";
import { COLORS } from "../utils/theme";
import { Btn, Card, NumInput, TimeInput, Sel, Toggle, Tabs, SMALL_INPUT } from "../components/ui/CoreUI";

const INPUT_STYLE = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: `1px solid ${COLORS.lightGray}`, fontSize: 14, outline: "none",
  boxSizing: "border-box", fontFamily: "'Segoe UI', system-ui, sans-serif",
  backgroundColor: COLORS.white, color: COLORS.text, colorScheme: "light",
};
const SELECT_STYLE = { ...INPUT_STYLE, appearance: "auto" };

// Time Utilities
const toMins = t => { if (!t) return 480; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = mins => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
};

export function SchoolTypeStep({ config: c, setConfig, onNext }) {
  const types = [
    { id: "elementary", l: "Elementary School", i: "🏫", d: "Grades K-5/6. Self-contained classrooms with specials rotation." },
    { id: "middle", l: "Middle School", i: "🏛️", d: "Grades 6-8. Students rotate between classrooms." },
    { id: "high", l: "High School", i: "🎓", d: "Grades 9-12. Full departmentalized scheduling." },
    { id: "k8", l: "K-8 School", i: "📚", d: "Combined elementary and middle." },
    { id: "k12", l: "K-12 School", i: "🏫🎓", d: "All grades. Complex mixed structure." },
    { id: "6_12", l: "6-12 School", i: "🏛️🎓", d: "Combined middle and high school." },
  ];
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>What type of school?</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>Select what best describes your school.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
        {types.map(t => (
          <Card key={t.id} selected={c.schoolType === t.id} onClick={() => setConfig({ ...c, schoolType: t.id })}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{t.i}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{t.l}</div>
            <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.5 }}>{t.d}</div>
          </Card>
        ))}
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <Btn onClick={onNext} disabled={!c.schoolType}>Continue →</Btn>
      </div>
    </div>
  );
}

export function ScheduleTypeStep({ config: c, setConfig, onNext, onBack }) {
  const all = [
    { id: "traditional", l: "Traditional", i: "📋", d: "Same classes every day, 6-8 periods.", b: "Simplicity" },
    { id: "ab_block", l: "A/B Block", i: "🔄", d: "Alternating A/B days. Longer periods.", b: "Labs & Arts" },
    { id: "4x4_block", l: "4×4 Block", i: "4️⃣", d: "4 courses/semester. 90 min daily.", b: "Accelerated credits" },
    { id: "modified_block", l: "Modified Block", i: "🔀", d: "Mix of traditional and block days.", b: "Hybrid needs" },
    { id: "rotating_drop", l: "Rotating/Drop", i: "🔃", d: "Periods rotate. One drops daily.", b: "Equity" },
    { id: "elementary_self", l: "Self-Contained", i: "👩‍🏫", d: "Homeroom all day + specials.", b: "K-2" },
    { id: "elementary_dept", l: "Departmentalized", i: "🚶", d: "Upper elem rotation.", b: "Grades 3-5" },
    { id: "ms_team", l: "Team-Based", i: "👥", d: "Interdisciplinary teams.", b: "Collaboration" },
  ];
  const valid = all.filter(t => {
    if (c.schoolType === "elementary") return ["traditional","elementary_self","elementary_dept","rotating_drop"].includes(t.id);
    if (c.schoolType === "middle") return ["traditional","ab_block","ms_team","modified_block","rotating_drop"].includes(t.id);
    if (c.schoolType === "high") return ["traditional","ab_block","4x4_block","modified_block","rotating_drop"].includes(t.id);
    return true;
  });
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Choose schedule type</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
        {valid.map(t => (
          <Card key={t.id} selected={c.scheduleType === t.id} onClick={() => setConfig({ ...c, scheduleType: t.id })}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{t.i}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t.l}</div>
            <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.5, marginBottom: 6 }}>{t.d}</div>
            <div style={{ fontSize: 12, color: COLORS.primary, fontWeight: 600 }}>Best for: {t.b}</div>
          </Card>
        ))}
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext} disabled={!c.scheduleType}>Continue →</Btn>
      </div>
    </div>
  );
}

export function BellScheduleStep({ config: c, setConfig, onNext, onBack }) {
  const [mode, setMode] = useState(c.scheduleMode || "period_length");
  
  const [start, setStart] = useState(c.schoolStart || "08:00");
  const [end, setEnd] = useState(c.schoolEnd || "15:00");
  const [count, setCount] = useState(c.periodsCount || 7);
  const [len, setLen] = useState(c.periodLength || 50);
  const [pass, setPass] = useState(c.passingTime || 5);

  const calculateBaseTimeline = () => {
    const sMin = toMins(start);
    let calculatedPeriods = [];
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
          id: i + 1, label: `Period ${i + 1}`,
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
          id: i + 1, label: `Period ${i + 1}`,
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
      ...c,
      scheduleMode: mode,
      schoolStart: start,
      schoolEnd: mode === "time_frame" ? end : calc.resultEnd, 
      periodsCount: count,
      periodLength: mode === "time_frame" ? calc.resultLen : len,
      passingTime: pass,
      periods: calc.periods
    });
    onNext();
  };

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Bell Schedule Logic</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>
        Define your base teaching structure. Lunch and WIN blocks will be configured in the next steps.
      </p>

      <div style={{ display: "flex", gap: 16, marginBottom: 24, maxWidth: 600 }}>
        <Card 
          selected={mode === "time_frame"} 
          onClick={() => setMode("time_frame")}
          style={{ flex: 1, textAlign: "center", padding: 16 }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Fit to Timeframe</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>
            "I have from 8:00 to 3:00 for classes."
          </div>
        </Card>
        <Card 
          selected={mode === "period_length"} 
          onClick={() => setMode("period_length")}
          style={{ flex: 1, textAlign: "center", padding: 16 }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>📏</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Exact Length</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>
            "Periods must be exactly 50 mins."
          </div>
        </Card>
      </div>

      <div style={{ maxWidth: 500 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12, color: COLORS.primary }}>Configuration</h3>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <TimeInput label="Base Start Time" value={start} onChange={setStart} />
          {mode === "time_frame" && <TimeInput label="Base End Time" value={end} onChange={setEnd} />}
          {mode === "period_length" && <NumInput label="Period Duration (min)" value={len} onChange={setLen} min={10} max={120} />}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <NumInput label="Number of Periods" value={count} onChange={setCount} min={1} max={15} style={{ flex: 1 }} />
          <NumInput label="Passing Time (min)" value={pass} onChange={setPass} min={0} max={20} style={{ flex: 1 }} />
        </div>

        {mode === "time_frame" && (
          <div style={{ marginTop: 10, fontSize: 13, color: COLORS.textLight, fontStyle: "italic" }}>
            * Note: Period length will be auto-calculated based on these times.
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

export function LunchStep({ config: c, setConfig, onNext, onBack }) {
  const pc = c.periodsCount || 7;
  const periods = c.periods || [];
  
  const [style, setStyle] = useState(c.lunchConfig?.style || "unit");
  const [lunchPeriod, setLunchPeriod] = useState(c.lunchConfig?.lunchPeriod || 3);
  const [lunchPeriods, setLunchPeriods] = useState(c.lunchConfig?.lunchPeriods || []); // NEW STATE
  const [duration, setDuration] = useState(c.lunchConfig?.lunchDuration || 30);
  const [waves, setWaves] = useState(c.lunchConfig?.numWaves || 3);
  const [minClassTime, setMinClassTime] = useState(c.lunchConfig?.minClassTime || 45);

  const selectedPeriod = periods.find(p => p.id === lunchPeriod);
  
  const cafeteriaTime = style === "split" ? (duration * waves) : duration;
  const studentTime = style === "split" ? (minClassTime + duration) : duration;
  const requiredDuration = style === "split" ? Math.max(cafeteriaTime, studentTime) : duration;
  
  const currentDuration = selectedPeriod?.duration || 0;
  
  // We only show the "Too Short" warning for Split or Unit lunches. 
  // Multi-period lunches simply take over normal full-length class periods.
  const isTooShort = style !== "multi_period" && selectedPeriod && currentDuration < requiredDuration;

  const autoAdjustTimeline = () => {
    const mode = c.scheduleMode || "period_length";
    const startMins = toMins(c.schoolStart || "08:00");
    const pass = c.passingTime || 5;
    
    let newPeriods = [];

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
          id: i, label: `Period ${i}`,
          startMin: cur, endMin: cur + dur,
          startTime: toTime(cur), endTime: toTime(cur + dur),
          duration: dur,
          type: (i === lunchPeriod) ? (style === "split" ? "split_lunch" : "unit_lunch") : "class"
        });
        cur += dur + pass;
      }
    } else {
      let cur = startMins;
      for (let i = 1; i <= pc; i++) {
        const oldP = periods.find(p => p.id === i);
        const dur = (i === lunchPeriod) ? requiredDuration : (oldP?.duration || 50);
        newPeriods.push({
          id: i, label: `Period ${i}`,
          startMin: cur, endMin: cur + dur,
          startTime: toTime(cur), endTime: toTime(cur + dur),
          duration: dur,
          type: (i === lunchPeriod) ? (style === "split" ? "split_lunch" : "unit_lunch") : "class"
        });
        cur += dur + pass;
      }
    }

    setConfig({
      ...c,
      periods: newPeriods,
      lunchConfig: { style, lunchPeriod, lunchPeriods, lunchDuration: duration, numWaves: style === "split" ? waves : 1, minClassTime }
    });
    
    onNext();
  };

  const isMultiPeriodValid = style !== "multi_period" || lunchPeriods.length >= 2;

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Lunch Configuration</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>
        Configure how lunch fits into your bell schedule.
      </p>

      {/* NEW: 3-Column Grid to support the new option */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card selected={style === "unit"} onClick={() => setStyle("unit")}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🍎</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Unit Lunch</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>Whole school stops to eat at the exact same time.</div>
        </Card>
        <Card selected={style === "split"} onClick={() => setStyle("split")}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🌊</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Split (Waves)</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>Long period with rotating waves (e.g., Class-Lunch-Class).</div>
        </Card>
        <Card selected={style === "multi_period"} onClick={() => setStyle("multi_period")}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🥪</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Multi-Period</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>Students eat during different full class periods.</div>
        </Card>
      </div>

      <div style={{ maxWidth: 550 }}>
        
        {/* DYNAMIC SELECTION UI */}
        {style === "multi_period" ? (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Select the periods dedicated to Lunch blocks:
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {periods.map(p => {
                const isSelected = lunchPeriods.includes(p.id);
                return (
                  <div 
                    key={p.id}
                    onClick={() => {
                      if (isSelected) setLunchPeriods(lunchPeriods.filter(id => id !== p.id));
                      else setLunchPeriods([...lunchPeriods, p.id].sort());
                    }}
                    style={{
                      padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                      background: isSelected ? COLORS.primary : COLORS.white,
                      color: isSelected ? COLORS.white : COLORS.text,
                      border: `2px solid ${isSelected ? COLORS.primary : COLORS.lightGray}`
                    }}
                  >
                    {p.label}
                  </div>
                );
              })}
            </div>
            {!isMultiPeriodValid && (
              <div style={{ color: COLORS.danger, fontSize: 12, marginTop: 8, fontWeight: 600 }}>
                ⚠️ Please select at least two periods.
              </div>
            )}
            <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 8 }}>
              Teachers will automatically be distributed evenly across these periods so departments aren't fully empty.
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {style === "unit" ? "Which period is Lunch?" : "Which period contains the waves?"}
            </label>
            <select value={lunchPeriod} onChange={e => setLunchPeriod(parseInt(e.target.value))} style={{ ...SELECT_STYLE }}>
              {periods.map(p => (
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
                   Ensures students have enough learning time even with lunch. 
                   (e.g., If Lunch is 30m and you want 45m of class, period must be 75m+).
                </div>
            </div>
        )}
            
        {isTooShort && style !== "multi_period" && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 8, background: "#FFF4E5", border: `1px solid ${COLORS.warning}`, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: COLORS.warning, marginBottom: 8 }}>⚠️ Timeline Adjustment Needed</div>
              <div style={{ marginBottom: 8, lineHeight: 1.5 }}>
                  Period {lunchPeriod} is currently <strong>{currentDuration} min</strong>.<br/>
                  To satisfy your constraints, it must be <strong>{requiredDuration} min</strong>.
              </div>
              <ul style={{ margin: "0 0 12px 16px", padding: 0, fontSize: 12, color: COLORS.text }}>
                  <li>Cafeteria needs: {waves} waves × {duration}m = <strong>{cafeteriaTime}m</strong></li>
                  <li>Students need: {minClassTime}m class + {duration}m lunch = <strong>{studentTime}m</strong></li>
              </ul>
              <Btn onClick={autoAdjustTimeline} variant="warning" style={{ width: "100%", justifyContent: "center" }}>
                  ⚡ Auto-Adjust & Continue
              </Btn>
          </div>
        )}
      </div>

      <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        {!isTooShort && (
            <Btn 
              disabled={!isMultiPeriodValid}
              onClick={() => {
                setConfig({ ...c, lunchConfig: { style, lunchPeriod, lunchPeriods, lunchDuration: duration, numWaves: style === "split" ? waves : 1, minClassTime } });
                onNext();
            }}>
                Continue →
            </Btn>
        )}
      </div>
    </div>
  );
}

export function PlanPLCStep({ config: c, setConfig, onNext, onBack }) {
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Plan Periods & PLC</h2>
      <div style={{ maxWidth: 650 }}>
        <NumInput label="Plan periods per day per teacher" min={0} max={3} value={c.planPeriodsPerDay ?? 1} onChange={v => setConfig({ ...c, planPeriodsPerDay: v })} helperText="Most schools: 1" />
        <div style={{ marginTop: 20, borderTop: `1px solid ${COLORS.lightGray}`, paddingTop: 20 }}>
          <Toggle label="Include PLC time" checked={c.plcEnabled || false} onChange={v => setConfig({ ...c, plcEnabled: v })} description="Collaborative teacher team time" />
          {c.plcEnabled && <Sel label="PLC frequency" value={c.plcFrequency || "weekly"} onChange={v => setConfig({ ...c, plcFrequency: v })} options={[{value:"daily",label:"Daily"},{value:"weekly",label:"Weekly"}]} />}
        </div>
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext}>Continue →</Btn>
      </div>
    </div>
  );
}

export function WINTimeStep({ config: c, setConfig, onNext, onBack }) {
  const pc = c.periodsCount || 7;
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>WIN Time (What I Need)</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>Intervention/enrichment block.</p>
      <div style={{ maxWidth: 600 }}>
        <Toggle label="Include WIN time" checked={c.winEnabled || false} onChange={v => setConfig({ ...c, winEnabled: v })} />
        {c.winEnabled && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <Card selected={c.winModel !== "separate"} onClick={() => setConfig({ ...c, winModel: "uses_period" })}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>📋 Uses a Period</div>
                <div style={{ fontSize: 11, color: COLORS.textLight }}>WIN replaces a teaching period.</div>
              </Card>
              <Card selected={c.winModel === "separate"} onClick={() => setConfig({ ...c, winModel: "separate" })}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>⏱️ Separate Block</div>
                <div style={{ fontSize: 11, color: COLORS.textLight }}>Own time block (e.g., 30 min).</div>
              </Card>
            </div>
            {c.winModel === "separate" ? (
              <div style={{ background: COLORS.offWhite, padding: 14, borderRadius: 8 }}>
                <NumInput label="WIN after which period?" min={1} max={pc} value={c.winAfterPeriod ?? 1} onChange={v => setConfig({ ...c, winAfterPeriod: v })} />
                <NumInput label="WIN duration (min)" min={15} max={60} value={c.winDuration ?? 30} onChange={v => setConfig({ ...c, winDuration: v })} />
              </div>
            ) : (
              <NumInput label="Which period is WIN?" min={1} max={pc} value={c.winPeriod ?? 2} onChange={v => setConfig({ ...c, winPeriod: v })} />
            )}
          </>
        )}
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext}>Continue →</Btn>
      </div>
    </div>
  );
}

export function DataInputStep({ config: c, setConfig, onNext, onBack }) {
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>How to input data?</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600 }}>
        <Card selected={c.inputMode === "generic"} onClick={() => setConfig({ ...c, inputMode: "generic" })}>
          <div style={{ fontSize: 36, marginBottom: 10, textAlign: "center" }}>✏️</div>
          <div style={{ fontWeight: 700, fontSize: 15, textAlign: "center", marginBottom: 6 }}>Quick Setup</div>
          <div style={{ fontSize: 13, color: COLORS.textLight, textAlign: "center" }}>Enter departments, counts. Name teachers optionally.</div>
        </Card>
        <Card selected={c.inputMode === "csv"} onClick={() => setConfig({ ...c, inputMode: "csv" })}>
          <div style={{ fontSize: 36, marginBottom: 10, textAlign: "center" }}>📁</div>
          <div style={{ fontWeight: 700, fontSize: 15, textAlign: "center", marginBottom: 6 }}>CSV Upload</div>
          <div style={{ fontSize: 13, color: COLORS.textLight, textAlign: "center" }}>Upload teacher/course/room files.</div>
        </Card>
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext} disabled={!c.inputMode}>Continue →</Btn>
      </div>
    </div>
  );
}

export function GenericInputStep({ config: c, setConfig, onNext, onBack }) {
  const isAB = c.scheduleType === "ab_block";
  const [depts, setDepts] = useState(c.departments || [
    { id: "english", name: "English/ELA", teacherCount: 4, required: true, roomType: "regular", teacherNames: [] },
    { id: "math", name: "Math", teacherCount: 4, required: true, roomType: "regular", teacherNames: [] },
    { id: "science", name: "Science", teacherCount: 3, required: true, roomType: "lab", teacherNames: [] },
    { id: "social", name: "Social Studies", teacherCount: 3, required: true, roomType: "regular", teacherNames: [] },
    { id: "pe", name: "PE", teacherCount: 2, required: false, roomType: "gym", teacherNames: [] },
    { id: "elective", name: "Electives", teacherCount: 4, required: false, roomType: "regular", teacherNames: [] },
  ]);
  const [sc, setSc] = useState(c.studentCount ?? 800);
  const [rc, setRc] = useState(c.roomCount ?? 25);
  const [lc, setLc] = useState(c.labCount ?? 2);
  const [gc, setGc] = useState(c.gymCount ?? 1);
  const [ms, setMs] = useState(c.maxClassSize ?? 30);
  
  // DYNAMIC LOAD: A/B teachers usually teach 6 classes total (3 on A, 3 on B). Standard teach 5 or 6 a day.
  const [tl, setTl] = useState(c.targetLoad ?? (isAB ? 6 : 5));
  const [expanded, setExpanded] = useState(null);

  const upD = (i, f, v) => { const d = [...depts]; d[i] = { ...d[i], [f]: v }; setDepts(d); };

  const periodCount = c.periodsCount || 7;
  const planP = c.planPeriodsPerDay ?? 1;
  const lunchConsumes = c.lunchModel !== "separate" ? 1 : 0;
  const winConsumes = c.winEnabled && c.winModel !== "separate" ? 1 : 0;
  
  // MATH FIX: If A/B, the total slots available across the cycle is double the daily teaching periods
  const dailyTeachable = Math.max(1, periodCount - planP - lunchConsumes - winConsumes);
  const maxTeachable = isAB ? (dailyTeachable * 2) : dailyTeachable;
  const validLoad = Math.min(tl, maxTeachable);
  
  const coreDepts = depts.filter(d => d.required);

  const cont = () => {
    const teachers = [], courses = [], rooms = [];
    depts.forEach(dept => {
      const tc = dept.teacherCount || 1;
      const names = dept.teacherNames || [];
      const floaters = dept.teacherFloaters || []; // Catch the floaters array
      
      for (let i = 0; i < tc; i++) {
        teachers.push({ 
          id: `${dept.id}_t${i + 1}`, 
          name: names[i] || `${dept.name} Teacher ${i + 1}`, 
          departments: [dept.id], 
          planPeriods: planP, 
          isFloater: floaters[i] || false // Map it here!
        });
      }
      const isPE = dept.id === "pe" || dept.name.toLowerCase().includes("pe") || dept.name.toLowerCase().includes("physical");
      const sectionMax = isPE ? Math.max(ms, 40) : ms;
      const sectionsNeeded = dept.required ? Math.max(tc * validLoad, Math.ceil(sc / sectionMax)) : tc * validLoad;
      courses.push({ id: `${dept.id}_101`, name: dept.name, department: dept.id, sections: Math.max(1, sectionsNeeded), maxSize: sectionMax, required: dept.required, roomType: dept.roomType || "regular", gradeLevel: "all" });
    });
    for (let i = 0; i < rc; i++) rooms.push({ id: `room_${i + 1}`, name: `Room ${101 + i}`, type: "regular", capacity: ms });
    for (let i = 0; i < lc; i++) rooms.push({ id: `lab_${i + 1}`, name: `Lab ${i + 1}`, type: "lab", capacity: ms });
    for (let i = 0; i < gc; i++) rooms.push({ id: `gym_${i + 1}`, name: `Gym ${i + 1}`, type: "gym", capacity: ms * 2 });
    setConfig({ ...c, departments: depts, studentCount: sc, roomCount: rc, labCount: lc, gymCount: gc, maxClassSize: ms, targetLoad: validLoad, teachers, courses, rooms, students: { count: sc } });
    onNext();
  };

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Quick Setup</h2>
      <div style={{ maxWidth: 750 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
          <NumInput label="Total Students" min={10} max={5000} value={sc} onChange={setSc} />
          <NumInput label="Max Class Size" min={10} max={50} value={ms} onChange={setMs} />
          {/* DYNAMIC TEXT */}
          <NumInput label={isAB ? "Total Classes per Teacher" : "Classes/Day per Teacher"} min={1} max={10} value={tl} onChange={setTl} helperText={`Max possible: ${maxTeachable}`} />
        </div>
        <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, background: COLORS.accentLight, color: COLORS.darkGray }}>
          <strong>Student Load:</strong> {coreDepts.length} core classes + {Math.max(0, (isAB ? periodCount * 2 : periodCount) - coreDepts.length - (c.lunchModel !== "separate" ? (isAB ? 2 : 1) : 0))} elective/PE slots to fill per student.
        </div>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>🏫 Rooms</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
          <NumInput label="Regular" min={1} max={100} value={rc} onChange={setRc} />
          <NumInput label="Labs" min={0} max={20} value={lc} onChange={setLc} />
          <NumInput label="Gyms" min={0} max={5} value={gc} onChange={setGc} />
        </div>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>👨‍🏫 Departments & Teachers</h3>
        {depts.map((d, i) => (
          <div key={d.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, padding: 10, background: COLORS.offWhite, borderRadius: expanded === i ? "8px 8px 0 0" : 8, flexWrap: "wrap", alignItems: "center" }}>
              <input value={d.name} onChange={e => upD(i, "name", e.target.value)} placeholder="Dept name" style={{ ...INPUT_STYLE, flex: 2, minWidth: 120, width: "auto" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="number" min={1} max={50} value={d.teacherCount} onChange={e => upD(i, "teacherCount", parseInt(e.target.value) || 1)} style={SMALL_INPUT} />
                <span style={{ fontSize: 12, color: COLORS.textLight }}>tchrs</span>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer", color: COLORS.text }}>
                <input type="checkbox" checked={d.required || false} onChange={e => upD(i, "required", e.target.checked)} /> Core
              </label>
              <select value={d.roomType || "regular"} onChange={e => upD(i, "roomType", e.target.value)} style={{ ...SELECT_STYLE, width: "auto", padding: "5px 8px", fontSize: 12 }}>
                <option value="regular">Room</option><option value="lab">Lab</option><option value="gym">Gym</option>
              </select>
              <div onClick={() => setExpanded(expanded === i ? null : i)} style={{ cursor: "pointer", fontSize: 13, color: COLORS.primary, fontWeight: 600, padding: "4px 8px" }}>
                {expanded === i ? "▲ Hide" : "✏️ Names"}
              </div>
              <div onClick={() => setDepts(depts.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: COLORS.danger, fontSize: 18, marginLeft: "auto" }}>×</div>
            </div>
            {expanded === i && (
              <div style={{ padding: 12, background: COLORS.white, border: `1px solid ${COLORS.lightGray}`, borderTop: "none", borderRadius: "0 0 8px 8px" }}>
                <p style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>Name teachers & assign floaters:</p>
                {Array.from({ length: d.teacherCount || 1 }, (_, ti) => (
                  <div key={ti} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: COLORS.textLight, width: 24 }}>{ti + 1}.</span>
                    <input 
                      value={(d.teacherNames || [])[ti] || ""} 
                      onChange={e => { const n = [...(d.teacherNames || [])]; n[ti] = e.target.value; upD(i, "teacherNames", n); }} 
                      placeholder={`${d.name} Teacher ${ti + 1}`} 
                      style={{ ...INPUT_STYLE, flex: 1, width: "auto" }} 
                    />
                    <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: COLORS.text }}>
                      <input 
                        type="checkbox" 
                        checked={(d.teacherFloaters || [])[ti] || false} 
                        onChange={e => { const f = [...(d.teacherFloaters || [])]; f[ti] = e.target.checked; upD(i, "teacherFloaters", f); }} 
                      /> 
                      Is Floater
                    </label>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: COLORS.textLight, padding: "4px 10px" }}>
              → {d.required ? `${Math.max((d.teacherCount || 1) * validLoad, Math.ceil(sc / ms))}` : `${(d.teacherCount || 1) * validLoad}`} sections
              {d.required ? " (core: every student takes 1)" : " (elective)"}
            </div>
          </div>
        ))}
        <Btn variant="ghost" small onClick={() => setDepts([...depts, { id: `d_${Date.now()}`, name: "", teacherCount: 1, required: false, roomType: "regular", teacherNames: [] }])}>+ Add Department</Btn>
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={cont}>Continue →</Btn>
      </div>
    </div>
  );
}

export function CSVUploadStep({ config: c, setConfig, onNext, onBack }) {
  const [af, setAf] = useState("teachers");
  const [fn, setFn] = useState({});
  const [pd, setPd] = useState({});
  const [cm, setCm] = useState({});
  const fts = [
    { id: "teachers", label: "Teachers", fields: ["name","department","isFloater"] },
    { id: "courses", label: "Courses", fields: ["name","department","maxSize","sections","required"] },
    { id: "rooms", label: "Rooms", fields: ["name","type","capacity"] },
  ];
  const handleFile = (type, e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const lines = ev.target.result.split("\n").map(l => l.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
      if (lines.length > 1) {
        const h = lines[0]; const rows = lines.slice(1).filter(r => r.some(c => c));
        setPd(p => ({ ...p, [type]: { headers: h, rows } }));
        setFn(p => ({ ...p, [type]: f.name }));
        const ft = fts.find(x => x.id === type);
        const map = {};
        ft.fields.forEach(field => { const idx = h.findIndex(hh => hh.toLowerCase().includes(field.toLowerCase())); if (idx >= 0) map[field] = idx; });
        setCm(x => ({ ...x, [type]: map }));
      }
    }; r.readAsText(f);
  };
  const cont = () => {
    const teachers = [], courses = [], rooms = [];
    if (pd.teachers?.rows) pd.teachers.rows.forEach((r, i) => { 
      const m = cm.teachers || {}; 
      teachers.push({ 
        id: `t_${i}`, 
        name: m.name !== undefined ? r[m.name] : `Teacher ${i+1}`, 
        departments: [m.department !== undefined ? r[m.department] : "general"], 
        isFloater: m.isFloater !== undefined ? (r[m.isFloater]?.toLowerCase() === "true" || r[m.isFloater]?.toLowerCase() === "yes") : false 
      }); 
    });
    if (pd.courses?.rows) pd.courses.rows.forEach((r, i) => { const m = cm.courses || {}; courses.push({ id: `c_${i}`, name: m.name !== undefined ? r[m.name] : `Course ${i+1}`, department: m.department !== undefined ? r[m.department] : "general", maxSize: m.maxSize !== undefined ? parseInt(r[m.maxSize]) || 30 : 30, sections: m.sections !== undefined ? parseInt(r[m.sections]) || 1 : 1, required: m.required !== undefined ? r[m.required]?.toLowerCase() === "yes" : true }); });
    if (pd.rooms?.rows) pd.rooms.rows.forEach((r, i) => { const m = cm.rooms || {}; rooms.push({ id: `r_${i}`, name: m.name !== undefined ? r[m.name] : `Room ${i+1}`, type: m.type !== undefined ? r[m.type] : "regular", capacity: m.capacity !== undefined ? parseInt(r[m.capacity]) || 30 : 30 }); });
    else { for (let i = 0; i < 20; i++) rooms.push({ id: `r_${i}`, name: `Room ${101+i}`, type: "regular", capacity: 30 }); rooms.push({ id: "lab_0", name: "Lab 1", type: "lab", capacity: 30 }); rooms.push({ id: "lab_1", name: "Lab 2", type: "lab", capacity: 30 }); }
    setConfig({ ...c, teachers, courses, rooms, students: { count: 300 } }); onNext();
  };
  const ft = fts.find(f => f.id === af);
  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Upload CSV Data</h2>
      <div style={{ background: COLORS.accentLight, borderRadius: 8, padding: "8px 14px", marginBottom: 18, fontSize: 13, color: COLORS.primaryDark }}>🔒 Processed in your browser only.</div>
      <Tabs tabs={fts.map(f => ({ id: f.id, label: `${f.label} ${fn[f.id] ? "✓" : ""}` }))} active={af} onChange={setAf} />
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "inline-block", padding: "10px 20px", borderRadius: 8, cursor: "pointer", background: COLORS.primary, color: COLORS.white, fontWeight: 600 }}>
          Choose {ft.label} CSV <input type="file" accept=".csv" onChange={e => handleFile(af, e)} style={{ display: "none" }} />
        </label>
        {fn[af] && <span style={{ marginLeft: 12, color: COLORS.success }}>✓ {fn[af]}</span>}
        {pd[af] && (
          <div style={{ marginTop: 14 }}>
            <h4 style={{ fontSize: 14, marginBottom: 8, color: COLORS.text }}>Map Columns</h4>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              {ft.fields.map(field => (
                <div key={field}><label style={{ fontSize: 12, display: "block", color: COLORS.text }}>{field}</label>
                  <select value={cm[af]?.[field] ?? ""} onChange={e => setCm({ ...cm, [af]: { ...cm[af], [field]: e.target.value === "" ? undefined : parseInt(e.target.value) } })} style={{ ...SELECT_STYLE, width: "auto", padding: "4px 8px" }}>
                    <option value="">-- Skip --</option>
                    {pd[af].headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${COLORS.lightGray}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr>{pd[af].headers.map((h, i) => <th key={i} style={{ padding: "6px 8px", background: COLORS.offWhite, textAlign: "left", borderBottom: `1px solid ${COLORS.lightGray}`, color: COLORS.text }}>{h}</th>)}</tr></thead>
                <tbody>{pd[af].rows.slice(0, 5).map((row, ri) => <tr key={ri}>{row.map((cell, j) => <td key={j} style={{ padding: "4px 8px", borderBottom: `1px solid ${COLORS.lightGray}`, color: COLORS.text }}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={cont}>Continue →</Btn>
      </div>
    </div>
  );
}

export function ConstraintsStep({ config: c, setConfig, onNext, onBack }) {
  const [cons, setCons] = useState(c.constraints || []);
  const [avail, setAvail] = useState(c.teacherAvailability || []); // NEW State
  const [showCon, setShowCon] = useState(false);
  const [nc, setNc] = useState({ type: "lock_period", priority: "must" });
  
  const [showAvail, setShowAvail] = useState(false);
  const [na, setNa] = useState({ teacherId: "", blockedPeriods: [] });

  const periods = c.periods || [];
  const teachers = c.teachers || [];

  const types = [{ value: "lock_period", label: "Lock Course to Period" }];

  const saveAvail = () => {
    if(!na.teacherId || na.blockedPeriods.length === 0) return;
    const filtered = avail.filter(a => a.teacherId !== na.teacherId);
    setAvail([...filtered, { teacherId: na.teacherId, blockedPeriods: na.blockedPeriods }]);
    setShowAvail(false);
    setNa({ teacherId: "", blockedPeriods: [] });
  };

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>Constraints & Part-Time Staff</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>Set hard scheduling rules and staff availability.</p>
      
      <div style={{ maxWidth: 700 }}>
        {/* --- SECTION 1: PART-TIME STAFF --- */}
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.lightGray}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 12px 0", color: COLORS.primaryDark }}>⏱️ Staff Availability (Part-Time)</h3>
          
          {avail.map(a => {
            const tName = teachers.find(t => t.id === a.teacherId)?.name || "Unknown";
            const pLabels = a.blockedPeriods.map(pid => periods.find(p => p.id === pid)?.label || `P${pid}`).join(", ");
            return (
              <div key={a.teacherId} style={{ display: "flex", justifyContent: "space-between", padding: 8, background: "#FFF4E5", borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
                <div><strong>{tName}</strong> is UNAVAILABLE during: {pLabels}</div>
                <div onClick={() => setAvail(avail.filter(x => x.teacherId !== a.teacherId))} style={{ cursor: "pointer", color: COLORS.danger }}>✕</div>
              </div>
            );
          })}

          {showAvail ? (
            <div style={{ padding: 12, background: COLORS.offWhite, borderRadius: 8, marginTop: 10 }}>
              <Sel label="Select Teacher" value={na.teacherId} onChange={v => setNa({ ...na, teacherId: v })} options={[{ value: "", label: "Select..." }, ...teachers.map(t => ({ value: t.id, label: t.name }))]} />
              
              {na.teacherId && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Select Blocked Periods:</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {periods.map(p => {
                      const isBlocked = na.blockedPeriods.includes(p.id);
                      return (
                        <div key={p.id} onClick={() => setNa({ ...na, blockedPeriods: isBlocked ? na.blockedPeriods.filter(id => id !== p.id) : [...na.blockedPeriods, p.id] })}
                          style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: `1px solid ${isBlocked ? COLORS.danger : COLORS.lightGray}`, background: isBlocked ? COLORS.danger : COLORS.white, color: isBlocked ? COLORS.white : COLORS.text }}>
                          {p.label} {isBlocked && "🚫"}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <Btn onClick={saveAvail} small>Save Availability</Btn>
                    <Btn variant="secondary" onClick={() => setShowAvail(false)} small>Cancel</Btn>
                  </div>
                </div>
              )}
            </div>
          ) : <Btn variant="ghost" onClick={() => setShowAvail(true)} small>+ Add Teacher Restriction</Btn>}
        </div>

        {/* --- SECTION 2: COURSE LOCKS --- */}
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.lightGray}`, borderRadius: 8, padding: 16 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 12px 0", color: COLORS.primaryDark }}>🔒 Course Constraints</h3>
          {cons.map(con => (
            <div key={con.id} style={{ display: "flex", justifyContent: "space-between", padding: 8, background: COLORS.offWhite, borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
              <div><strong>{types.find(t => t.value === con.type)?.label}</strong>{con.courseId && ` — ${c.courses?.find(x=>x.id===con.courseId)?.name}`}{con.period && ` — P${con.period}`}</div>
              <div onClick={() => setCons(cons.filter(x => x.id !== con.id))} style={{ cursor: "pointer", color: COLORS.danger }}>✕</div>
            </div>
          ))}

          {showCon ? (
            <div style={{ padding: 12, background: COLORS.offWhite, borderRadius: 8, marginTop: 10 }}>
              <Sel label="Type" value={nc.type} onChange={v => setNc({ ...nc, type: v })} options={types} />
              <Sel label="Course" value={nc.courseId || ""} onChange={v => setNc({ ...nc, courseId: v })} options={[{ value: "", label: "Select..." }, ...(c.courses || []).map(x => ({ value: x.id, label: x.name }))]} />
              <NumInput label="Period" min={1} max={c.periodsCount || 7} value={nc.period || 1} onChange={v => setNc({ ...nc, period: v })} />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <Btn onClick={() => { setCons([...cons, { ...nc, id: `con_${Date.now()}` }]); setShowCon(false); }} small>Add</Btn>
                <Btn variant="secondary" onClick={() => setShowCon(false)} small>Cancel</Btn>
              </div>
            </div>
          ) : <Btn variant="ghost" onClick={() => setShowCon(true)} small>+ Add Course Lock</Btn>}
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={() => { setConfig({ ...c, constraints: cons, teacherAvailability: avail }); onNext(); }}>⚡ Generate Schedule →</Btn>
      </div>
    </div>
  );
}