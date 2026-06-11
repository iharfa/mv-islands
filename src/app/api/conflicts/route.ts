import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const severity = sp.get("severity");
  const field = sp.get("field");
  const take = Math.min(Number(sp.get("limit") ?? 100), 1000);
  const skip = Number(sp.get("offset") ?? 0);

  const where = {
    ...(status ? { status } : {}),
    ...(severity ? { severity } : {}),
    ...(field ? { fieldName: field } : {}),
  };
  const [conflicts, total] = await Promise.all([
    prisma.dataConflict.findMany({
      where,
      include: { island: { select: { slug: true, name: true, atoll: { select: { code: true, name: true } } } } },
      orderBy: { detectedAt: "desc" },
      take,
      skip,
    }),
    prisma.dataConflict.count({ where }),
  ]);
  return NextResponse.json({ total, count: conflicts.length, conflicts });
}
