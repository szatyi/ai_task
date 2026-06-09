import { NextResponse } from "next/server";
import { AuthorizationError, requireOperator } from "@/application/services/authorization-service";
import { getAuthenticatedUserFromRequest } from "@/infrastructure/auth/request-auth";
import {
  ChannelNotConfiguredError,
  getConfiguredProvider,
} from "@/infrastructure/providers/provider-factory";

export async function POST(request: Request): Promise<NextResponse> {
  const payload = (await request.json()) as {
    channel?: "email" | "slack";
    target?: string;
    message?: string;
  };

  if (!payload.channel || !["email", "slack"].includes(payload.channel) || !payload.message) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "channel and message are required" } },
      { status: 400 },
    );
  }

  try {
    const user = await getAuthenticatedUserFromRequest(request);
    requireOperator(user);

    const provider = getConfiguredProvider(payload.channel);
    const providerResult = await provider.send({
      subject: "Test notification",
      body: payload.message,
      target: payload.target,
    });

    return NextResponse.json({
      result: {
        status: "sent",
        channel: payload.channel,
        providerMessageId: providerResult.providerMessageId,
      },
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

    if (error instanceof ChannelNotConfiguredError) {
      return NextResponse.json(
        { error: { code: "UNPROCESSABLE_ENTITY", message: error.message } },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: { code: "PROVIDER_FAILURE", message: "Provider call failed" } },
      { status: 502 },
    );
  }
}
