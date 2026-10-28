// AES-256-GCM encryption for stored LinkedIn OAuth tokens.
//
// Stored ciphertext format: base64( iv[12] || authTag[16] || ciphertext ).
// The key is a base64-encoded 32-byte secret (LINKEDIN_TOKEN_ENC_KEY) held only
// by the server. Row-level security lets a member read their own
// linkedin_connections row, so the tokens must be useless without that key.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env.LINKEDIN_TOKEN_ENC_KEY;
  if (!raw) {
    throw new Error("LINKEDIN_TOKEN_ENC_KEY is not set — cannot encrypt/decrypt LinkedIn tokens.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `LINKEDIN_TOKEN_ENC_KEY must decode to 32 bytes (got ${key.length}). ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Throws if the ciphertext was altered or was made with a different key. */
export function decryptToken(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const enc = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
