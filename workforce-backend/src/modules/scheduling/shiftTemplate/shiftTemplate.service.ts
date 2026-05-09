import ShiftTemplate from "../../../models/shiftTemplate.model";

export const createTemplate = async (data: any) => {
  return await ShiftTemplate.create(data);
};

export const getTemplates = async () => {
  return await ShiftTemplate.find();
};

export const getTemplateById = async (id: string) => {
  return await ShiftTemplate.findById(id);
};

export const updateTemplate = async (id: string, data: any) => {
  return await ShiftTemplate.findByIdAndUpdate(id, data, { new: true });
};

export const deleteTemplate = async (id: string) => {
  return await ShiftTemplate.findByIdAndDelete(id);
};
