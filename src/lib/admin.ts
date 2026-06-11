import { cookies } from "next/headers";

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get("admin_token")?.value;
  return !!token && token === (process.env.ADMIN_TOKEN ?? "change-me");
}
