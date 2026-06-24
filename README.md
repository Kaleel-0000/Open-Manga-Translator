# Manga Translate — Browser Extension

This is a vibe-coded project. A production-ready cross-browser extension that translates manga, manhwa, manhua, webtoons, and comics **directly on any website** — preserving artwork and speech bubbles.

---

## Features

- 🔍 **Auto-detects** comic images on any page (MutationObserver + IntersectionObserver)
- 📝 **OCR** — Tesseract.js (offline), Google Cloud Vision, Azure Computer Vision
- 🌐 **Translation** — Ollama, LM Studio, LibreTranslate (all offline/local), OpenAI, Claude, DeepL, Google Translate
- 🎨 **Inpainting** — removes original text while preserving artwork
- 🖊️ **Bubble-aware rendering** — auto-sized, wrapped, stroke-outlined translated text
- 🔄 **Toggle** between original and translated view
- ♾️ **No limits** — unlimited translations when using local providers
- 📵 **Full offline mode** with Tesseract.js + Ollama/LM Studio/LibreTranslate
- 🧩 **Modular architecture** — swap any provider with one line of config
- 🦊 **Chrome, Edge, Brave, Opera, Firefox** (single codebase)

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Build

```bash
# Chrome / Edge / Brave / Opera
npm run build

# Firefox
npm run build:firefox

# Development (watch mode)
npm run dev
```

### 3. Load in browser

**Chrome / Edge / Brave:**
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/chrome` folder

**Firefox:**
1. Open `about:debugging`
2. Click **This Firefox → Load Temporary Add-on**
3. Select `dist/firefox/manifest.json`

---

## Provider Setup

### Offline / Local Providers (Recommended — No API Key)

#### Ollama
```bash
# Install Ollama: https://ollama.com
ollama pull qwen2.5:7b   # best multilingual model
ollama serve              # starts on http://localhost:11434
```
Set **Translation Provider → Ollama** in extension settings.

#### LM Studio
1. Download [LM Studio](https://lmstudio.ai)
2. Load any multilingual model (e.g. Qwen2.5, Mistral)
3. Start the local server (default: `http://localhost:1234`)

#### LibreTranslate (Self-hosted)
```bash
pip install libretranslate
libretranslate --host 0.0.0.0 --port 5000
```
Set **Local Server Endpoint → http://localhost:5000**

---

### Cloud Providers (Require API Key)

| Provider | Get Key | Notes |
|---|---|---|
| OpenAI | [platform.openai.com](https://platform.openai.com) | Uses GPT-4o-mini |
| Claude | [console.anthropic.com](https://console.anthropic.com) | Uses claude-haiku |
| DeepL | [deepl.com/pro-api](https://www.deepl.com/pro-api) | Free tier available |
| Google Translate | [console.cloud.google.com](https://console.cloud.google.com) | Enable Cloud Translation API |
| Google Vision | [console.cloud.google.com](https://console.cloud.google.com) | Enable Cloud Vision API |
| Azure Vision | [portal.azure.com](https://portal.azure.com) | Create Computer Vision resource |

Add API keys in the extension's **Full Settings** page.

---

## Architecture

```
src/
├── background/         # Service worker: CORS proxy, context menu, message routing
├── content/            # Page script: detection, observers, pipeline coordinator
├── popup/              # React popup UI
├── options/            # React full-settings page
├── services/
│   ├── detector/       # HeuristicImageDetector
│   ├── ocr/            # Tesseract, Google Vision, Azure Vision
│   ├── translator/     # Ollama, LM Studio, LibreTranslate, OpenAI, Claude, DeepL, Google
│   ├── renderer/       # BubbleTextRenderer (auto-size, wrap, vertical text)
│   ├── image/          # WorkerImageInpainter
│   ├── overlay/        # CanvasOverlayRenderer (non-destructive)
│   ├── cache/          # IDBCacheProvider (IndexedDB)
│   ├── pipeline/       # TranslationPipeline (orchestrator)
│   └── settings/       # SettingsService (chrome.storage)
├── workers/
│   ├── ocr-worker.ts   # Tesseract.js Web Worker
│   └── inpaint-worker.ts # Inpainting Web Worker (OffscreenCanvas)
├── interfaces/         # All TypeScript interfaces (OCRProvider, TranslationProvider…)
├── utils/
│   ├── AsyncQueue.ts   # Concurrency-limited queue with retry + priority
│   ├── errors.ts       # Structured error types
│   ├── hash.ts         # SHA-256 cache key generation
│   └── languageDetection.ts # Unicode-based language detection
└── assets/icons/       # Extension icons
```

### Pipeline Flow

```
Detect Comic Images (MutationObserver + IntersectionObserver)
        ↓
Fetch Image via Background Proxy (CORS bypass)
        ↓
OCR — Extract Text Regions + Bounding Polygons
        ↓
Language Detection (auto or manual)
        ↓
Translation (batched, cached)
        ↓
Inpainting — Remove Original Text (Web Worker, OffscreenCanvas)
        ↓
Canvas Overlay — Render Translated Text (bubble-aware layout)
        ↓
Non-destructive overlay attached; toggle to switch views
```

---

## Adding a New Provider

### New Translation Provider
1. Create `src/services/translator/MyProvider.ts` implementing `TranslationProvider`
2. Add entry to `TRANSLATION_PROVIDER_REGISTRY` in `TranslationProviderRegistry.ts`
3. Add `case 'my-provider':` to `createTranslationProvider()`

### New OCR Provider
1. Create `src/services/ocr/MyOCRProvider.ts` implementing `OCRProvider`
2. Add entry to `OCR_PROVIDER_REGISTRY` in `OCRProviderRegistry.ts`
3. Add `case 'my-ocr':` to `createOCRProvider()`

That's it — no other files need changing.

---

## Performance

- Only **visible images** are translated first; off-screen images are queued
- **200px pre-fetch margin** via IntersectionObserver for smooth scroll experience
- OCR results, translations, and inpainted images are **cached in IndexedDB**
- Cache TTL is configurable (default 72 hours)
- All heavy work (OCR, inpainting) runs in **Web Workers** off the main thread
- AsyncQueue limits concurrency to avoid overwhelming APIs or memory

---

## Testing

```bash
npm test               # run all tests
npm run type-check     # TypeScript type checking
npm run lint           # ESLint
```

---

## License

MIT — free for personal and commercial use.
