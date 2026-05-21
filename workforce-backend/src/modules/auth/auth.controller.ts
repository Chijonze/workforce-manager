import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  getUsers,
  startMfaSetup,
  confirmMfaSetup,
  verifyLoginMfa,
  verifyReturnMfa,
  deleteUserAccount,
} from "./auth.service";
import { notifyTelegramLogin } from "../../utils/telegramNotifier";

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
    const { email, password, mfaCode } = req.body;

    const data = await loginUser(email, password, mfaCode);

    if (data.token && !data.mfaRequired && !data.mfaSetupRequired) {
      void notifyTelegramLogin(data.user, req);
    }

    res.status(200).json(data);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const setupMfa = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const data = await startMfaSetup(userId);

    res.status(200).json(data);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const confirmMfa = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await confirmMfaSetup(userId, req.body.code);

    if (user.token) {
      void notifyTelegramLogin(user.user, req);
    }

    res.status(200).json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const verifyMfa = async (req: Request, res: Response) => {
  try {
    const data = await verifyLoginMfa(req.body.mfaToken, req.body.code);

    if (data.token) {
      void notifyTelegramLogin(data.user, req);
    }

    res.status(200).json(data);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const verifyReturn = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const data = await verifyReturnMfa(userId, req.body.code);

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

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user.userId;
    const result = await deleteUserAccount(currentUserId, String(req.params.userId));

    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
