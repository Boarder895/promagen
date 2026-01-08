// src/components/settings/intelligence-settings-client.tsx
// ============================================================================
// INTELLIGENCE SETTINGS CLIENT COMPONENT
// ============================================================================
// Settings panel for Prompt Intelligence preferences.
// Authority: docs/authority/prompt-intelligence.md §10
// ============================================================================

'use client';

import React, { useState, useMemo } from 'react';
import {
  Settings,
  Sparkles,
  Eye,
  Sliders,
  RotateCcw,
  Download,
  Upload,
  Check,
  X,
  ChevronDown,
  AlertTriangle,
  Zap,
  Scissors,
  MessageSquareWarning,
  TrendingUp,
  HelpCircle,
  Minimize2,
  Activity,
  Percent,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFamilies } from '@/lib/prompt-intelligence';
import useIntelligencePreferences from '@/hooks/use-intelligence-preferences';
import type { IntelligencePreferences } from '@/types/intelligence-preferences';
import { PREFERENCE_METADATA } from '@/types/intelligence-preferences';
import Button from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

// ============================================================================
// TYPES
// ============================================================================

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

interface FamilySelectorProps {
  label: string;
  description: string;
  value: string | null;
  onChange: (value: string | null) => void;
  families: Array<{ id: string; name: string }>;
}

interface FamilyMultiSelectProps {
  label: string;
  description: string;
  selected: string[];
  onAdd: (family: string) => void;
  onRemove: (family: string) => void;
  families: Array<{ id: string; name: string }>;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Toggle row for boolean preferences.
 */
function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleRowProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-lg border border-slate-800/50 bg-slate-900/30 p-4 transition-colors',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'hover:border-slate-700/50'
      )}
    >
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-200">{label}</span>
        </div>
        <p className="text-sm text-slate-400 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2',
          'focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
          checked ? 'bg-sky-600' : 'bg-slate-700',
          disabled && 'cursor-not-allowed'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0',
            'transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

/**
 * Dropdown selector for single family preference.
 */
function FamilySelector({
  label,
  description,
  value,
  onChange,
  families,
}: FamilySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedFamily = families.find(f => f.id === value);
  
  return (
    <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-4">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 text-slate-400">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-slate-200">{label}</span>
          <p className="text-sm text-slate-400 mt-0.5">{description}</p>
          
          <div className="relative mt-3">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                'flex w-full items-center justify-between rounded-md border border-slate-700',
                'bg-slate-800 px-3 py-2 text-sm text-left',
                'focus:outline-none focus:ring-2 focus:ring-sky-500'
              )}
            >
              <span className={selectedFamily ? 'text-slate-200' : 'text-slate-500'}>
                {selectedFamily?.name ?? 'No preference (neutral)'}
              </span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
            </button>
            
            {isOpen && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-700 bg-slate-800 shadow-lg max-h-60 overflow-auto">
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors',
                    !value && 'bg-slate-700/50 text-sky-400'
                  )}
                >
                  No preference (neutral)
                </button>
                {families.map(family => (
                  <button
                    key={family.id}
                    type="button"
                    onClick={() => {
                      onChange(family.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors',
                      value === family.id && 'bg-slate-700/50 text-sky-400'
                    )}
                  >
                    {family.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Multi-select for avoid families.
 */
function FamilyMultiSelect({
  label,
  description,
  selected,
  onAdd,
  onRemove,
  families,
}: FamilyMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const availableFamilies = families.filter(f => !selected.includes(f.id));
  
  return (
    <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-4">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 text-slate-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-slate-200">{label}</span>
          <p className="text-sm text-slate-400 mt-0.5">{description}</p>
          
          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selected.map(familyId => {
                const family = families.find(f => f.id === familyId);
                return (
                  <span
                    key={familyId}
                    className="inline-flex items-center gap-1 rounded-full bg-red-900/30 border border-red-800/50 px-2 py-1 text-xs text-red-300"
                  >
                    {family?.name ?? familyId}
                    <button
                      type="button"
                      onClick={() => onRemove(familyId)}
                      className="hover:text-red-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          
          {/* Add dropdown */}
          {availableFamilies.length > 0 && (
            <div className="relative mt-3">
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                  'flex items-center gap-2 rounded-md border border-slate-700 border-dashed',
                  'bg-slate-800/50 px-3 py-2 text-sm text-slate-400',
                  'hover:border-slate-600 hover:text-slate-300 transition-colors'
                )}
              >
                <span>+ Add family to avoid</span>
              </button>
              
              {isOpen && (
                <div className="absolute z-10 mt-1 w-64 rounded-md border border-slate-700 bg-slate-800 shadow-lg max-h-60 overflow-auto">
                  {availableFamilies.map(family => (
                    <button
                      key={family.id}
                      type="button"
                      onClick={() => {
                        onAdd(family.id);
                        setIsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors"
                    >
                      {family.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {selected.length === 0 && availableFamilies.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              No families blocked. All styles will be suggested.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function IntelligenceSettingsClient() {
  const {
    preferences,
    isLoading,
    togglePreference,
    setPreference,
    addAvoidFamily,
    removeAvoidFamily,
    resetToDefaults,
    exportPreferences,
    importPreferences,
  } = useIntelligencePreferences();
  
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  
  // Get available families
  const familiesData = useMemo(() => {
    try {
      const data = getFamilies();
      return Object.entries(data.families).map(([id, family]) => ({
        id,
        name: family.displayName,
      }));
    } catch {
      return [];
    }
  }, []);
  
  // Handle export
  const handleExport = () => {
    const json = exportPreferences();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'promagen-intelligence-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Handle import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      const success = importPreferences(json);
      if (success) {
        setImportSuccess(true);
        setImportError(null);
        setTimeout(() => setImportSuccess(false), 3000);
      } else {
        setImportError('Invalid settings file');
        setTimeout(() => setImportError(null), 3000);
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file');
      setTimeout(() => setImportError(null), 3000);
    };
    reader.readAsText(file);
    
    // Reset input
    e.target.value = '';
  };
  
  // Icon map for preferences
  const iconMap: Record<keyof IntelligencePreferences, React.ReactNode> = {
    liveReorderEnabled: <Zap className="h-5 w-5" />,
    smartTrimEnabled: <Scissors className="h-5 w-5" />,
    conflictWarningsEnabled: <MessageSquareWarning className="h-5 w-5" />,
    suggestionsEnabled: <Sparkles className="h-5 w-5" />,
    marketMoodEnabled: <TrendingUp className="h-5 w-5" />,
    showDNABar: <Activity className="h-5 w-5" />,
    showCoherenceScore: <Percent className="h-5 w-5" />,
    compactSuggestions: <Minimize2 className="h-5 w-5" />,
    showWhyThisTooltips: <HelpCircle className="h-5 w-5" />,
    preferFamily: <Sparkles className="h-5 w-5" />,
    avoidFamilies: <AlertTriangle className="h-5 w-5" />,
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-slate-400">Loading preferences...</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Settings className="h-7 w-7 text-sky-400" />
            Prompt Intelligence Settings
          </h1>
          <p className="text-slate-400 mt-1">
            Customize how Promagen helps you build better prompts
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Tooltip text="Reset all settings to defaults">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </Tooltip>
        </div>
      </div>
      
      {/* Feature Toggles Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-slate-200">Features</h2>
        </div>
        <div className="space-y-3">
          {PREFERENCE_METADATA
            .filter(p => p.category === 'features' && p.type === 'toggle')
            .map(pref => (
              <ToggleRow
                key={pref.key}
                icon={iconMap[pref.key]}
                label={pref.label}
                description={pref.description}
                checked={preferences[pref.key] as boolean}
                onChange={() => togglePreference(pref.key)}
              />
            ))
          }
        </div>
      </section>
      
      {/* Display Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-slate-200">Display</h2>
        </div>
        <div className="space-y-3">
          {PREFERENCE_METADATA
            .filter(p => p.category === 'display' && p.type === 'toggle')
            .map(pref => (
              <ToggleRow
                key={pref.key}
                icon={iconMap[pref.key]}
                label={pref.label}
                description={pref.description}
                checked={preferences[pref.key] as boolean}
                onChange={() => togglePreference(pref.key)}
              />
            ))
          }
        </div>
      </section>
      
      {/* Scoring Preferences Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-slate-200">Scoring Preferences</h2>
        </div>
        <div className="space-y-3">
          <FamilySelector
            label="Preferred Style"
            description="Bias suggestions toward a specific style family"
            value={preferences.preferFamily}
            onChange={(value) => setPreference('preferFamily', value)}
            families={familiesData}
          />
          
          <FamilyMultiSelect
            label="Avoid Styles"
            description="Never suggest options from these style families"
            selected={preferences.avoidFamilies}
            onAdd={addAvoidFamily}
            onRemove={removeAvoidFamily}
            families={familiesData}
          />
        </div>
      </section>
      
      {/* Import/Export Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-200">Backup & Restore</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Settings
          </Button>
          
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <span className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
              'border border-slate-700 bg-slate-800 text-slate-300',
              'hover:bg-slate-700 transition-colors'
            )}>
              <Upload className="h-4 w-4" />
              Import Settings
            </span>
          </label>
          
          {importSuccess && (
            <span className="flex items-center gap-1 text-sm text-emerald-400">
              <Check className="h-4 w-4" />
              Settings imported!
            </span>
          )}
          
          {importError && (
            <span className="flex items-center gap-1 text-sm text-red-400">
              <X className="h-4 w-4" />
              {importError}
            </span>
          )}
        </div>
      </section>
      
      {/* Info Footer */}
      <div className="rounded-lg border border-sky-900/50 bg-sky-950/30 p-4">
        <p className="text-sm text-sky-200">
          <span className="font-medium">💡 Tip:</span> Settings are saved automatically
          to your browser. They&apos;ll persist across sessions but are device-specific.
          Use Export to backup or transfer settings between devices.
        </p>
      </div>
    </div>
  );
}

export default IntelligenceSettingsClient;
