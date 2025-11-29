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

interface PortOnePaymentResponse {
  id: string;
  status: string;
  amount: {
    total: number;
    currency: string;
  };
  orderId?: string;
  transactionId?: string;
  metadata?: Record<string, unknown>;
}

async function getPortOneAccessToken(apiSecret: string): Promise<string> {
  const cleanSecret = apiSecret.replace(/[\s"']/g, "").trim();
  
  const response = await fetch("https://api.portone.io/login/api-secret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiSecret: cleanSecret }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[portone-payment-confirm] 토큰 발급 실패", { status: response.status, body: errorText });
    throw new Error(`Failed to login to PortOne: ${errorText}`);
  }

  const result = await response.json();
  return result.accessToken;
}

async function getPortOnePayment(
  paymentId: string,
  apiSecret: string
): Promise<PortOnePaymentResponse> {
  
  const accessToken = await getPortOneAccessToken(apiSecret);
  const url = `https://api.portone.io/v2/payments/${paymentId}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[portone-payment-confirm] API 조회 실패", { status: response.status, body: errorText });
    throw new Error(`PortOne API error: ${response.status} ${errorText}`);
  }

  const rawResult = await response.json();
  console.log("[DEBUG] PortOne 원본 응답:", JSON.stringify(rawResult, null, 2));

  // 구조 평탄화
  if (rawResult.payment && rawResult.payment.transactions && rawResult.payment.transactions.length > 0) {
    const tx = rawResult.payment.transactions[0];
    return {
      id: rawResult.payment.id,
      transactionId: tx.id,
      status: tx.status,
      amount: tx.amount,
      orderId: rawResult.payment.order_name,
      metadata: tx.metadata || {}
    };
  }

  console.error("[portone-payment-confirm] 예상치 못한 응답 구조", rawResult);
  throw new Error("Invalid payment data structure from PortOne");
}

function compareAmounts(
  portoneAmount: number,
  portoneCurrency: string,
  orderAmountKRW: number
): boolean {
  let portoneAmountInKRW: number;
  if (portoneCurrency === "CURRENCY_USD" || portoneCurrency === "USD") {
    portoneAmountInKRW = (portoneAmount / 100) * 1300; 
  } else if (portoneCurrency === "CURRENCY_JPY" || portoneCurrency === "JPY") {
    portoneAmountInKRW = portoneAmount * 10;
  } else {
    portoneAmountInKRW = portoneAmount;
  }
  const tolerance = orderAmountKRW * 0.01;
  return Math.abs(portoneAmountInKRW - orderAmountKRW) <= tolerance;
}

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: getCorsHeaders(origin) });

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const portoneApiKey = requireEnv("PORTONE_API_KEY");

    const payload = await req.json();
    const { paymentId, orderId } = payload;

    if (!paymentId) {
      return buildResponse({ success: false, error: { message: "paymentId is required" } }, 400, origin);
    }

    const portonePayment = await getPortOnePayment(paymentId, portoneApiKey);

    console.log("[portone-payment-confirm] 포트원 조회 성공:", { 
      id: portonePayment.id,
      status: portonePayment.status, 
      amount: portonePayment.amount.total 
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let orderData = null;
    
    // transaction_id로 찾기
    const { data: byTxId } = await supabase
      .from("orders")
      .select("*")
      .eq("transaction_id", paymentId)
      .maybeSingle();
      
    if (byTxId) {
      orderData = byTxId;
    } else if (orderId) {
      const { data: byOrderId } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      orderData = byOrderId;
    }

    if (!orderData) {
       console.error("주문을 찾을 수 없음", { paymentId, orderId });
       return buildResponse({ success: false, error: { message: "Order not found" } }, 404, origin);
    }

    const order = orderData;

    // 금액 검증
    if (!compareAmounts(portonePayment.amount.total, portonePayment.amount.currency, order.total_amount)) {
       console.error("금액 불일치", { portone: portonePayment.amount.total, order: order.total_amount });
       return buildResponse({ success: false, error: { message: "Amount mismatch" } }, 400, origin);
    }
    
    if (portonePayment.status !== "PAID") {
       console.warn("결제 상태가 PAID가 아님", portonePayment.status);
       return buildResponse({ success: false, error: { message: `Payment status is ${portonePayment.status}` } }, 400, origin);
    }

    if (order.payment_status === "paid") {
       return buildResponse({ success: true, message: "Already processed" }, 200, origin);
    }

    // 🟢 [수정 완료] DB 제약조건에 맞춰 status를 'completed'로 설정
    const { error: updateError } = await supabase
      .from("orders")
      .update({ 
        payment_status: "paid",  // payment_status는 제약조건이 없다면 'paid' 유지
        status: "completed",     // ⭐️ 여기가 핵심! 'completed'로 변경
        transaction_id: paymentId,
        payment_confirmed_at: new Date().toISOString()
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("[portone-payment-confirm] DB 업데이트 실패:", updateError);
      throw updateError;
    }

    console.log("[portone-payment-confirm] 결제 처리 완료:", order.id);
    return buildResponse({ success: true, data: order }, 200, origin);

  } catch (error) {
    console.error("[portone-payment-confirm] Error:", error);
    return buildResponse(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Internal server error",
          details: error 
        },
      },
      500,
      origin
    );
  }
});
