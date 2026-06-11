import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Global search: island names (official/Dhivehi/alternative), atolls, types, statuses. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const [byName, names, atolls] = await Promise.all([
    prisma.island.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { dhivehiName: { contains: q } },
          { status: { equals: q.toLowerCase() } },
          { islandType: { contains: q } },
          { useCategory: { contains: q } },
        ],
      },
      include: { atoll: { select: { code: true, name: true } } },
      take: 20,
    }),
    prisma.islandName.findMany({
      where: { name: { contains: q } },
      include: { island: { include: { atoll: { select: { code: true, name: true } } } } },
      take: 10,
    }),
    prisma.atoll.findMany({
      where: { OR: [{ name: { contains: q } }, { code: { equals: q } }, { naturalAtoll: { contains: q } }] },
      take: 5,
    }),
  ]);

  const islandMap = new Map(byName.map((i) => [i.id, i]));
  for (const n of names) if (!islandMap.has(n.islandId)) islandMap.set(n.islandId, n.island);

  return NextResponse.json({
    results: [
      ...atolls.map((a) => ({ type: "atoll", id: a.code, label: `${a.name} (${a.code})`, href: `/atolls/${a.code}` })),
      ...[...islandMap.values()].slice(0, 20).map((i) => ({
        type: "island",
        id: i.slug,
        label: `${i.name}${i.atoll ? ` — ${i.atoll.name}` : ""}`,
        status: i.status,
        conflicts: i.unresolvedConflicts,
        href: `/islands/${i.slug}`,
      })),
    ],
  });
}
