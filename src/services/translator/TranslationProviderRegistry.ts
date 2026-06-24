import { TranslationProvider } from '@/interfaces';
import { LibreTranslateProvider } from './LibreTranslateProvider';
import { OllamaTranslationProvider } from './OllamaTranslationProvider';
import { OpenAITranslationProvider } from './OpenAITranslationProvider';
import { DeepLTranslationProvider } from './DeepLTranslationProvider';
import { GoogleTranslateProvider } from './GoogleTranslateProvider';
import { ClaudeTranslationProvider } from './ClaudeTranslationProvider';
import { LMStudioTranslationProvider } from './LMStudioTranslationProvider';

export interface TranslationProviderMeta {
  id: string;
  displayName: string;
  requiresApiKey: boolean;
  supportsOffline: boolean;
  category: 'local' | 'cloud';
  apiKeyLabel?: string;
}

export const TRANSLATION_PROVIDER_REGISTRY: TranslationProviderMeta[] = [
  {
    id: 'ollama',
    displayName: 'Ollama (Local LLM)',
    requiresApiKey: false,
    supportsOffline: true,
    category: 'local',
  },
  {
    id: 'lm-studio',
    displayName: 'LM Studio (Local)',
    requiresApiKey: false,
    supportsOffline: true,
    category: 'local',
  },
  {
    id: 'libretranslate',
    displayName: 'LibreTranslate',
    requiresApiKey: false,
    supportsOffline: true,
    category: 'local',
  },
  {
    id: 'openai',
    displayName: 'OpenAI GPT',
    requiresApiKey: true,
    supportsOffline: false,
    category: 'cloud',
    apiKeyLabel: 'OpenAI API Key',
  },
  {
    id: 'claude',
    displayName: 'Claude (Anthropic)',
    requiresApiKey: true,
    supportsOffline: false,
    category: 'cloud',
    apiKeyLabel: 'Anthropic API Key',
  },
  {
    id: 'deepl',
    displayName: 'DeepL',
    requiresApiKey: true,
    supportsOffline: false,
    category: 'cloud',
    apiKeyLabel: 'DeepL API Key',
  },
  {
    id: 'google-translate',
    displayName: 'Google Translate',
    requiresApiKey: true,
    supportsOffline: false,
    category: 'cloud',
    apiKeyLabel: 'Google Cloud API Key',
  },
];

export const OCR_PROVIDER_REGISTRY_EXT = [
  { id: 'azure-vision', displayName: 'Azure Computer Vision', requiresApiKey: true, supportsOffline: false },
];

export function createTranslationProvider(
  id: string,
  apiKeys: Record<string, string>,
  localEndpoint: string,
): TranslationProvider {
  switch (id) {
    case 'ollama':
      return new OllamaTranslationProvider(localEndpoint);
    case 'lm-studio':
      return new LMStudioTranslationProvider(localEndpoint.replace('11434', '1234'));
    case 'libretranslate':
      return new LibreTranslateProvider(localEndpoint, apiKeys['libretranslate']);
    case 'openai':
      return new OpenAITranslationProvider(apiKeys['openai'] ?? '');
    case 'claude':
      return new ClaudeTranslationProvider(apiKeys['claude'] ?? '');
    case 'deepl':
      return new DeepLTranslationProvider(apiKeys['deepl'] ?? '');
    case 'google-translate':
      return new GoogleTranslateProvider(apiKeys['google-translate'] ?? '');
    default:
      console.warn(`Unknown translation provider "${id}", falling back to LibreTranslate`);
      return new LibreTranslateProvider(localEndpoint);
  }
}
