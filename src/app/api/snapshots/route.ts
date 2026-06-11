import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const snapshots = await prisma.snapshot.findMany({
    include: { files: true },
    orderBy: { snapshotDate: "desc" },
  });
  return NextResponse.json({ snapshots });
}
