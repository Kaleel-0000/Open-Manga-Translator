import { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';
import { ExtensionSettings, ExtensionMessage, DEFAULT_SETTINGS } from '@/interfaces';
import { TRANSLATION_PROVIDER_REGISTRY } from '@/services/translator/TranslationProviderRegistry';
import { OCR_PROVIDER_REGISTRY } from '@/services/ocr/OCRProviderRegistry';
import './popup.css';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'ko', name: 'Korean' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ar', name: 'Arabic' },
];

// ----------------------------------------------------------------
// Popup App
// ----------------------------------------------------------------

// Load settings directly from chrome.storage — bypasses the service worker entirely
// so the popup works even if the SW hasn't woken up yet.
async function loadSettingsDirect(): Promise<ExtensionSettings> {
  const STORAGE_KEY = 'manga_translate_settings';
  try {
    const result = await browser.storage.sync.get(STORAGE_KEY);
    return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY] as Partial<ExtensionSettings> ?? {}) };
  } catch {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY] as Partial<ExtensionSettings> ?? {}) };
  }
}

async function saveSettingsDirect(s: ExtensionSettings): Promise<void> {
  const STORAGE_KEY = 'manga_translate_settings';
  const payload = { [STORAGE_KEY]: s };
  try {
    await browser.storage.sync.set(payload);
  } catch {
    await browser.storage.local.set(payload);
  }
}

function Popup(): JSX.Element {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Read directly from storage — no service worker round-trip needed
    loadSettingsDirect()
      .then((s) => setSettings(s))
      .catch(() => setSettings({ ...DEFAULT_SETTINGS }));
  }, []);

  const sendToActiveTab = useCallback(async (msg: ExtensionMessage): Promise<boolean> => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus('⚠️ No active tab found.');
      return false;
    }

    // Skip browser internal pages — content scripts cannot run there
    const url = tab.url ?? '';
    if (/^(chrome|edge|about|chrome-extension|moz-extension):\/\//i.test(url)) {
      setStatus('⚠️ Cannot translate browser internal pages. Open a website first.');
      return false;
    }

    try {
      await browser.tabs.sendMessage(tab.id, msg);
      return true;
    } catch (err) {
      const isNoReceiver =
        String(err).includes('Receiving end does not exist') ||
        String(err).includes('Could not establish connection');

      if (isNoReceiver) {
        // Content script not loaded — try to inject it programmatically, then retry once
        try {
          await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js'],
          });
          // Brief pause for the content script to initialise
          await new Promise((r) => setTimeout(r, 300));
          await browser.tabs.sendMessage(tab.id, msg);
          return true;
        } catch {
          setStatus('⚠️ Please refresh the page, then try again.');
          return false;
        }
      }

      setStatus(`⚠️ Error: ${String(err)}`);
      return false;
    }
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => {
      if (!settings) return;
      const next = { ...settings, [key]: value };
      setSettings(next);
      // Write directly to storage; also notify the active tab content script if alive
      await saveSettingsDirect(next);
      sendToActiveTab({ type: 'SAVE_SETTINGS', payload: next }).catch(() => {});
    },
    [settings, sendToActiveTab],
  );

  const handleTranslatePage = useCallback(async () => {
    setLoading(true);
    setStatus('Translating page…');
    const ok = await sendToActiveTab({ type: 'TRANSLATE_PAGE', payload: {} });
    setLoading(false);
    if (ok) { setStatus('Translation started!'); setTimeout(() => setStatus(''), 3000); }
  }, [sendToActiveTab]);

  const handleTranslateVisible = useCallback(async () => {
    setLoading(true);
    setStatus('Translating visible images…');
    const ok = await sendToActiveTab({ type: 'TRANSLATE_VISIBLE', payload: {} });
    setLoading(false);
    if (ok) { setStatus('Done!'); setTimeout(() => setStatus(''), 3000); }
  }, [sendToActiveTab]);

  const handleClearCache = useCallback(async () => {
    // Clear via content script if available; always succeeds even if SW is asleep
    sendToActiveTab({ type: 'CLEAR_CACHE', payload: {} }).catch(() => {});
    setStatus('Cache cleared!');
    setTimeout(() => setStatus(''), 2000);
  }, [sendToActiveTab]);

  if (!settings) {
    return (
      <div className="popup">
        <div className="loading">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="popup">
      {/* Header */}
      <header className="header">
        <img src="assets/icons/icon32.png" alt="" className="logo" />
        <span className="title">Manga Translate</span>
        <label className="toggle-wrap">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSetting('enabled', e.target.checked)}
          />
          <span className="toggle" />
        </label>
      </header>

      {/* Action buttons */}
      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={handleTranslatePage}
          disabled={loading || !settings.enabled}
        >
          Translate Page
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleTranslateVisible}
          disabled={loading || !settings.enabled}
        >
          Translate Visible
        </button>
      </div>

      {status && <div className="status-bar">{status}</div>}

      {/* Language settings */}
      <section className="section">
        <h3 className="section-title">Languages</h3>
        <label className="field">
          <span>Target Language</span>
          <select
            value={settings.targetLang}
            onChange={(e) => updateSetting('targetLang', e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Source Language</span>
          <select
            value={settings.sourceLang}
            onChange={(e) => updateSetting('sourceLang', e.target.value)}
          >
            <option value="auto">Auto Detect</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </label>
      </section>

      {/* Provider settings */}
      <section className="section">
        <h3 className="section-title">Providers</h3>
        <label className="field">
          <span>OCR</span>
          <select
            value={settings.ocrProvider}
            onChange={(e) => updateSetting('ocrProvider', e.target.value)}
          >
            {OCR_PROVIDER_REGISTRY.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Translation</span>
          <select
            value={settings.translationProvider}
            onChange={(e) => updateSetting('translationProvider', e.target.value)}
          >
            {TRANSLATION_PROVIDER_REGISTRY.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
                {p.supportsOffline ? ' ●' : ''}
              </option>
            ))}
          </select>
        </label>
        {TRANSLATION_PROVIDER_REGISTRY.find(
          (p) => p.id === settings.translationProvider,
        )?.supportsOffline === false && (
          <label className="field">
            <span>API Key</span>
            <input
              type="password"
              value={settings.apiKeys[settings.translationProvider] ?? ''}
              onChange={(e) =>
                updateSetting('apiKeys', {
                  ...settings.apiKeys,
                  [settings.translationProvider]: e.target.value,
                })
              }
              placeholder="Enter API key…"
            />
          </label>
        )}
      </section>

      {/* Options */}
      <section className="section">
        <h3 className="section-title">Options</h3>
        <label className="field checkbox">
          <input
            type="checkbox"
            checked={settings.autoTranslate}
            onChange={(e) => updateSetting('autoTranslate', e.target.checked)}
          />
          <span>Auto-translate on page load</span>
        </label>
        <label className="field checkbox">
          <input
            type="checkbox"
            checked={settings.translateSfx}
            onChange={(e) => updateSetting('translateSfx', e.target.checked)}
          />
          <span>Translate sound effects</span>
        </label>
        <label className="field">
          <span>Inpaint quality</span>
          <select
            value={settings.inpaintQuality}
            onChange={(e) =>
              updateSetting('inpaintQuality', e.target.value as 'fast' | 'quality')
            }
          >
            <option value="fast">Fast</option>
            <option value="quality">Quality</option>
          </select>
        </label>
      </section>

      {/* Footer */}
      <footer className="footer">
        <button className="link-btn" onClick={handleClearCache}>Clear Cache</button>
        <button
          className="link-btn"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          Full Settings
        </button>
      </footer>
    </div>
  );
}

// ----------------------------------------------------------------
// Mount
// ----------------------------------------------------------------

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Popup />);
}
