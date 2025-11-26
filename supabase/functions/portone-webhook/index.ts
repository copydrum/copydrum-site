import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getCorsHeaders = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  "Access-Control-Max-Age": "86400",
});

const requireEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const buildResponse = <T>(payload: T, status = 200, origin?: string) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
  });

interface PortOneWebhookPayload {
  eventType: string; // 예: "payment.paid", "payment.failed", "payment.cancelled"
  paymentId: string; // PortOne payment ID
  orderId: string; // merchant_uid (주문 ID)
  status: string; // "PAID", "FAILED", "CANCELLED" 등
  amount?: {
    total: number;
    currency: string;
  };
  timestamp?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Webhook 이벤트 처리 기록을 위한 테이블 (멱등성 보장)
// 이미 처리된 webhook인지 확인
async function isWebhookProcessed(
  supabase: any,
  paymentId: string,
  eventType: string
): Promise<boolean> {
  // metadata에 webhook 처리 기록을 저장하거나 별도 테이블 사용
  // 여기서는 간단하게 orders 테이블의 metadata를 확인
  const { data: orders } = await supabase
    .from("orders")
    .select("metadata")
    .eq("pg_transaction_id", paymentId)
    .limit(1);

  if (!orders || orders.length === 0) {
    return false;
  }

  const metadata = orders[0].metadata as Record<string, unknown> | null;
  if (!metadata) {
    return false;
  }

  const processedWebhooks = metadata.processed_webhooks as string[] | undefined;
  if (!processedWebhooks) {
    return false;
  }

  return processedWebhooks.includes(`${paymentId}:${eventType}`);
}

// Webhook 처리 기록 저장
async function markWebhookProcessed(
  supabase: any,
  orderId: string,
  paymentId: string,
  eventType: string
): Promise<void> {
  const { data: order } = await supabase
    .from("orders")
    .select("metadata")
    .eq("id", orderId)
    .single();

  if (!order) {
    return;
  }

  const metadata = (order.metadata as Record<string, unknown>) || {};
  const processedWebhooks = (metadata.processed_webhooks as string[]) || [];
  
  const webhookKey = `${paymentId}:${eventType}`;
  if (!processedWebhooks.includes(webhookKey)) {
    processedWebhooks.push(webhookKey);
  }

  await supabase
    .from("orders")
    .update({
      metadata: {
        ...metadata,
        processed_webhooks: processedWebhooks,
        last_webhook_at: new Date().toISOString(),
        last_webhook_event: eventType,
      },
    })
    .eq("id", orderId);
}

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(origin),
    });
  }

  if (req.method !== "POST") {
    return buildResponse(
      { success: false, error: { message: "Method not allowed" } },
      405,
      origin
    );
  }

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const payload: PortOneWebhookPayload = await req.json();
    const { eventType, paymentId, orderId, status } = payload;

    console.log("[portone-webhook] Webhook 수신", {
      eventType,
      paymentId,
      orderId,
      status,
    });

    if (!paymentId || !orderId || !eventType) {
      return buildResponse(
        {
          success: false,
          error: {
            message: "paymentId, orderId, and eventType are required",
          },
        },
        400,
        origin
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 멱등성 확인: 이미 처리된 webhook인지 확인
    const isProcessed = await isWebhookProcessed(supabase, paymentId, eventType);
    if (isProcessed) {
      console.log("[portone-webhook] 이미 처리된 webhook", {
        paymentId,
        eventType,
      });
      return buildResponse({
        success: true,
        message: "Webhook already processed",
      }, 200, origin);
    }

    // 결제 완료 이벤트만 처리
    if (eventType === "payment.paid" && status === "PAID") {
      // portone-payment-confirm Edge Function 호출하여 최종 검증
      const confirmUrl = `${supabaseUrl}/functions/v1/portone-payment-confirm`;
      
      try {
        const confirmResponse = await fetch(confirmUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
            "apikey": serviceRoleKey,
          },
          body: JSON.stringify({
            paymentId,
            orderId,
          }),
        });

        const confirmResult = await confirmResponse.json();

        if (!confirmResponse.ok || !confirmResult.success) {
          console.error("[portone-webhook] 결제 확인 실패", confirmResult);
          return buildResponse(
            {
              success: false,
              error: {
                message: "Payment confirmation failed",
                details: confirmResult.error,
              },
            },
            500,
            origin
          );
        }

        // Webhook 처리 기록 저장
        await markWebhookProcessed(supabase, orderId, paymentId, eventType);

        console.log("[portone-webhook] 결제 확인 및 처리 완료", {
          paymentId,
          orderId,
        });

        return buildResponse({
          success: true,
          message: "Payment confirmed and order updated",
          data: confirmResult.data,
        }, 200, origin);
      } catch (confirmError) {
        console.error("[portone-webhook] 결제 확인 중 오류", confirmError);
        return buildResponse(
          {
            success: false,
            error: {
              message: "Failed to confirm payment",
              details: confirmError instanceof Error ? confirmError.message : String(confirmError),
            },
          },
          500,
          origin
        );
      }
    } else {
      // 결제 완료가 아닌 이벤트는 로그만 기록
      console.log("[portone-webhook] 결제 완료가 아닌 이벤트", {
        eventType,
        status,
      });

      // Webhook 수신 기록만 저장 (처리하지 않음)
      await markWebhookProcessed(supabase, orderId, paymentId, eventType);

      return buildResponse({
        success: true,
        message: "Webhook received but not processed (not a paid event)",
      }, 200, origin);
    }
  } catch (error) {
    console.error("[portone-webhook] 오류", error);
    return buildResponse(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Internal server error",
        },
      },
      500,
      origin
    );
  }
});

