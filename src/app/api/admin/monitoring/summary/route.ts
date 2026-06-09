import { NextResponse } from "next/server";
import { AuthorizationError, requireOperator } from "@/application/services/authorization-service";
import { getAuthenticatedUserFromRequest } from "@/infrastructure/auth/request-auth";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { SqliteDeliveryRepository } from "@/infrastructure/repositories/sqlite-delivery-repository";
import { SqliteFailureRecordRepository } from "@/infrastructure/repositories/sqlite-failure-record-repository";
import { SqliteSubscriptionRepository } from "@/infrastructure/repositories/sqlite-subscription-repository";

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    ensurePersistenceReady();
    const user = await getAuthenticatedUserFromRequest(request);
    requireOperator(user);

    const subscriptions = new SqliteSubscriptionRepository();
    const deliveries = new SqliteDeliveryRepository();
    const failures = new SqliteFailureRecordRepository();

    const recentSince = hoursAgoIso(24);

    const activeSubscriptions = await subscriptions.countByStatus("active");

    const recentDeliveries = await deliveries.listRecent({ sinceIso: recentSince, limit: 1000 });
    const recentFailures = await failures.listRecent(1000, recentSince);

    const health =
      recentFailures.length === 0
        ? "healthy"
        : recentFailures.length <= 5
          ? "degraded"
          : "unhealthy";

    return NextResponse.json({
      activeSubscriptions,
      recentDeliveries: recentDeliveries.length,
      recentFailures: recentFailures.length,
      health,
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
