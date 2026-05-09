import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  getUsers,
} from "./auth.service";

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    const data = await registerUser(name, email, password);

    res.status(201).json(data);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const data = await loginUser(email, password);

    res.status(200).json(data);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await getCurrentUser(userId);

    res.status(200).json(user);
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
};

export const listUsers = async (_req: Request, res: Response) => {
  try {
    const users = await getUsers();

    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
