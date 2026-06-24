/**
 * Creates a short hex hash of a string using the WebCrypto API.
 * Used for deterministic cache keys.
 */
export async function createHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Return first 16 hex chars (64-bit prefix) — enough to avoid collisions
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
