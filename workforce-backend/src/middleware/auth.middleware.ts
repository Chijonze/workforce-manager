import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId?: string;
      mfaVerified?: boolean;
    };

    if (!decoded.userId) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await User.findById(decoded.userId).select("_id name email role accountStatus");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    (req as any).user = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus || "approved",
      mfaVerified: decoded.mfaVerified !== false,
    };

    const mfaRequired = process.env.MFA_REQUIRED !== "false";
    const authMfaPath =
      req.baseUrl === "/api/auth" &&
      ["/me", "/mfa/setup", "/mfa/confirm"].includes(req.path);

    const mfaExempt = user.role === "supervisor";

    if (mfaRequired && !mfaExempt && decoded.mfaVerified === false && !authMfaPath) {
      return res.status(403).json({
        message: "MFA setup is required before accessing the dashboard",
        mfaSetupRequired: true,
      });
    }

    const accountStatus = user.accountStatus || "approved";
    const approvalStatusPath = req.baseUrl === "/api/auth" && req.path === "/me";

    if (accountStatus !== "approved" && !approvalStatusPath) {
      return res.status(403).json({
        message: "Your hiring manager account is awaiting admin approval",
        accountApprovalRequired: true,
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if ((req as any).user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

export const requireAdminOrSupervisor = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const role = (req as any).user?.role;

  if (role !== "admin" && role !== "supervisor") {
    return res.status(403).json({ message: "Admin or supervisor access required" });
  }

  next();
};

export const requireNonSupervisor = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if ((req as any).user?.role === "supervisor") {
    return res.status(403).json({ message: "Supervisor access is limited to monitoring and performance" });
  }

  next();
};
