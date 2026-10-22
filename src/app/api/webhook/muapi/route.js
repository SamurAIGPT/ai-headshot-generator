import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashMuapiWebhookToken, verifyMuapiWebhookToken } from "@/lib/services/muapi-webhook";

export async function POST(req) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    const tokenHash = hashMuapiWebhookToken(token);
    if (!tokenHash) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await req.json();
    const requestIdValue = data.id || data.request_id;
    if (typeof requestIdValue !== "string" || !requestIdValue.trim()) {
      return NextResponse.json({ error: "Missing request id" }, { status: 400 });
    }
    const requestId = requestIdValue.trim();

    const creation = await prisma.creation.findUnique({
      where: { webhookTokenHash: tokenHash },
    });
    if (!creation || !verifyMuapiWebhookToken(token, creation.webhookTokenHash)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (creation.requestId && creation.requestId !== requestId) {
      return NextResponse.json({ error: "Request id does not match this webhook token" }, { status: 409 });
    }
    if (creation.status !== "processing") {
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    const failed = data.status === "failed" || Boolean(data.error);
    const errorMessage = typeof data.error === "string" ? data.error : (data.error ? JSON.stringify(data.error) : "Generation failed");
    const resultData = failed
      ? { requestId, status: "failed", error: errorMessage }
      : {
          requestId,
          status: "completed",
          error: null,
          imageUrl: JSON.stringify(Array.isArray(data.outputs) ? data.outputs : (data.output ? [data.output] : [])),
          isPack: true,
        };

    const updated = await prisma.creation.updateMany({
      where: { id: creation.id, status: "processing", requestId: creation.requestId },
      data: resultData,
    });
    return NextResponse.json({ success: true, message: updated.count === 1 ? "Processed" : "Already processed" });
  } catch (error) {
    console.error("[MUAPI_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
