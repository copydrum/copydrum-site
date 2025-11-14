import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const requireEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const buildResponse = <T>(payload: T, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const payload = await req.json();

    const { orderId, transactionId, amount, rawResponse } = payload ?? {};

    if (!orderId || !transactionId) {
      return buildResponse(
        { success: false, error: { message: "orderId와 transactionId는 필수입니다." } },
        400,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const nowIso = new Date().toISOString();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      return buildResponse(
        { success: false, error: { message: "주문을 조회할 수 없습니다.", details: orderError } },
        400,
      );
    }

    if (!order) {
      return buildResponse(
        { success: false, error: { message: "해당 주문이 존재하지 않습니다." } },
        404,
      );
    }

    const { error: updateOrderError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "payment_confirmed",
        transaction_id: transactionId,
        payment_confirmed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", orderId);

    if (updateOrderError) {
      return buildResponse(
        {
          success: false,
          error: { message: "주문 결제 상태 업데이트에 실패했습니다.", details: updateOrderError },
        },
        400,
      );
    }

    const { error: updateLogError } = await supabase
      .from("payment_transactions")
      .update({
        status: "paid",
        pg_transaction_id: transactionId,
        raw_response: rawResponse ?? null,
        amount: amount ?? null,
        updated_at: nowIso,
      })
      .eq("order_id", orderId);

    if (updateLogError) {
      console.error("[inicis-approve] 결제 로그 업데이트 실패", updateLogError);
    }

    return buildResponse({ success: true });
  } catch (error) {
    console.error("[inicis-approve] Unexpected error", error);
    return buildResponse(
      {
        success: false,
        error: {
          message: "KG이니시스 결제 승인 처리 중 오류가 발생했습니다.",
          details: error?.message ?? error,
        },
      },
      500,
    );
  }
});



