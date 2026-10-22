import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createMuapiWebhookToken() {
  return randomBytes(32).toString("hex");
}

export function hashMuapiWebhookToken(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return null;
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifyMuapiWebhookToken(token, storedHash) {
  const tokenHash = hashMuapiWebhookToken(token);
  if (!tokenHash || typeof storedHash !== "string" || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;

  const supplied = Buffer.from(tokenHash, "hex");
  const stored = Buffer.from(storedHash, "hex");
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
}

export function buildMuapiWebhookUrl(baseUrl, token) {
  const webhookUrl = new URL("/api/webhook/muapi", baseUrl);
  webhookUrl.searchParams.set("token", token);
  return webhookUrl.toString();
}
