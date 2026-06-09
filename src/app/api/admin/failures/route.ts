import { NextResponse } from "next/server";
import { AuthorizationError, requireOperator } from "@/application/services/authorization-service";
import { getAuthenticatedUserFromRequest } from "@/infrastructure/auth/request-auth";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { SqliteFailureRecordRepository } from "@/infrastructure/repositories/sqlite-failure-record-repository";

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    ensurePersistenceReady();
    const user = await getAuthenticatedUserFromRequest(request);
    requireOperator(user);

    const failures = new SqliteFailureRecordRepository();
    const items = await failures.listRecent(200, hoursAgoIso(24));

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        deliveryId: item.deliveryId,
        providerName: item.providerName,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof AuthorizationError && error.code === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    if (error instanceof AuthorizationError && error.code === "FORBIDDEN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Forbidden" } },
        { status: 403 },
      );
    }

    throw error;
  }
}
