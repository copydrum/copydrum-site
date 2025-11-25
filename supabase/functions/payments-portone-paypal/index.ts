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

    // 주문 확인 (order_items와 drum_sheets 포함)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(*, drum_sheets(*))")
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

    const now = new Date().toISOString();

    // 1. 캐시 충전 처리
    if (order.order_type === "cash") {
      console.log("[portone-paypal] 캐시 충전 처리 시작");
      const chargeAmount = order.total_amount;
      const bonusCredits = order.metadata?.bonusCredits || 0;
      const totalCredits = chargeAmount + bonusCredits;

      // 사용자 프로필 업데이트 (RPC 사용 권장)
      const { error: profileError } = await supabase.rpc("increment_user_credit", {
        user_id_param: order.user_id,
        amount_param: totalCredits
      });

      if (profileError) {
        console.warn("[portone-paypal] RPC 실패, 직접 업데이트 시도:", profileError);
        const { data: profile } = await supabase
          .from("profiles")
          .select("credit_amount")
          .eq("id", order.user_id)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({ credit_amount: (profile.credit_amount || 0) + totalCredits })
            .eq("id", order.user_id);
        }
      }

      // 포인트 내역 기록
      await supabase.from("point_history").insert({
        user_id: order.user_id,
        amount: totalCredits,
        type: "charge",
        description: `PayPal 캐시 충전 (주문번호: ${order.order_number || order.id})`,
        metadata: { order_id: order.id, imp_uid }
      });
    }

    // 2. 악보 구매 처리
    if (order.order_type === "product" && order.order_items) {
      console.log("[portone-paypal] 악보 구매 처리 시작");
      const purchases = order.order_items.map((item: any) => ({
        user_id: order.user_id,
        sheet_id: item.drum_sheet_id,
        order_id: order.id,
        price: item.price,
        is_active: true
      }));

      if (purchases.length > 0) {
        const { error: purchaseError } = await supabase
          .from("purchases")
          .insert(purchases);

        if (purchaseError) {
          console.error("[portone-paypal] 구매 기록 생성 오류 (무시하고 진행):", purchaseError);
        }
      }
    }

    // 3. 주문 상태 업데이트
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
          completed_by: "portone_webhook"
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











