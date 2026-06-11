import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const atoll = await prisma.atoll.findFirst({
    where: { OR: [{ code: id }, { id }] },
    include: {
      islands: {
        include: { population: { where: { sourceSlug: "census-2022" } } },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!atoll) return NextResponse.json({ error: "Atoll not found" }, { status: 404 });
  return NextResponse.json({ atoll });
}
