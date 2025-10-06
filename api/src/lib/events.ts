// BACKEND · Event helpers (named exports only)
import { prisma } from "../db";

export const recordEvent = async (type: string, source: string, payload: unknown, taskId?: string) => {
  return prisma.event.create({
    data: { type, source, payload: JSON.stringify(payload ?? {}), taskId }
  });
};

export const setTaskStatusByShortId = async (
  shortId: number,
  status: "todo" | "doing" | "blocked" | "done"
) => {
  const task = await prisma.task.findUnique({ where: { shortId } });
  if (!task) return null;
  return prisma.task.update({ where: { id: task.id }, data: { status } });
};

export const ensureChecklist = async (
  taskId: string,
  text: string,
  done: boolean,
  source: "manual" | "ci" | "collector" | "webhook",
  evidenceUrl?: string
) => {
  const existing = await prisma.checklistItem.findFirst({ where: { taskId, text } });
  if (existing) {
    return prisma.checklistItem.update({
      where: { id: existing.id },
      data: { done, source, evidenceUrl }
    });
  }
  return prisma.checklistItem.create({ data: { taskId, text, done, source, evidenceUrl } });
};
