import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const atolls = await prisma.atoll.findMany({
    include: { _count: { select: { islands: true } } },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ atolls });
}
