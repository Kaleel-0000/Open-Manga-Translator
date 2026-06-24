import { OCRProvider } from '@/interfaces';
import { TesseractOCRProvider } from './TesseractOCRProvider';
import { GoogleVisionOCRProvider } from './GoogleVisionOCRProvider';
import { AzureVisionOCRProvider } from './AzureVisionOCRProvider';

export interface OCRProviderMeta {
  id: string;
  displayName: string;
  requiresApiKey: boolean;
  supportsOffline: boolean;
  apiKeyLabel?: string;
  extraFields?: { key: string; label: string; placeholder: string }[];
}

export const OCR_PROVIDER_REGISTRY: OCRProviderMeta[] = [
  {
    id: 'tesseract',
    displayName: 'Tesseract.js (Offline)',
    requiresApiKey: false,
    supportsOffline: true,
  },
  {
    id: 'google-vision',
    displayName: 'Google Cloud Vision',
    requiresApiKey: true,
    supportsOffline: false,
    apiKeyLabel: 'Google Cloud API Key',
  },
  {
    id: 'azure-vision',
    displayName: 'Azure Computer Vision',
    requiresApiKey: true,
    supportsOffline: false,
    apiKeyLabel: 'Azure API Key',
    extraFields: [
      { key: 'azure-endpoint', label: 'Azure Endpoint', placeholder: 'https://<region>.api.cognitive.microsoft.com' },
    ],
  },
];

export function createOCRProvider(
  id: string,
  apiKeys: Record<string, string>,
): OCRProvider {
  switch (id) {
    case 'tesseract':
      return new TesseractOCRProvider();
    case 'google-vision':
      return new GoogleVisionOCRProvider(apiKeys['google-vision'] ?? '');
    case 'azure-vision':
      return new AzureVisionOCRProvider(
        apiKeys['azure-endpoint'] ?? '',
        apiKeys['azure-vision'] ?? '',
      );
    default:
      console.warn(`Unknown OCR provider "${id}", falling back to Tesseract`);
      return new TesseractOCRProvider();
  }
}
