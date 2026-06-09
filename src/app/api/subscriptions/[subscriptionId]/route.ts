import { NextResponse } from "next/server";
import { AuthorizationError } from "@/application/services/authorization-service";
import { requireCurrentActiveUser } from "@/infrastructure/auth/require-user";
import { ensurePersistenceReady } from "@/infrastructure/persistence/bootstrap";
import { SqliteSubscriptionRepository } from "@/infrastructure/repositories/sqlite-subscription-repository";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ subscriptionId: string }> },
): Promise<NextResponse> {
  const payload = (await request.json()) as { status?: "inactive" };
  const { subscriptionId } = await params;

  if (payload.status !== "inactive") {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "status must be inactive" } },
      { status: 400 },
    );
  }

  try {
    ensurePersistenceReady();
    const user = await requireCurrentActiveUser(request);
    const subscriptions = new SqliteSubscriptionRepository();

    const subscription = await subscriptions.findById(subscriptionId);

    if (!subscription || subscription.userId !== user.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Subscription not found" } },
        { status: 404 },
      );
    }

    await subscriptions.deactivate(subscriptionId, new Date().toISOString());
    const updated = await subscriptions.findById(subscriptionId);

    return NextResponse.json({
      subscription: {
        id: updated?.id,
        status: updated?.status,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    throw error;
  }
}
