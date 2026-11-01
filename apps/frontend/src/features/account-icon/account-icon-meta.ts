/**
 * An account's own icon (for example its broker's logo), stored in the account's
 * `meta` JSON as a PNG data URL under `icon`. Accounts without one show nothing,
 * so their rows look as before.
 */
export const ACCOUNT_ICON_META_KEY = "icon";

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
/** A 150 KB PNG, the asset logo limit, base64-encoded with its prefix. */
const MAX_DATA_URL_LENGTH = 205_000;

export function readAccountIcon(meta?: string | null): string | null {
  if (!meta?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(meta);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const icon = (parsed as Record<string, unknown>)[ACCOUNT_ICON_META_KEY];
    return typeof icon === "string" && icon.length <= MAX_DATA_URL_LENGTH && PNG_DATA_URL.test(icon)
      ? icon
      : null;
  } catch {
    return null;
  }
}
