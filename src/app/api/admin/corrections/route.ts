import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.entityId || !body?.fieldName || !body?.newValue || !body?.reason) {
    return NextResponse.json({ error: "entityId, fieldName, newValue and reason are required" }, { status: 400 });
  }
  const correction = await prisma.adminCorrection.create({
    data: {
      entityType: body.entityType ?? "island",
      entityId: body.entityId,
      fieldName: body.fieldName,
      oldValue: body.oldValue ?? null,
      newValue: body.newValue,
      reason: body.reason,
      submittedBy: "admin",
    },
  });
  await prisma.auditLog.create({
    data: { actor: "admin", action: "correction:submit", entityType: body.entityType ?? "island", entityId: body.entityId, detail: `${body.fieldName} → ${body.newValue} (${body.reason})` },
  });
  return NextResponse.json({ correction });
}
