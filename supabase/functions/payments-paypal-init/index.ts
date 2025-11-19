import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";



// CORS — 실패하든 성공하든 항상 이 헤더를 반환해야 한다

const ALLOWED_ORIGINS = [

  "https://en.copydrum.com",

  "https://www.en.copydrum.com",

  "https://copydrum.com",

  "https://www.copydrum.com"

];



function getCorsHeaders(origin?: string) {

  // 실제 origin이 배열에 있으면 해당 origin을 그대로 반환

  const allowedOrigin: string = origin && ALLOWED_ORIGINS.includes(origin)

    ? origin

    : ALLOWED_ORIGINS[0];



  return {

    "Access-Control-Allow-Origin": allowedOrigin,

    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",

    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",

    "Access-Control-Max-Age": "86400",

  };

}



// 파싱 안전 함수

async function safeJson(req: Request) {

  try {

    return await req.json();

  } catch {

    return {};

  }

}



// USD 변환 (고정 환율 or env계산 가능)

function convertKRWtoUSD(krw: number) {

  return +(krw / 1300).toFixed(2); // 환율 1300원 기준 (원하면 변경)

}



// PayPal 토큰 요청

async function getPayPalAccessToken(clientId: string, clientSecret: string, isSandbox: boolean) {

  const base = isSandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

  const auth = btoa(`${clientId}:${clientSecret}`);



  const res = await fetch(`${base}/v1/oauth2/token`, {

    method: "POST",

    headers: {

      "Authorization": `Basic ${auth}`,

      "Content-Type": "application/x-www-form-urlencoded",

    },

    body: "grant_type=client_credentials",

  });



  if (!res.ok) throw new Error(`PayPal token error: ${await res.text()}`);

  return (await res.json()).access_token;

}



serve(async (req: Request) => {

  const origin = req.headers.get("origin") ?? "";

  const corsHeaders = getCorsHeaders(origin);



  // ===== OPTIONS (CORS preflight) =====

  if (req.method === "OPTIONS") {

    return new Response(null, {

      status: 204,

      headers: getCorsHeaders(origin),

    });

  }



  // ===== POST only =====

  if (req.method !== "POST") {

    return new Response(JSON.stringify({ error: "Method not allowed" }), {

      status: 405,

      headers: { ...corsHeaders, "Content-Type": "application/json" },

    });

  }



  // ===== JSON 파싱 =====

  const body = await safeJson(req);



  const userId = body.userId;

  const orderId = body.orderId;

  const amountKRW = body.amount; // 프론트에서 보내는 값 그대로 사용

  const description = body.description ?? "";

  const buyerEmail = body.buyerEmail ?? "";

  const buyerName = body.buyerName ?? "";



  if (!userId || !orderId || !amountKRW) {

    return new Response(

      JSON.stringify({ error: "userId, orderId, amount are required" }),

      { status: 400, headers: corsHeaders }

    );

  }



  const amountUSD = convertKRWtoUSD(amountKRW);



  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID")!;

  const paypalClientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;

  const sandbox = (Deno.env.get("PAYPAL_SANDBOX") ?? "true") === "true";



  const supabase = createClient(supabaseUrl, serviceRole);



  // 주문 정보 조회

  const { data: order } = await supabase

    .from("orders")

    .select("*")

    .eq("id", orderId)

    .eq("user_id", userId)

    .single();



  if (!order) {

    return new Response(JSON.stringify({ error: "Order not found" }), {

      status: 404,

      headers: corsHeaders,

    });

  }



  // PayPal token

  const token = await getPayPalAccessToken(paypalClientId, paypalClientSecret, sandbox);



  const base = sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";



  // PayPal order 생성

  const paypalRes = await fetch(`${base}/v2/checkout/orders`, {

    method: "POST",

    headers: {

      "Authorization": `Bearer ${token}`,

      "Content-Type": "application/json",

    },

    body: JSON.stringify({

      intent: "CAPTURE",

      purchase_units: [{

        reference_id: orderId,

        amount: { currency_code: "USD", value: amountUSD.toString() },

        description,

      }],

      application_context: {

        brand_name: "CopyDrum",

        user_action: "PAY_NOW",

        return_url: `https://en.copydrum.com/payments/paypal/return`,

        cancel_url: `https://en.copydrum.com/payments/paypal/cancel`,

      },

    }),

  });



  const paypalOrder = await paypalRes.json();



  if (!paypalRes.ok) {

    return new Response(JSON.stringify({ error: "PayPal order failed", details: paypalOrder }), {

      status: 500,

      headers: corsHeaders,

    });

  }



  const approvalUrl = paypalOrder.links?.find((l: any) => l.rel === "approve")?.href;



  return new Response(

    JSON.stringify({

      success: true,

      orderId,

      paypalOrderId: paypalOrder.id,

      approvalUrl,

    }),

    { status: 200, headers: corsHeaders },

  );

});
