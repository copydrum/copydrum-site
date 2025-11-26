// ========================================
// 임시 테스트용: 무조건 200 응답
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // 그냥 뭐가 왔는지만 로그 찍기
  console.log("[portone-webhook] raw request", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  // 바디도 한 번 읽어봄 (필요 없으면 지워도 됨)
  const bodyText = await req.text();
  console.log("[portone-webhook] body:", bodyText);

  // ★★ 여기서 무조건 200 OK 반환 ★★
  return new Response("OK", { status: 200 });
}, {
  // ★★ 가장 중요: JWT 검증 끄기 ★★
  verifyJwt: false,
});

// ========================================
// 기존 코드 (주석 처리 - 나중에 복구용)
// ========================================

/*
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

// PortOne Webhook 시그니처 검증 함수
async function verifyPortOneSignature(
  body: string,
  signature: string | null,
  timestamp: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !timestamp) {
    console.warn("[portone-webhook] 시그니처 또는 타임스탬프 헤더가 없습니다.");
    return false;
  }

  try {
    // 타임스탬프 유효성 검증 (5분 이내)
    const requestTimestamp = parseInt(timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timeDifference = Math.abs(currentTimestamp - requestTimestamp);

    if (timeDifference > 300) {
      console.warn("[portone-webhook] 타임스탬프가 5분을 초과했습니다.", {
        requestTimestamp,
        currentTimestamp,
        timeDifference,
      });
      return false;
    }

    // 서명 생성: timestamp + "." + body
    const payload = `${timestamp}.${body}`;

    // HMAC-SHA256 서명 생성
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      payloadData
    );

    // 서명을 hex 문자열로 변환
    const hashArray = Array.from(new Uint8Array(signatureBytes));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // 서명 비교 (타이밍 공격 방지를 위해 constant-time comparison 권장)
    const isValid = hashHex === signature.toLowerCase();

    if (!isValid) {
      console.warn("[portone-webhook] 시그니처 검증 실패", {
        expected: hashHex,
        received: signature,
      });
    }

    return isValid;
  } catch (error) {
    console.error("[portone-webhook] 시그니처 검증 중 오류", error);
    return false;
  }
}

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

    // Request body를 텍스트로 읽기 (시그니처 검증용)
    const bodyText = await req.text();
    
    // PortOne Webhook 시그니처 검증
    const webhookSecret = Deno.env.get("PORTONE_WEBHOOK_SECRET");
    if (webhookSecret) {
      const signature = req.headers.get("x-portone-signature");
      const timestamp = req.headers.get("x-portone-timestamp");

      const isValid = await verifyPortOneSignature(
        bodyText,
        signature,
        timestamp,
        webhookSecret
      );

      if (!isValid) {
        console.error("[portone-webhook] 시그니처 검증 실패", {
          signature,
          timestamp,
        });
        // 웹훅은 항상 200 응답을 반환하여 재시도를 방지
        return buildResponse(
          {
            success: false,
            error: { message: "Invalid signature" },
          },
          200,
          origin
        );
      }
    } else {
      console.warn("[portone-webhook] PORTONE_WEBHOOK_SECRET이 설정되지 않아 시그니처 검증을 건너뜁니다.");
    }

    // Body를 JSON으로 파싱
    const payload: PortOneWebhookPayload = JSON.parse(bodyText);
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
          // 웹훅은 항상 200 응답을 반환하여 재시도를 방지
          return buildResponse(
            {
              success: false,
              error: {
                message: "Payment confirmation failed",
                details: confirmResult.error,
              },
            },
            200,
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
        // 웹훅은 항상 200 응답을 반환하여 재시도를 방지
        return buildResponse(
          {
            success: false,
            error: {
              message: "Failed to confirm payment",
              details: confirmError instanceof Error ? confirmError.message : String(confirmError),
            },
          },
          200,
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
    // 웹훅은 항상 200 응답을 반환하여 재시도를 방지
    return buildResponse(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Internal server error",
        },
      },
      200,
      origin
    );
  }
}, { verifyJwt: false });
*/
