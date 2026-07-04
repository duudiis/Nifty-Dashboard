import crypto from "crypto";

// Encrypts OAuth tokens before they touch the (internet-exposed) database.
// AES-256-GCM with a random IV per value; the key is CONNECTIONS_KEY (any
// string — hashed to 32 bytes). Output is "iv:tag:ciphertext", all base64.
//
// If CONNECTIONS_KEY is unset we fall back to a derived key so the app still
// runs, but connections should not be used without a real key set.

const keyMaterial = process.env.CONNECTIONS_KEY || "nifty-insecure-dev-key-set-CONNECTIONS_KEY";
const KEY = crypto.createHash("sha256").update(keyMaterial).digest();

export function encrypt(plaintext) {
    if (plaintext == null) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
    const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(payload) {
    if (!payload) return null;
    try {
        const [ivB64, tagB64, dataB64] = String(payload).split(":");
        const iv = Buffer.from(ivB64, "base64");
        const tag = Buffer.from(tagB64, "base64");
        const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
    } catch {
        return null;
    }
}

// Opaque, URL-safe random token for OAuth `state`.
export function randomState() {
    return crypto.randomBytes(24).toString("base64url");
}
