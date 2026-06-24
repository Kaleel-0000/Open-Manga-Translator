import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';
import { ExtensionSettings, DEFAULT_SETTINGS } from '@/interfaces';
import { TRANSLATION_PROVIDER_REGISTRY } from '@/services/translator/TranslationProviderRegistry';
import { OCR_PROVIDER_REGISTRY } from '@/services/ocr/OCRProviderRegistry';
import './options.css';

function OptionsPage(): JSX.Element {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [cacheSize, setCacheSize] = useState<string>('');

  useEffect(() => {
    browser.runtime.sendMessage({ type: 'GET_SETTINGS', payload: {} })
      .then((s) => setSettings(s as ExtensionSettings))
      .catch(console.error);
  }, []);

  const update = useCallback(
    <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const save = useCallback(async () => {
    await browser.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [settings]);

  const resetDefaults = useCallback(async () => {
    if (!confirm('Reset all settings to defaults?')) return;
    setSettings({ ...DEFAULT_SETTINGS });
    await browser.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: DEFAULT_SETTINGS });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const clearCache = useCallback(async () => {
    await browser.runtime.sendMessage({ type: 'CLEAR_CACHE', payload: {} });
    setCacheSize('Cleared!');
    setTimeout(() => setCacheSize(''), 2000);
  }, []);

  const selectedTransProvider = TRANSLATION_PROVIDER_REGISTRY.find(
    (p) => p.id === settings.translationProvider,
  );

  return (
    <div className="options-page">
      <header className="page-header">
        <h1>Manga Translate — Settings</h1>
        <div className="header-actions">
          <button className="btn-link danger" onClick={resetDefaults}>Reset Defaults</button>
          <button className="btn-save" onClick={save}>
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </header>

      <div className="content">
        {/* General */}
        <Section title="General">
          <Field label="Enable Extension">
            <Toggle
              checked={settings.enabled}
              onChange={(v) => update('enabled', v)}
            />
          </Field>
          <Field label="Auto-translate on page load">
            <Toggle
              checked={settings.autoTranslate}
              onChange={(v) => update('autoTranslate', v)}
            />
          </Field>
        </Section>

        {/* Languages */}
        <Section title="Languages">
          <Field label="Target Language">
            <LanguageSelect
              value={settings.targetLang}
              onChange={(v) => update('targetLang', v)}
            />
          </Field>
          <Field label="Source Language">
            <LanguageSelect
              value={settings.sourceLang}
              onChange={(v) => update('sourceLang', v)}
              includeAuto
            />
          </Field>
        </Section>

        {/* OCR */}
        <Section title="OCR Provider">
          <Field label="Provider">
            <select
              value={settings.ocrProvider}
              onChange={(e) => update('ocrProvider', e.target.value)}
            >
              {OCR_PROVIDER_REGISTRY.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
          </Field>
          {settings.ocrProvider === 'google-vision' && (
            <Field label="Google Vision API Key">
              <ApiKeyInput
                value={settings.apiKeys['google-vision'] ?? ''}
                onChange={(v) => update('apiKeys', { ...settings.apiKeys, 'google-vision': v })}
              />
            </Field>
          )}
        </Section>

        {/* Translation */}
        <Section title="Translation Provider">
          <Field label="Provider">
            <select
              value={settings.translationProvider}
              onChange={(e) => update('translationProvider', e.target.value)}
            >
              {TRANSLATION_PROVIDER_REGISTRY.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} {p.supportsOffline ? '(Offline)' : '(Cloud)'}
                </option>
              ))}
            </select>
          </Field>

          {selectedTransProvider?.requiresApiKey && (
            <Field label={`${selectedTransProvider.displayName} API Key`}>
              <ApiKeyInput
                value={settings.apiKeys[settings.translationProvider] ?? ''}
                onChange={(v) =>
                  update('apiKeys', {
                    ...settings.apiKeys,
                    [settings.translationProvider]: v,
                  })
                }
              />
            </Field>
          )}

          {(settings.translationProvider === 'ollama' ||
            settings.translationProvider === 'libretranslate') && (
            <Field label="Local Server Endpoint">
              <input
                type="text"
                value={settings.localModelEndpoint}
                onChange={(e) => update('localModelEndpoint', e.target.value)}
                placeholder="http://localhost:11434"
              />
            </Field>
          )}

          <Field label="Translate sound effects">
            <Toggle
              checked={settings.translateSfx}
              onChange={(v) => update('translateSfx', v)}
            />
          </Field>
        </Section>

        {/* Image processing */}
        <Section title="Image Processing">
          <Field label="Inpaint quality">
            <select
              value={settings.inpaintQuality}
              onChange={(e) =>
                update('inpaintQuality', e.target.value as 'fast' | 'quality')
              }
            >
              <option value="fast">Fast (color fill)</option>
              <option value="quality">Quality (inpainting algorithm)</option>
            </select>
          </Field>
        </Section>

        {/* Text rendering */}
        <Section title="Text Rendering">
          <Field label="Font Family">
            <input
              type="text"
              value={settings.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
              placeholder='Bangers, "Comic Sans MS", sans-serif'
            />
          </Field>
          <Field label="Max Font Size (px)">
            <input
              type="number"
              value={settings.maxFontSize}
              min={8}
              max={48}
              onChange={(e) => update('maxFontSize', Number(e.target.value))}
            />
          </Field>
          <Field label="Text Color">
            <input
              type="color"
              value={settings.textColor}
              onChange={(e) => update('textColor', e.target.value)}
            />
          </Field>
          <Field label="Stroke / Outline">
            <Toggle
              checked={settings.strokeEnabled}
              onChange={(v) => update('strokeEnabled', v)}
            />
          </Field>
          {settings.strokeEnabled && (
            <Field label="Stroke Color">
              <input
                type="color"
                value={settings.strokeColor}
                onChange={(e) => update('strokeColor', e.target.value)}
              />
            </Field>
          )}
        </Section>

        {/* Cache */}
        <Section title="Cache">
          <Field label="Enable Caching">
            <Toggle
              checked={settings.cacheEnabled}
              onChange={(v) => update('cacheEnabled', v)}
            />
          </Field>
          <Field label="Cache TTL (hours)">
            <input
              type="number"
              value={settings.cacheTtlHours}
              min={1}
              max={720}
              onChange={(e) => update('cacheTtlHours', Number(e.target.value))}
            />
          </Field>
          <Field label="Cache size">
            <div className="cache-row">
              <span className="dim">{cacheSize || 'Unknown'}</span>
              <button className="btn-link danger" onClick={clearCache}>Clear Cache</button>
            </div>
          </Field>
        </Section>

        {/* Theme */}
        <Section title="Appearance">
          <Field label="Theme">
            <select
              value={settings.theme}
              onChange={(e) =>
                update('theme', e.target.value as 'auto' | 'light' | 'dark')
              }
            >
              <option value="auto">Auto (system)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
        </Section>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Reusable sub-components
// ----------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="options-section">
      <h2 className="section-title">{title}</h2>
      <div className="section-body">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field-row">
      <label className="field-label">{label}</label>
      <div className="field-control">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-wrap">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle" />
    </label>
  );
}

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese (Simplified)' }, { code: 'ko', name: 'Korean' },
  { code: 'fr', name: 'French' }, { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' }, { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' }, { code: 'vi', name: 'Vietnamese' },
  { code: 'ar', name: 'Arabic' },
];

function LanguageSelect({
  value, onChange, includeAuto = false,
}: {
  value: string;
  onChange: (v: string) => void;
  includeAuto?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAuto && <option value="auto">Auto Detect</option>}
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>{l.name}</option>
      ))}
    </select>
  );
}

function ApiKeyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="api-key-wrap">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter API key…"
        autoComplete="off"
      />
      <button className="show-btn" onClick={() => setShow((s) => !s)} type="button">
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

// ----------------------------------------------------------------
// Mount
// ----------------------------------------------------------------

const root = document.getElementById('root');
if (root) createRoot(root).render(<OptionsPage />);
