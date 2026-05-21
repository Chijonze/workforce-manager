import { Request, Response } from "express";
import {
  getChatRecipients,
  getOrCreateConversation,
  listConversations,
  listMessages,
  sendMessage,
} from "./chat.service";

export const recipients = async (req: Request, res: Response) => {
  try {
    const data = await getChatRecipients((req as any).user);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const conversations = async (req: Request, res: Response) => {
  try {
    const data = await listConversations((req as any).user);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const openConversation = async (req: Request, res: Response) => {
  try {
    const data = await getOrCreateConversation((req as any).user, req.body.recipientId);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const messages = async (req: Request, res: Response) => {
  try {
    const data = await listMessages((req as any).user, String(req.params.conversationId));
    res.status(200).json(data);
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
};

export const createMessage = async (req: Request, res: Response) => {
  try {
    const data = await sendMessage((req as any).user, req.body.recipientId, req.body.body);
    res.status(201).json(data);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
