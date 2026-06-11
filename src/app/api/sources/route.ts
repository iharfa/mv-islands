import { NextResponse } from "next/server";
import { sourceRegistryRows } from "@/lib/exports";

export async function GET() {
  return NextResponse.json({ sources: await sourceRegistryRows() });
}
