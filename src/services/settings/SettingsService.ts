import browser from 'webextension-polyfill';
import { ExtensionSettings, DEFAULT_SETTINGS } from '@/interfaces';

const STORAGE_KEY = 'manga_translate_settings';

/**
 * Persistent settings backed by chrome.storage.sync (falls back to local).
 * All reads/writes are type-safe.
 */
export class SettingsService {
  private cache: ExtensionSettings | null = null;

  async load(): Promise<ExtensionSettings> {
    if (this.cache) return this.cache;

    try {
      const result = await browser.storage.sync.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
      // Merge with defaults so new fields are always present
      this.cache = { ...DEFAULT_SETTINGS, ...stored };
    } catch {
      // sync quota exceeded or unsupported — fall back to local
      const result = await browser.storage.local.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
      this.cache = { ...DEFAULT_SETTINGS, ...stored };
    }

    return this.cache;
  }

  async save(settings: Partial<ExtensionSettings>): Promise<void> {
    const current = await this.load();
    this.cache = { ...current, ...settings };

    const payload = { [STORAGE_KEY]: this.cache };
    try {
      await browser.storage.sync.set(payload);
    } catch {
      await browser.storage.local.set(payload);
    }
  }

  async reset(): Promise<void> {
    this.cache = { ...DEFAULT_SETTINGS };
    const payload = { [STORAGE_KEY]: this.cache };
    await browser.storage.sync.set(payload).catch(
      () => browser.storage.local.set(payload),
    );
  }

  /** Watch for settings changes from other extension pages */
  onChange(callback: (settings: ExtensionSettings) => void): () => void {
    const listener = (
      changes: Record<string, browser.Storage.StorageChange>,
    ) => {
      if (STORAGE_KEY in changes) {
        this.cache = {
          ...DEFAULT_SETTINGS,
          ...(changes[STORAGE_KEY].newValue as Partial<ExtensionSettings>),
        };
        callback(this.cache);
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }

  /** Safely retrieve an API key — never logged or exposed */
  async getApiKey(providerId: string): Promise<string | undefined> {
    const settings = await this.load();
    return settings.apiKeys[providerId];
  }

  async setApiKey(providerId: string, key: string): Promise<void> {
    const settings = await this.load();
    await this.save({
      apiKeys: { ...settings.apiKeys, [providerId]: key },
    });
  }
}

export const settingsService = new SettingsService();
