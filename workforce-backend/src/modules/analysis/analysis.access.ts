import User from "../../models/User";

export type Requester = { userId: string; role: string };

/**
 * Admins see everyone; supervisors only the agents allocated to them. Shared by
 * the analysis and screenshot-narration modules so the two cannot drift apart.
 */
export const assertCanViewWorker = async (requester: Requester, targetUserId: string) => {
  if (requester.role === "admin") return;

  const supervisor = await User.findById(requester.userId).select("assignedAgentIds");
  const assigned = (supervisor?.assignedAgentIds || []).map((id: any) => String(id));

  if (!assigned.includes(String(targetUserId))) {
    throw new Error("You are not allowed to view this agent's analysis");
  }
};

export const assignedAgentIdsFor = async (requester: Requester) => {
  if (requester.role !== "supervisor") return null;
  const supervisor = await User.findById(requester.userId).select("assignedAgentIds");
  return (supervisor?.assignedAgentIds || []).map((id: any) => String(id));
};
