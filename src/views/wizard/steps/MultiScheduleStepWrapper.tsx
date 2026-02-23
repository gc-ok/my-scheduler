
import React from 'react';
import { WizardState } from '../../../types';
import { Tabs } from '../../../components/ui/CoreUI';

interface WrapperProps {
  config: Partial<WizardState>;
  setConfig: (config: Partial<WizardState>) => void;
  children: React.ReactElement;
}

export const MultiScheduleStepWrapper: React.FC<WrapperProps> = ({ config, setConfig, children }) => {
  const { scheduleVariantDefs, activeVariantId, variantConfigs } = config;

  if (!scheduleVariantDefs || scheduleVariantDefs.length === 0) {
    return React.cloneElement(children, { config, setConfig });
  }

  const handleTabChange = (id: string) => {
    setConfig({ ...config, activeVariantId: id });
  };

  const tabs = scheduleVariantDefs.map(v => ({ id: v.id, label: v.name }));
  const activeVariantConfig = variantConfigs?.[activeVariantId || ''] || {};
  
  const handleSetConfigForChild = (newChildConfig: Partial<WizardState>) => {
    // The config the child component was originally given
    const oldChildConfig = { ...config, ...activeVariantConfig };

    // Diff the new config from the child against the one it was given to find changes
    const changes: Partial<WizardState> = {};
    for (const key in newChildConfig) {
      if (Object.prototype.hasOwnProperty.call(newChildConfig, key)) {
        const k = key as keyof WizardState;
        // Use stringify for a simple deep-ish comparison. It's not perfect but works for serializable wizard data.
        if (JSON.stringify(oldChildConfig[k]) !== JSON.stringify(newChildConfig[k])) {
          (changes as any)[k] = newChildConfig[k];
        }
      }
    }

    // Merge only the changes into the current variant's config slice
    const newVariantConfig = { ...activeVariantConfig, ...changes };
    
    const newVariantConfigs = {
      ...(config.variantConfigs || {}),
      [activeVariantId!]: newVariantConfig,
    };
    
    setConfig({ ...config, variantConfigs: newVariantConfigs });
  };

  // Props for the child component (e.g., BellScheduleStep)
  const childProps = {
    ...children.props,
    // Provide a merged config for reading
    config: {
        ...config, 
        ...activeVariantConfig
    },
    // Provide the wrapped setConfig for writing
    setConfig: handleSetConfigForChild,
  };

  return (
    <div>
      <Tabs tabs={tabs} active={activeVariantId!} onChange={handleTabChange} />
      {React.cloneElement(children, childProps)}
    </div>
  );
};
