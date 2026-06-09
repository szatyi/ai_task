import {
  AuthorizationError,
  requireActiveUser,
} from "@/application/services/authorization-service";
import type { User } from "@/domain/repositories/user-repository";
import { getAuthenticatedUserFromRequest } from "@/infrastructure/auth/request-auth";

export async function requireCurrentActiveUser(request: Request): Promise<User> {
  const user = await getAuthenticatedUserFromRequest(request);

  try {
    return requireActiveUser(user);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw error;
  }
}
