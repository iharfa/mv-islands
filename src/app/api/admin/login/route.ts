import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: "" }));
  if (!token || token !== (process.env.ADMIN_TOKEN ?? "change-me")) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("admin_token");
  return res;
}
