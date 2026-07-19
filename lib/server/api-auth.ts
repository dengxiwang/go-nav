import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

export async function requireAdminAuth(): Promise<boolean> {
	const store = await cookies();
	return !!await verifySession(store.get(SESSION_COOKIE)?.value);
}
