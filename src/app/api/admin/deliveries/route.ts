import { NextResponse } from "next/server";
import { AuthorizationError, requireOperator } from "@/application/services/authorization-service";
import { getAuthenticatedUserFromRequest } from "@/infrastructure/auth/request-auth";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { SqliteDeliveryRepository } from "@/infrastructure/repositories/sqlite-delivery-repository";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const channel = url.searchParams.get("channel");
  const limitValue = Number(url.searchParams.get("limit") ?? "50");

  const normalizedLimit = Number.isNaN(limitValue) ? 50 : Math.min(Math.max(limitValue, 1), 500);

  try {
    ensurePersistenceReady();
    const user = await getAuthenticatedUserFromRequest(request);
    requireOperator(user);

    const deliveries = new SqliteDeliveryRepository();
    const items = await deliveries.listRecent({
      status:
        status === "queued" ||
        status === "sending" ||
        status === "sent" ||
        status === "failed" ||
        status === "skipped"
          ? status
          : undefined,
      channel: channel === "email" || channel === "slack" ? channel : undefined,
      limit: normalizedLimit,
    });

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        eventId: item.eventId,
        subscriptionId: item.subscriptionId,
        channel: item.channel,
        status: item.status,
        sentAt: item.sentAt,
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
