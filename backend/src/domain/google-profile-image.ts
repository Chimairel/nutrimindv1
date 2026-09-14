/** Legacy photo storage must never serialize an OAuth token or custom avatar as a Google photo. */
export function googleProfileImage(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))
      ? value
      : null;
  } catch {
    return null;
  }
}
