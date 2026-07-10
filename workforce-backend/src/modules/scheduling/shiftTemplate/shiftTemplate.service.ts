import Schedule from "../../../models/schedule.model";
import ShiftSession from "../../../models/ShiftSession";
import ShiftTemplate from "../../../models/shiftTemplate.model";

export const createTemplate = async (data: any) => {
  return await ShiftTemplate.create(data);
};

export const getTemplates = async (includeInactive = false) => {
  return await ShiftTemplate.find(includeInactive ? {} : { isActive: { $ne: false } });
};

export const getTemplateById = async (id: string) => {
  return await ShiftTemplate.findById(id);
};

export const updateTemplate = async (id: string, data: any) => {
  return await ShiftTemplate.findByIdAndUpdate(id, data, { new: true });
};

export const deleteTemplate = async (id: string) => {
  const assignedSchedule = await Schedule.findOne({ shiftTemplateId: id });
  const linkedSession = await ShiftSession.findOne({ shiftTemplateId: id });

  if (assignedSchedule || linkedSession) {
    return await ShiftTemplate.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
  }

  return await ShiftTemplate.findByIdAndDelete(id);
};
