
import React, { useState } from 'react';
import { COLORS } from "../../../utils/theme";
import { Btn, Card } from "../../../components/ui/CoreUI";
import { WizardState, ScheduleVariantDef } from "../../../types";

interface StepProps {
  config: Partial<WizardState>;
  setConfig: (config: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

const DAYS = [
  { id: 1, label: "Mon" }, { id: 2, label: "Tue" }, { id: 3, label: "Wed" },
  { id: 4, label: "Thu" }, { id: 5, label: "Fri" }
];

export function ScheduleStructureStep({ config: c, setConfig, onNext, onBack }: StepProps) {
  const [variants, setVariants] = useState<Partial<ScheduleVariantDef>[]>(
    c.scheduleVariantDefs || [{ id: `variant_0`, name: "Standard Days", assignedDays: [1,2,3,4,5] }]
  );

  const handleStructureSelect = (structure: 'single' | 'multiple') => {
    setConfig({ ...c, scheduleStructure: structure });
    if (structure === 'single') {
      // Clear out variant info if user switches back to single
      setConfig({ ...c, scheduleStructure: 'single', scheduleVariantDefs: undefined, variantConfigs: undefined });
    }
  };

  const handleDayToggle = (variantIndex: number, dayId: number) => {
    const newVariants = [...variants];
    const currentDays = newVariants[variantIndex].assignedDays || [];
    const dayIndex = currentDays.indexOf(dayId);
    
    if (dayIndex > -1) {
      newVariants[variantIndex].assignedDays = currentDays.filter(d => d !== dayId);
    } else {
      newVariants[variantIndex].assignedDays = [...currentDays, dayId];
    }
    setVariants(newVariants);
  };
  
  const handleNameChange = (variantIndex: number, name: string) => {
    const newVariants = [...variants];
    newVariants[variantIndex].name = name;
    setVariants(newVariants);
  };

  const addVariant = () => {
    if (variants.length < 3) {
      setVariants([...variants, { id: `variant_${variants.length}`, name: `Variant ${variants.length + 1}`, assignedDays: [] }]);
    }
  };

  const removeVariant = (index: number) => {
    const newVariants = variants.filter((_, i) => i !== index);
    setVariants(newVariants);
  };
  
  const handleContinue = () => {
    if (c.scheduleStructure === 'single') {
      onNext();
      return;
    }
    
    // On continue, save the variant definitions to the main config
    const finalVariants = variants.map(v => ({
      id: v.id!,
      name: v.name!,
      assignedDays: v.assignedDays!
    }));

    // Initialize variantConfigs if they don't exist
    const newVariantConfigs = c.variantConfigs || {};
    for (const variant of finalVariants) {
      if (!newVariantConfigs[variant.id]) {
        newVariantConfigs[variant.id] = {};
      }
    }
    
    setConfig({ ...c, scheduleVariantDefs: finalVariants, variantConfigs: newVariantConfigs, activeVariantId: finalVariants[0]?.id });
    onNext();
  };
  
  const isContinueDisabled = c.scheduleStructure === 'multiple' && (
    variants.some(v => !v.name || !v.assignedDays || v.assignedDays.length === 0) ||
    variants.length === 0
  );

  return (
    <div>
      <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>How is the schedule structured?</h2>
      <p style={{ color: COLORS.textLight, marginBottom: 20, fontSize: 14 }}>
        Does your school use the same bell schedule every day, or does it vary?
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <Card selected={c.scheduleStructure === 'single'} onClick={() => handleStructureSelect('single')}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Same Every Day</div>
          <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.5 }}>
            The bell schedule, lunches, and period structure are identical for all school days.
          </div>
        </Card>
        <Card selected={c.scheduleStructure === 'multiple'} onClick={() => handleStructureSelect('multiple')}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Varies By Day</div>
          <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.5 }}>
            Use this for different daily schedules, like early release days or alternating block schedules.
          </div>
        </Card>
      </div>

      {c.scheduleStructure === 'multiple' && (
        <Card style={{ background: COLORS.background }}>
          <h3 style={{ marginTop: 0, color: COLORS.primary }}>Define Schedule Types</h3>
          <p style={{ color: COLORS.textLight, fontSize: 13, marginTop: -10, marginBottom: 20 }}>
            Create up to 3 different schedule types and assign the days of the week for each.
          </p>
          
          {variants.map((variant, index) => (
            <Card key={index} style={{ marginBottom: 16 }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <input
                  type="text"
                  value={variant.name || ''}
                  onChange={(e) => handleNameChange(index, e.target.value)}
                  placeholder="E.g., Standard Day"
                  style={{ border: 'none', borderBottom: `1px solid ${COLORS.lightGray}`, fontSize: 16, fontWeight: 'bold', padding: '4px 0', outline: 'none', width: '70%' }}
                />
                {variants.length > 1 && <Btn small variant="danger" onClick={() => removeVariant(index)}>Remove</Btn>}
              </div>

              <div style={{marginTop: 16}}>
                <label style={{fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8, display: 'block'}}>Assigned Days</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {DAYS.map(day => (
                    <button
                      key={day.id}
                      onClick={() => handleDayToggle(index, day.id)}
                      style={{
                        padding: '8px 12px',
                        border: `1px solid ${COLORS.lightGray}`,
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: (variant.assignedDays || []).includes(day.id) ? COLORS.primary : COLORS.white,
                        color: (variant.assignedDays || []).includes(day.id) ? COLORS.white : COLORS.text
                      }}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          ))}

          {variants.length < 3 && <Btn variant="secondary" onClick={addVariant}>+ Add Schedule Type</Btn>}
        </Card>
      )}

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <Btn onClick={onBack} variant="secondary">← Back</Btn>
        <Btn onClick={handleContinue} disabled={!c.scheduleStructure || isContinueDisabled}>Continue →</Btn>
      </div>
    </div>
  );
}
