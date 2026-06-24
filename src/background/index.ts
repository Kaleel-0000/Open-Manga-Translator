import browser from 'webextension-polyfill';
import { ExtensionMessage, FetchImagePayload, FetchImageResponse } from '@/interfaces';
import { settingsService } from '@/services/settings/SettingsService';

// ----------------------------------------------------------------
// Context menu setup
// ----------------------------------------------------------------

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'translate-image',
    title: 'Translate This Image',
    contexts: ['image'],
  });

  browser.contextMenus.create({
    id: 'translate-page',
    title: 'Translate All Comic Images',
    contexts: ['page'],
  });
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === 'translate-image' && info.srcUrl) {
    await browser.tabs.sendMessage(tab.id, {
      type: 'TRANSLATE_IMAGE',
      payload: { url: info.srcUrl },
    } as ExtensionMessage).catch(() => {});
  }

  if (info.menuItemId === 'translate-page') {
    await browser.tabs.sendMessage(tab.id, {
      type: 'TRANSLATE_PAGE',
      payload: {},
    } as ExtensionMessage).catch(() => {});
  }
});

// ----------------------------------------------------------------
// Message router
// ----------------------------------------------------------------

browser.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse): true | undefined => {
    const msg = message as ExtensionMessage;
    // webextension-polyfill types sendResponse as () => void but it actually
    // accepts a value — use a typed wrapper to satisfy the compiler.
    const reply = sendResponse as (value: unknown) => void;

    switch (msg.type) {
      case 'FETCH_IMAGE':
        handleFetchImage(msg.payload as FetchImagePayload)
          .then(reply)
          .catch((err: Error) => reply({ error: err.message }));
        return true;

      case 'GET_SETTINGS':
        settingsService.load().then(reply).catch(console.error);
        return true;

      case 'SAVE_SETTINGS':
        settingsService.save(msg.payload as Record<string, unknown>)
          .then(() => reply({ ok: true }))
          .catch((err: Error) => reply({ error: err.message }));
        return true;

      case 'CLEAR_CACHE':
        browser.tabs.query({}).then((tabs) => {
          for (const tab of tabs) {
            if (tab.id) {
              browser.tabs.sendMessage(tab.id, {
                type: 'CLEAR_CACHE',
                payload: {},
              } as ExtensionMessage).catch(() => {});
            }
          }
        });
        reply({ ok: true });
        return undefined;

      default:
        return undefined;
    }
  },
);

// ----------------------------------------------------------------
// CORS-bypass image proxy
// ----------------------------------------------------------------

async function handleFetchImage(
  payload: FetchImagePayload,
): Promise<FetchImageResponse> {
  const response = await fetch(payload.url, {
    credentials: 'omit',
    headers: { 'User-Agent': navigator.userAgent },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';
  const arrayBuffer = await blob.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]!);
  }
  const base64 = btoa(binary);
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return { dataUrl, mimeType };
}

console.log('[MangaTranslate] Background service worker started');
