// Base64 of a text's UTF-8 bytes, and back (null for an invalid input): for
// base64(1), Kubernetes Secrets, SSH signatures and the forge's tokens.

export function base64Encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64Decode(s: string): string | null {
  try {
    const bin = atob(s.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
