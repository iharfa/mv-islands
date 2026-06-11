import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const island = await prisma.island.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    include: {
      atoll: true,
      names: true,
      geometries: true,
      population: true,
      images: true,
      conflicts: true,
      matchCandidates: true,
    },
  });
  if (!island) return NextResponse.json({ error: "Island not found" }, { status: 404 });
  const fieldValues = await prisma.fieldValue.findMany({
    where: { entityType: "island", entityId: island.id },
    include: { source: { select: { slug: true, name: true, url: true } } },
    orderBy: [{ fieldName: "asc" }],
  });
  return NextResponse.json({ island, fieldValues });
}
