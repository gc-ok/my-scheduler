// src/components/ui/CoreUI.tsx
import React, { useState, useEffect, CSSProperties, ReactNode, ChangeEvent } from "react";
import { COLORS } from "../../utils/theme";

const INPUT_STYLE: CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: `1px solid ${COLORS.lightGray}`, fontSize: 14, outline: "none",
  boxSizing: "border-box", fontFamily: "'Segoe UI', system-ui, sans-serif",
  backgroundColor: COLORS.white, color: COLORS.text, colorScheme: "light",
};
const SELECT_STYLE: CSSProperties = { ...INPUT_STYLE, appearance: "auto" };
export const SMALL_INPUT: CSSProperties = { ...INPUT_STYLE, width: 60, padding: "7px 8px", textAlign: "center" };

interface LogoProps {
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ size = 40 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <img src="https://gceducationanalytics.com/images/gceducationlogo.png" alt="GC Education Analytics" style={{ height: size, objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
  </div>
);

interface BtnProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "accent" | "danger" | "success" | "ghost" | "warning";
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  small?: boolean;
}

export const Btn: React.FC<BtnProps> = ({ children, variant = "primary", onClick, disabled, style, small }) => {
  const v: Record<string, CSSProperties> = {
    primary: { background: COLORS.primary, color: COLORS.white },
    secondary: { background: COLORS.lightGray, color: COLORS.text },
    accent: { background: COLORS.accent, color: COLORS.white },
    danger: { background: COLORS.danger, color: COLORS.white },
    success: { background: COLORS.success, color: COLORS.white },
    ghost: { background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.primary}` },
    warning: { background: COLORS.warning, color: COLORS.white },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "6px 14px" : "10px 22px", borderRadius: 8, border: "none",
      cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, fontSize: small ? 13 : 14,
      fontFamily: "'Segoe UI', system-ui, sans-serif", transition: "all 0.2s",
      opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 6,
      ...v[variant], ...style,
    }}>{children}</button>
  );
};

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  selected?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, onClick, selected }) => {
  const cardStyles = {
    background: COLORS.white, borderRadius: 12, padding: 20, color: COLORS.text,
    border: selected ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.lightGray}`,
    boxShadow: selected ? `0 0 0 3px ${COLORS.accentLight}` : "0 1px 3px rgba(0,0,0,0.06)",
    cursor: onClick ? "pointer" : "default", transition: "all 0.2s", ...style,
  };

  if (onClick) {
    return (
      <button onClick={onClick} aria-pressed={selected} style={{ ...cardStyles, fontFamily: "inherit", fontSize: "inherit", textAlign: "left" as const, width: "100%" }}>
        {children}
      </button>
    );
  }

  return <div style={cardStyles}>{children}</div>;
};

interface NumInputProps {
  label?: string;
  value?: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  helperText?: string;
  style?: CSSProperties;
}

export const NumInput: React.FC<NumInputProps> = ({ label, value, onChange, min, max, helperText, style: sx }) => {
  const [lv, setLv] = useState(String(value ?? ""));
  useEffect(() => { setLv(String(value ?? "")); }, [value]);
  const hc = (e: ChangeEvent<HTMLInputElement>) => { const r = e.target.value; setLv(r); if (r === "" || r === "-") return; const n = parseInt(r, 10); if (!isNaN(n)) onChange(n); };
  const hb = () => { if (lv === "" || isNaN(parseInt(lv, 10))) { const f = min ?? 0; setLv(String(f)); onChange(f); } };
  return (
    <div style={{ marginBottom: 14, ...sx }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{label}</label>}
      <input type="number" value={lv} onChange={hc} onBlur={hb} min={min} max={max} style={INPUT_STYLE} />
      {helperText && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 3 }}>{helperText}</div>}
    </div>
  );
};

interface TimeInputProps {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
}

export const TimeInput: React.FC<TimeInputProps> = ({ label, value, onChange }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{label}</label>}
    <input type="time" value={value || ""} onChange={(e) => onChange(e.target.value)} style={INPUT_STYLE} />
  </div>
);

interface SelOption {
  value: string | number;
  label: string;
}

interface SelProps {
  label?: string;
  value?: string | number;
  onChange: (value: string) => void;
  options: SelOption[];
  helperText?: string;
}

export const Sel: React.FC<SelProps> = ({ label, value, onChange, options, helperText }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{label}</label>}
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={SELECT_STYLE}>
      {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {helperText && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 3 }}>{helperText}</div>}
  </div>
);

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange, description }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, cursor: "pointer", background: "none", border: "none", padding: 0, textAlign: "left", fontFamily: "inherit", width: "100%" }}
  >
    <div aria-hidden="true" style={{ width: 40, height: 22, borderRadius: 11, flexShrink: 0, marginTop: 1, background: checked ? COLORS.primary : COLORS.lightGray, transition: "background 0.2s", position: "relative" }}>
      <div style={{ width: 18, height: 18, borderRadius: 9, background: COLORS.white, position: "absolute", top: 2, left: checked ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </div>
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{label}</div>
      {description && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{description}</div>}
    </div>
  </button>
);

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange }) => (
  <div role="tablist" style={{ display: "flex", gap: 2, borderBottom: `2px solid ${COLORS.lightGray}`, marginBottom: 18, overflowX: "auto" }}>
    {tabs.map(t => (
      <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)} style={{
        padding: "10px 18px", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap",
        fontWeight: active === t.id ? 700 : 500, color: active === t.id ? COLORS.primary : COLORS.textLight,
        borderBottom: active === t.id ? `3px solid ${COLORS.primary}` : "3px solid transparent", marginBottom: -2,
        background: "none", border: "none", fontFamily: "inherit",
      }}>{t.label}</button>
    ))}
  </div>
);