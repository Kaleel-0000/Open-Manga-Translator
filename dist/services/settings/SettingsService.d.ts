import { ExtensionSettings } from '@/interfaces';
/**
 * Persistent settings backed by chrome.storage.sync (falls back to local).
 * All reads/writes are type-safe.
 */
export declare class SettingsService {
    private cache;
    load(): Promise<ExtensionSettings>;
    save(settings: Partial<ExtensionSettings>): Promise<void>;
    reset(): Promise<void>;
    /** Watch for settings changes from other extension pages */
    onChange(callback: (settings: ExtensionSettings) => void): () => void;
    /** Safely retrieve an API key — never logged or exposed */
    getApiKey(providerId: string): Promise<string | undefined>;
    setApiKey(providerId: string, key: string): Promise<void>;
}
export declare const settingsService: SettingsService;
//# sourceMappingURL=SettingsService.d.ts.map