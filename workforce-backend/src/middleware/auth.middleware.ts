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
    };

    if (!decoded.userId) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await User.findById(decoded.userId).select("_id name email role");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    (req as any).user = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

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
