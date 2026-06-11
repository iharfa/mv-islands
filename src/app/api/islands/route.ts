import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const atoll = sp.get("atoll");
  const status = sp.get("status");
  const q = sp.get("q");
  const hasConflicts = sp.get("conflicts");
  const minCompleteness = sp.get("min_completeness");
  const take = Math.min(Number(sp.get("limit") ?? 100), 2000);
  const skip = Number(sp.get("offset") ?? 0);

  const islands = await prisma.island.findMany({
    where: {
      ...(atoll ? { atoll: { code: { equals: atoll } } } : {}),
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { dhivehiName: { contains: q } }, { slug: { contains: q } }] } : {}),
      ...(hasConflicts === "true" ? { unresolvedConflicts: { gt: 0 } } : {}),
      ...(minCompleteness ? { overallScore: { gte: Number(minCompleteness) } } : {}),
    },
    include: { atoll: { select: { code: true, name: true } } },
    orderBy: { name: "asc" },
    take,
    skip,
  });
  const total = await prisma.island.count();
  return NextResponse.json({ total, count: islands.length, islands });
}
