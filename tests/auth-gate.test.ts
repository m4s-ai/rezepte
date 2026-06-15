import { describe, expect, it } from "vitest";
import {
  ACCESS_COOKIE_NAME,
  COOKIE_MAX_AGE_SECONDS,
  FAILURE_STORAGE_KEY,
  MAX_LOCKOUT_MS,
  NEXT_ALLOWED_AT_STORAGE_KEY,
  buildAccessCookie,
  buildClearAccessCookie,
  calculateLockoutDelayMs,
  clearAccessCookie,
  clearFailureState,
  hasValidAccessCookie,
  isValidAccessHash,
  normalizeAccessHash,
  readCookie,
  readFailureState,
  recordFailedAttempt,
  sha256Hex,
  writeAccessCookie
} from "../src/lib/auth-gate";

class FakeStorage {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("auth-gate helpers", () => {
  it("normalizes and validates lowercase SHA-256 hex digests", () => {
    const uppercaseDigest = "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";

    expect(normalizeAccessHash(` ${uppercaseDigest}\n`)).toBe(uppercaseDigest.toLowerCase());
    expect(isValidAccessHash(uppercaseDigest)).toBe(true);
    expect(isValidAccessHash("abc123")).toBe(false);
    expect(isValidAccessHash(undefined)).toBe(false);
  });

  it("hashes passwords with SHA-256 hex output", async () => {
    await expect(sha256Hex("test")).resolves.toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    );
  });

  it("builds, reads, writes, validates, and clears the access cookie", () => {
    const digest = "a".repeat(64);
    const target = { cookie: "" };

    expect(buildAccessCookie(digest, "/rezepte")).toBe(
      `${ACCESS_COOKIE_NAME}=${digest}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/rezepte/; SameSite=Lax; Secure`
    );
    expect(buildClearAccessCookie("/rezepte")).toBe(
      `${ACCESS_COOKIE_NAME}=; Max-Age=0; Path=/rezepte/; SameSite=Lax; Secure`
    );

    writeAccessCookie(target, digest, "/rezepte");
    expect(target.cookie).toBe(buildAccessCookie(digest, "/rezepte"));
    expect(readCookie(`theme=dark; ${ACCESS_COOKIE_NAME}=${digest}; other=1`)).toBe(digest);
    expect(hasValidAccessCookie(`${ACCESS_COOKIE_NAME}=${digest}`, digest.toUpperCase())).toBe(true);

    clearAccessCookie(target, "/rezepte");
    expect(target.cookie).toBe(buildClearAccessCookie("/rezepte"));
  });

  it("uses five immediate failures before exponential local lockout", () => {
    expect(calculateLockoutDelayMs(0)).toBe(0);
    expect(calculateLockoutDelayMs(5)).toBe(0);
    expect(calculateLockoutDelayMs(6)).toBe(60_000);
    expect(calculateLockoutDelayMs(7)).toBe(120_000);
    expect(calculateLockoutDelayMs(10)).toBe(MAX_LOCKOUT_MS);
    expect(calculateLockoutDelayMs(99)).toBe(MAX_LOCKOUT_MS);
  });

  it("tracks failures and next allowed time in localStorage-compatible storage", () => {
    const storage = new FakeStorage();
    const now = 1_800_000;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(recordFailedAttempt(storage, now)).toEqual({
        failures: attempt,
        delayMs: 0,
        nextAllowedAt: 0
      });
    }

    expect(storage.getItem(FAILURE_STORAGE_KEY)).toBe("5");
    expect(storage.getItem(NEXT_ALLOWED_AT_STORAGE_KEY)).toBeNull();

    expect(recordFailedAttempt(storage, now)).toEqual({
      failures: 6,
      delayMs: 60_000,
      nextAllowedAt: now + 60_000
    });

    expect(readFailureState(storage, now)).toEqual({
      failures: 6,
      nextAllowedAt: now + 60_000,
      remainingMs: 60_000,
      locked: true
    });
    expect(readFailureState(storage, now + 60_000)).toEqual({
      failures: 6,
      nextAllowedAt: now + 60_000,
      remainingMs: 0,
      locked: false
    });

    clearFailureState(storage);
    expect(storage.getItem(FAILURE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(NEXT_ALLOWED_AT_STORAGE_KEY)).toBeNull();
  });
});
