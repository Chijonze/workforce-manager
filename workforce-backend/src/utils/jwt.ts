import jwt from "jsonwebtoken";

export const generateToken = (userId: string, mfaVerified = true) => {
  return jwt.sign(
    { userId, mfaVerified },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );
};

export const generateMfaToken = (userId: string) => {
  return jwt.sign(
    { userId, purpose: "mfa_pending" },
    process.env.JWT_SECRET as string,
    { expiresIn: "5m" }
  );
};

export const verifyMfaToken = (token: string) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
    userId?: string;
    purpose?: string;
  };

  if (!decoded.userId || decoded.purpose !== "mfa_pending") {
    throw new Error("Invalid MFA session");
  }

  return decoded.userId;
};
