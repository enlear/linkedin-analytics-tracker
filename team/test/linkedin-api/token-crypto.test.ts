import { createCipheriv, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptToken, encryptToken } from "@/lib/linkedin-api/token-crypto";

const key = randomBytes(32);

beforeEach(() => {
  vi.stubEnv("LINKEDIN_TOKEN_ENC_KEY", key.toString("base64"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Flip one bit of the decoded ciphertext at `index` and re-encode it. */
function tamper(ciphertext: string, index: number): string {
  const buf = Buffer.from(ciphertext, "base64");
  buf[index] ^= 0x01;
  return buf.toString("base64");
}

describe("token encryption", () => {
  it("round-trips a token", () => {
    const token = "AQX-some.linkedin_token~with/odd+chars=";
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("uses a fresh IV, so the same token never encrypts the same way twice", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("decrypts the documented iv || tag || ciphertext layout", () => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update("external-token", "utf8"), cipher.final()]);
    const stored = Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
    expect(decryptToken(stored)).toBe("external-token");
  });

  it.each([
    ["the IV", 0],
    ["the auth tag", 12],
    ["the ciphertext", 28],
  ])("rejects a ciphertext with a tampered %s", (_part, index) => {
    const stored = encryptToken("secret-token");
    expect(() => decryptToken(tamper(stored, index))).toThrow();
  });

  it("rejects a ciphertext made with a different key", () => {
    const stored = encryptToken("secret-token");
    vi.stubEnv("LINKEDIN_TOKEN_ENC_KEY", randomBytes(32).toString("base64"));
    expect(() => decryptToken(stored)).toThrow();
  });

  it("refuses to run without a key", () => {
    vi.stubEnv("LINKEDIN_TOKEN_ENC_KEY", "");
    expect(() => encryptToken("x")).toThrow(/LINKEDIN_TOKEN_ENC_KEY is not set/);
  });

  it("refuses a key that isn't 32 bytes", () => {
    vi.stubEnv("LINKEDIN_TOKEN_ENC_KEY", randomBytes(16).toString("base64"));
    expect(() => encryptToken("x")).toThrow(/must decode to 32 bytes \(got 16\)/);
  });
});
