import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const keyLength = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, keyLength).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string | null) {
  if (!passwordHash) {
    return false;
  }

  const [algorithm, salt, storedHash] = passwordHash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const calculatedHash = scryptSync(password, salt, keyLength);
  const storedBuffer = Buffer.from(storedHash, "hex");

  return (
    calculatedHash.length === storedBuffer.length &&
    timingSafeEqual(calculatedHash, storedBuffer)
  );
}
