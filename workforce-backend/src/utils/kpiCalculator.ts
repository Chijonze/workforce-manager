export const calculateAdherence = (
  workedMinutes: number,
  scheduledMinutes: number
) => {
  if (scheduledMinutes === 0) return 0;

  return (workedMinutes / scheduledMinutes) * 100;
};