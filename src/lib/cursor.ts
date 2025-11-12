const BASE64_URL_REGEX = /-/g;
const BASE64_URL_REPLACEMENT_PLUS = /\+/g;
const BASE64_URL_REPLACEMENT_SLASH = /\//g;

function toBase64Url(input: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "utf8")
      .toString("base64")
      .replace(BASE64_URL_REPLACEMENT_PLUS, "-")
      .replace(BASE64_URL_REPLACEMENT_SLASH, "_")
      .replace(/=+$/, "");
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  let binary = "";

  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  const base64 = btoa(binary);
  return base64.replace(BASE64_URL_REPLACEMENT_PLUS, "-").replace(BASE64_URL_REPLACEMENT_SLASH, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const normalized = encoded.replace(BASE64_URL_REGEX, "+").replace(/_/g, "/");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(normalized, "base64").toString("utf8");
  }

  const base64 = normalized;
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

export function encodeCursor(payload: Record<string, unknown>): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeCursor<T extends Record<string, unknown>>(cursor?: string | null): T | undefined {
  if (!cursor) return undefined;

  try {
    const json = fromBase64Url(cursor);
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}
