import type { User } from "@/domain/repositories/user-repository";
import { AuthError } from "@/application/services/auth-service";
import { createAuthService } from "@/infrastructure/auth/auth-service-factory";
import { SESSION_COOKIE_NAME } from "@/infrastructure/auth/session-cookie";

export function getSessionTokenFromCookieHeader(cookieHeader: string | null): string | null {
  const rawCookieHeader = cookieHeader ?? "";
  const cookieParts = rawCookieHeader.split(";").map((part) => part.trim());
  const sessionCookie = cookieParts.find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));

  return sessionCookie ? sessionCookie.split("=")[1] : null;
}

export async function getAuthenticatedUserFromRequest(request: Request): Promise<User | null> {
  const sessionToken = getSessionTokenFromCookieHeader(request.headers.get("cookie"));

  if (!sessionToken) {
    return null;
  }

  try {
    const authService = createAuthService();
    return await authService.me(sessionToken);
  } catch (error) {
    if (error instanceof AuthError && error.code === "UNAUTHORIZED") {
      return null;
    }

    throw error;
  }
}
