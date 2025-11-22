import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getCorsHeaders = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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

interface PortOnePayPalPayload {
  imp_uid: string; // 포트원 거래 고유번호
  merchant_uid: string; // 주문 ID
  paid_amount?: number; // 실제 결제된 금액
  status?: string; // 'paid', 'failed', 'cancelled' 등
  orderId: string; // 주문 ID (merchant_uid와 동일)
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

    const payload: PortOnePayPalPayload = await req.json();
    const { imp_uid, merchant_uid, paid_amount, status, orderId } = payload;

    console.log("[portone-paypal] 결제 완료 요청", {
      imp_uid,
      merchant_uid,
      paid_amount,
      status,
      orderId,
    });

    if (!imp_uid || !merchant_uid || !orderId) {
      return buildResponse(
        { success: false, error: { message: "imp_uid, merchant_uid, and orderId are required" } },
        400,
        origin
      );
    }

    // 결제 상태 확인
    if (status !== "paid") {
      console.warn("[portone-paypal] 결제 상태가 paid가 아님", { status });
      return buildResponse(
        { success: false, error: { message: `Payment status is not paid: ${status}` } },
        400,
        origin
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 주문 확인
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("[portone-paypal] 주문을 찾을 수 없음", { orderId, orderError });
      return buildResponse(
        { success: false, error: { message: "Order not found" } },
        404,
        origin
      );
    }

    // 이미 결제 완료된 경우
    if (order.payment_status === "paid") {
      console.log("[portone-paypal] 이미 결제 완료된 주문", { orderId });
      return buildResponse({
        success: true,
        data: { orderId, message: "Order already paid" },
      }, 200, origin);
    }

    // 주문 상태 업데이트
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_provider: "portone",
        pg_transaction_id: imp_uid,
        paid_at: now,
        status: "completed", // 주문 상태도 완료로 변경
        metadata: {
          ...(order.metadata || {}),
          portone_imp_uid: imp_uid,
          portone_merchant_uid: merchant_uid,
          portone_paid_amount: paid_amount,
          portone_status: status,
          payment_method: "paypal",
        },
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("[portone-paypal] 주문 업데이트 오류", updateError);
      return buildResponse(
        { success: false, error: { message: "Failed to update order" } },
        500,
        origin
      );
    }

    console.log("[portone-paypal] 결제 완료 처리 성공", { orderId, imp_uid });

    return buildResponse({
      success: true,
      data: {
        orderId,
        imp_uid,
        merchant_uid,
        paid_amount,
      },
    }, 200, origin);
  } catch (error) {
    console.error("[portone-paypal] 오류", error);
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






