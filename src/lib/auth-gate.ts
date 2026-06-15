export const ACCESS_COOKIE_NAME = "rezepte_access";
export const FAILURE_STORAGE_KEY = "rezepte_auth_failures";
export const NEXT_ALLOWED_AT_STORAGE_KEY = "rezepte_auth_next_allowed_at";
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const DEFAULT_COOKIE_PATH = "/rezepte/";
export const FREE_FAILURES = 5;
export const MAX_LOCKOUT_MS = 15 * 60 * 1000;

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const LOCKOUT_BASE_MS = 60 * 1000;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CookieTarget {
  cookie: string;
}

export interface FailureState {
  failures: number;
  nextAllowedAt: number;
  remainingMs: number;
  locked: boolean;
}

export interface FailedAttemptResult {
  failures: number;
  delayMs: number;
  nextAllowedAt: number;
}

interface AuthGateInitOptions {
  expectedHash?: string;
  cookiePath?: string;
  cryptoProvider?: Crypto;
  documentRef?: Document;
  historyRef?: History;
  locationRef?: Location;
  storage?: StorageLike;
  now?: () => number;
}

type AuthState = "pending" | "locked" | "unlocked" | "config-error";

export function normalizeAccessHash(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidAccessHash(value: unknown): boolean {
  return SHA256_HEX_PATTERN.test(normalizeAccessHash(value));
}

export async function sha256Hex(value: string, cryptoProvider: Crypto = globalThis.crypto): Promise<string> {
  if (!cryptoProvider?.subtle) {
    throw new Error("Web Crypto API is unavailable.");
  }

  const digest = await cryptoProvider.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizeCookiePath(pathname: string = DEFAULT_COOKIE_PATH): string {
  const trimmed = pathname.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed || ""}`;
  const normalized = withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
  return normalized || "/";
}

export function readCookie(cookieHeader: string, name: string = ACCESS_COOKIE_NAME): string {
  const encodedName = `${encodeURIComponent(name)}=`;

  for (const part of cookieHeader.split(";")) {
    const cookie = part.trim();
    if (!cookie.startsWith(encodedName)) {
      continue;
    }

    const rawValue = cookie.slice(encodedName.length);
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return "";
}

export function buildAccessCookie(value: string, cookiePath: string = DEFAULT_COOKIE_PATH): string {
  return [
    `${ACCESS_COOKIE_NAME}=${encodeURIComponent(value)}`,
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    `Path=${normalizeCookiePath(cookiePath)}`,
    "SameSite=Lax",
    "Secure"
  ].join("; ");
}

export function buildClearAccessCookie(cookiePath: string = DEFAULT_COOKIE_PATH): string {
  return [
    `${ACCESS_COOKIE_NAME}=`,
    "Max-Age=0",
    `Path=${normalizeCookiePath(cookiePath)}`,
    "SameSite=Lax",
    "Secure"
  ].join("; ");
}

export function writeAccessCookie(target: CookieTarget, value: string, cookiePath: string = DEFAULT_COOKIE_PATH): void {
  target.cookie = buildAccessCookie(value, cookiePath);
}

export function clearAccessCookie(target: CookieTarget, cookiePath: string = DEFAULT_COOKIE_PATH): void {
  target.cookie = buildClearAccessCookie(cookiePath);
}

export function hasValidAccessCookie(cookieHeader: string, expectedHash: string): boolean {
  return readCookie(cookieHeader) === normalizeAccessHash(expectedHash);
}

export function calculateLockoutDelayMs(failures: number): number {
  if (!Number.isFinite(failures) || failures <= FREE_FAILURES) {
    return 0;
  }

  const exponent = Math.max(0, Math.trunc(failures) - FREE_FAILURES - 1);
  return Math.min(MAX_LOCKOUT_MS, LOCKOUT_BASE_MS * 2 ** exponent);
}

export function readFailureState(storage: StorageLike, now: number = Date.now()): FailureState {
  const failures = readStoredPositiveInteger(storage, FAILURE_STORAGE_KEY);
  const nextAllowedAt = readStoredPositiveInteger(storage, NEXT_ALLOWED_AT_STORAGE_KEY);
  const remainingMs = Math.max(0, nextAllowedAt - now);

  return {
    failures,
    nextAllowedAt,
    remainingMs,
    locked: remainingMs > 0
  };
}

export function recordFailedAttempt(storage: StorageLike, now: number = Date.now()): FailedAttemptResult {
  const failures = readStoredPositiveInteger(storage, FAILURE_STORAGE_KEY) + 1;
  const delayMs = calculateLockoutDelayMs(failures);
  const nextAllowedAt = delayMs > 0 ? now + delayMs : 0;

  storage.setItem(FAILURE_STORAGE_KEY, String(failures));

  if (nextAllowedAt > 0) {
    storage.setItem(NEXT_ALLOWED_AT_STORAGE_KEY, String(nextAllowedAt));
  } else {
    storage.removeItem(NEXT_ALLOWED_AT_STORAGE_KEY);
  }

  return { failures, delayMs, nextAllowedAt };
}

export function clearFailureState(storage: StorageLike): void {
  storage.removeItem(FAILURE_STORAGE_KEY);
  storage.removeItem(NEXT_ALLOWED_AT_STORAGE_KEY);
}

export function consumeLogoutParam(location: Location, history: History): boolean {
  const url = new URL(location.href);
  if (url.searchParams.get("logout") !== "1") {
    return false;
  }

  url.searchParams.delete("logout");
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
}

export function initializeAuthGate(options: AuthGateInitOptions = {}): void {
  const doc = options.documentRef ?? globalThis.document;
  const win = doc.defaultView ?? globalThis.window;
  const storage = options.storage ?? win.localStorage;
  const history = options.historyRef ?? win.history;
  const location = options.locationRef ?? win.location;
  const cryptoProvider = options.cryptoProvider ?? win.crypto;
  const now = options.now ?? Date.now;
  const cookiePath = normalizeCookiePath(options.cookiePath ?? DEFAULT_COOKIE_PATH);
  const expectedHash = normalizeAccessHash(options.expectedHash);

  const body = doc.body;
  const gate = doc.querySelector<HTMLElement>("[data-auth-gate]");
  const content = doc.querySelector<HTMLElement>("[data-auth-content]");
  const form = doc.querySelector<HTMLFormElement>("[data-auth-form]");
  const passwordInput = doc.querySelector<HTMLInputElement>("[data-auth-password]");
  const submitButton = doc.querySelector<HTMLButtonElement>("[data-auth-submit]");
  const message = doc.querySelector<HTMLElement>("[data-auth-message]");
  let lockoutTimer = 0;

  const setState = (state: AuthState) => {
    body.classList.remove("auth-pending", "auth-locked", "auth-unlocked", "auth-config-error");
    body.classList.add(`auth-${state}`);
    body.dataset.authState = state;

    if (content) {
      if (state === "unlocked") {
        content.removeAttribute("aria-hidden");
      } else {
        content.setAttribute("aria-hidden", "true");
      }
    }

    if (gate) {
      gate.setAttribute("aria-hidden", state === "unlocked" ? "true" : "false");
    }
  };

  const setFormDisabled = (disabled: boolean) => {
    if (passwordInput) {
      passwordInput.disabled = disabled;
    }

    if (submitButton) {
      submitButton.disabled = disabled;
    }
  };

  const setMessage = (text: string, type: "error" | "info" = "error") => {
    if (!message) {
      return;
    }

    message.textContent = text;
    message.dataset.messageType = type;
  };

  const renderLockout = (): boolean => {
    const failureState = readFailureState(storage, now());
    window.clearTimeout(lockoutTimer);

    if (!failureState.locked) {
      setFormDisabled(false);
      return false;
    }

    setFormDisabled(true);
    setMessage(formatLockoutMessage(failureState.remainingMs));
    lockoutTimer = window.setTimeout(renderLockout, Math.min(failureState.remainingMs, 60 * 1000));
    return true;
  };

  setState("pending");

  if (!isValidAccessHash(expectedHash)) {
    setState("config-error");
    setFormDisabled(true);
    setMessage("Zugang ist nicht konfiguriert. PUBLIC_REZEPTE_ACCESS_HASH fehlt oder ist ungültig.");
    return;
  }

  if (consumeLogoutParam(location, history)) {
    clearAccessCookie(doc, cookiePath);
  }

  if (hasValidAccessCookie(doc.cookie, expectedHash)) {
    clearFailureState(storage);
    setState("unlocked");
    return;
  }

  setState("locked");

  if (renderLockout()) {
    return;
  }

  passwordInput?.focus();

  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!passwordInput || renderLockout()) {
      return;
    }

    setFormDisabled(true);
    setMessage("Prüfe Passwort...", "info");

    void sha256Hex(passwordInput.value, cryptoProvider)
      .then((passwordHash) => {
        if (passwordHash === expectedHash) {
          writeAccessCookie(doc, expectedHash, cookiePath);
          clearFailureState(storage);
          passwordInput.value = "";
          setState("unlocked");
          setMessage("");
          return;
        }

        recordFailedAttempt(storage, now());
        passwordInput.select();

        if (renderLockout()) {
          return;
        }

        setFormDisabled(false);
        setMessage("Passwort nicht korrekt.");
        passwordInput.focus();
      })
      .catch(() => {
        setFormDisabled(false);
        setMessage("Zugang konnte in diesem Browser nicht geprüft werden.");
        passwordInput.focus();
      });
  });
}

function readStoredPositiveInteger(storage: StorageLike, key: string): number {
  const raw = storage.getItem(key);
  if (!raw) {
    return 0;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatLockoutMessage(remainingMs: number): string {
  const minutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
  const unit = minutes === 1 ? "Minute" : "Minuten";
  return `Bitte später erneut versuchen. Noch etwa ${minutes} ${unit}.`;
}
