import { Request, Response } from "express";
import * as service from "./shiftTemplate.service";

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const template = await service.createTemplate(req.body);
    res.status(201).json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const getTemplates = async (_: Request, res: Response) => {
  const templates = await service.getTemplates();
  res.json(templates);
};

export const getTemplateById = async (req: Request, res: Response) => {
  const template = await service.getTemplateById(String(req.params.id));
  res.json(template);
};

export const updateTemplate = async (req: Request, res: Response) => {
  const updated = await service.updateTemplate(String(req.params.id), req.body);
  res.json(updated);
};

export const deleteTemplate = async (req: Request, res: Response) => {
  await service.deleteTemplate(String(req.params.id));
  res.json({ message: "Deleted" });
};
