export const getNextAllowedBreakIndex = (
  events: string[]
): number => {
  const breakStarts = events.filter(e => e === "BREAK_START").length;
  const breakEnds = events.filter(e => e === "BREAK_END").length;

  // You can only start next break if previous ended
  if (breakStarts === breakEnds) {
    return breakStarts; // next break slot
  }

  return -1; // invalid state (break in progress)
};