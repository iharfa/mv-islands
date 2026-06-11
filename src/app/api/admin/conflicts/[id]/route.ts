import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

const STATUSES = ["unresolved", "under_review", "resolved", "source_outdated", "needs_external_confirmation"];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status", allowed: STATUSES }, { status: 400 });
  }
  const conflict = await prisma.dataConflict.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.reviewerNote !== undefined ? { reviewerNote: body.reviewerNote } : {}),
      reviewedBy: "admin",
      reviewedAt: new Date(),
    },
  });
  // Keep the island's denormalized unresolved count in sync
  if (conflict.islandId) {
    const unresolved = await prisma.dataConflict.count({ where: { islandId: conflict.islandId, status: "unresolved" } });
    await prisma.island.update({ where: { id: conflict.islandId }, data: { unresolvedConflicts: unresolved } });
  }
  await prisma.auditLog.create({
    data: {
      actor: "admin", action: "conflict:update", entityType: "conflict", entityId: id,
      detail: JSON.stringify({ status: body.status, reviewerNote: body.reviewerNote }),
    },
  });
  return NextResponse.json({ conflict });
}
