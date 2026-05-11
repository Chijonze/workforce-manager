import crypto from "crypto";

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const encryptedPrefix = "enc:v1:";

const getEncryptionKey = () => {
  const secret = process.env.MFA_ENCRYPTION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("MFA_ENCRYPTION_SECRET must be at least 32 characters");
  }

  return crypto.createHash("sha256").update(secret).digest();
};

export const generateTotpSecret = () => {
  const bytes = crypto.randomBytes(20);
  let bits = "";
  let output = "";

  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += base32Alphabet[parseInt(chunk, 2)];
  }

  return output;
};

const decodeBase32 = (secret: string) => {
  const cleanSecret = secret.replace(/=+$/g, "").replace(/\s/g, "").toUpperCase();
  let bits = "";
  const bytes: number[] = [];

  for (const character of cleanSecret) {
    const value = base32Alphabet.indexOf(character);
    if (value === -1) {
      throw new Error("Invalid MFA secret");
    }
    bits += value.toString(2).padStart(5, "0");
  }

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
};

const generateCode = (secret: string, timeStep: number) => {
  const key = decodeBase32(secret);
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(timeStep / 0x100000000), 0);
  counter.writeUInt32BE(timeStep & 0xffffffff, 4);

  const hmac = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 1000000).padStart(6, "0");
};

export const verifyTotpCode = (secret: string, code: string) => {
  const cleanCode = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleanCode)) return false;

  const currentStep = Math.floor(Date.now() / 30000);

  for (const drift of [-1, 0, 1]) {
    if (generateCode(secret, currentStep + drift) === cleanCode) {
      return true;
    }
  }

  return false;
};

export const buildTotpUri = (email: string, secret: string) => {
  const issuer = process.env.MFA_ISSUER || "ShiftSync";
  const label = `${issuer}:${email}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
};

export const encryptTotpSecret = (secret: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${encryptedPrefix}${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
};

export const decryptTotpSecret = (storedSecret: string) => {
  if (!storedSecret.startsWith(encryptedPrefix)) {
    return storedSecret;
  }

  const payload = storedSecret.slice(encryptedPrefix.length);
  const [ivValue, tagValue, encryptedValue] = payload.split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Invalid encrypted MFA secret");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
};
