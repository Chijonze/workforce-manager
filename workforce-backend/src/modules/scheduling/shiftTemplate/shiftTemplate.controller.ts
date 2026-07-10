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
  try {
    const includeInactive = String(_.query.includeInactive || "") === "true";
    const templates = await service.getTemplates(includeInactive);
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

export const getTemplateById = async (req: Request, res: Response) => {
  try {
    const template = await service.getTemplateById(String(req.params.id));
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const updated = await service.updateTemplate(String(req.params.id), req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const deleted = await service.deleteTemplate(String(req.params.id));

    if (!deleted) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json({ message: "Deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};
