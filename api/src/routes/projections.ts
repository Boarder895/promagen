import { type Express } from 'express';
import { prisma } from '../db'; // <-- named import (singleton)

// Explicitly type "t" in the filters to satisfy TS7006
export const registerProjectionRoutes = (app: Express) => {
  app.get('/api/v1/projections/incidents', async (_req, res) => {
    const incidents = await prisma.incident.findMany({
      where: { status: 'open' },
    });
    const tasks = await prisma.task.findMany();

    const done = tasks.filter((t: any) => t.status === 'done').length;
    const doing = tasks.filter((t: any) => t.status === 'doing').length;
    const blocked = tasks.filter((t: any) => t.status === 'blocked').length;
    const total = tasks.length || 1;

    let tone: 'red' | 'yellow' | 'green' = 'green';
    const reasons: string[] = [];

    if (incidents.length > 0) {
      tone = 'red';
      reasons.push(`${incidents.length} incidents open`);
    }
    if (blocked > 0) reasons.push(`${blocked} tasks blocked`);
    if (doing / total > 0.5) reasons.push(`High WIP: ${Math.round((doing / total) * 100)}% doing`);
    if (done / total < 0.5) reasons.push(`Low completion: ${Math.round((done / total) * 100)}% done`);

    res.json({ tone, stats: { total, done, doing, blocked, incidents: incidents.length }, reasons });
  });

  app.get('/api/v1/projections/users-book', async (_req, res) => {
    const notes = await prisma.note.findMany({
      where: { visible: true, approved: true },
      orderBy: { updatedAt: 'desc' },
    });
    const lastDeploy = await prisma.event.findFirst({
      where: { type: 'deploy', source: 'fly' },
      orderBy: { occurredAt: 'desc' },
    });
    res.json({ notes, lastDeploy });
  });
};

