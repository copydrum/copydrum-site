import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.224.0/hash/mod.ts";

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
    const mid = requireEnv("INICIS_MID");
    const merchantKey = requireEnv("INICIS_MERCHANT_KEY");

    const payload = await req.json();

    const {
      userId,
      orderId,
      amount,
      description,
      returnUrl,
      method = "card",
      goodsName,
      buyerName,
      buyerEmail,
      buyerTel,
      metadata = {},
    } = payload ?? {};

    if (!userId || !orderId || !amount || !returnUrl) {
      return buildResponse(
        {
          success: false,
          error: { message: "필수 파라미터가 누락되었습니다." },
        },
        400,
      );
    }

    const normalizedAmount = Math.max(0, Math.round(Number(amount) || 0));
    if (normalizedAmount <= 0) {
      return buildResponse(
        {
          success: false,
          error: { message: "결제 금액이 올바르지 않습니다." },
        },
        400,
      );
    }

    const timestamp = Date.now().toString();
    const hashedMerchantKey = createHash("sha256").update(merchantKey).toString().toUpperCase();
    const signatureSource = `${mid}${orderId}${normalizedAmount}${timestamp}${hashedMerchantKey}`;
    const signature = createHash("sha256").update(signatureSource).toString().toUpperCase();
    const transactionId = crypto.randomUUID();

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: logError } = await supabase.from("payment_transactions").insert({
      order_id: orderId,
      user_id: userId,
      payment_method: method,
      payment_provider: "inicis",
      amount: normalizedAmount,
      status: "pending",
      pg_transaction_id: transactionId,
      raw_request: payload,
      created_at: new Date().toISOString(),
    });

    if (logError) {
      console.error("[inicis-init] 결제 로그 저장 실패", logError);
    }

    const requestForm = {
      action: "https://stdpay.inicis.com/stdpay/INIStdPayRequest.do",
      method: "POST" as const,
      inputs: {
        version: "1.0",
        mid,
        oid: orderId,
        price: normalizedAmount.toString(),
        timestamp,
        signature,
        mKey: hashedMerchantKey,
        returnUrl,
        closeUrl: metadata.closeUrl ?? "",
        currency: "WON",
        goodname: goodsName ?? description ?? "콘텐츠 결제",
        buyername: buyerName ?? "",
        buyeremail: buyerEmail ?? "",
        buyertel: buyerTel ?? "",
        gopaymethod: method === "kakaopay" ? "KAKAOPAY" : "Card",
        offerPeriod: metadata.offerPeriod ?? "",
        acceptmethod: metadata.acceptmethod ?? "HPP(2)",
        languageView: "ko",
        charSet: "utf-8",
        payViewType: metadata.payViewType ?? "",
      },
    };

    return buildResponse({
      success: true,
      data: {
        paymentId: orderId,
        transactionId,
        paymentUrl: requestForm.action,
        requestForm,
        additionalData: {
          timestamp,
          mid,
          method,
        },
      },
    });
  } catch (error) {
    console.error("[inicis-init] Unexpected error", error);
    return buildResponse(
      {
        success: false,
        error: {
          message: "KG이니시스 결제 초기화 중 오류가 발생했습니다.",
          details: error?.message ?? error,
        },
      },
      500,
    );
  }
});





