import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://en.copydrum.com";

const getCorsHeaders = (origin?: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
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

const buildResponse = <T>(payload: T, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
  });

interface PayPalOrderRequest {
  intent: "CAPTURE";
  purchase_units: Array<{
    reference_id: string;
    description: string;
    amount: {
      currency_code: "USD";
      value: string;
    };
  };
  application_context: {
    brand_name?: string;
    landing_page?: "NO_PREFERENCE" | "LOGIN" | "BILLING";
    user_action?: "PAY_NOW" | "CONTINUE";
    return_url: string;
    cancel_url: string;
  };
}

interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

// PayPal Access Token 가져오기
async function getPayPalAccessToken(clientId: string, clientSecret: string, isSandbox: boolean): Promise<string> {
  const baseUrl = isSandbox 
    ? "https://api.sandbox.paypal.com" 
    : "https://api.paypal.com";
  
  const auth = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal token request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// PayPal Order 생성
async function createPayPalOrder(
  accessToken: string,
  orderRequest: PayPalOrderRequest,
  isSandbox: boolean
): Promise<PayPalOrderResponse> {
  const baseUrl = isSandbox 
    ? "https://api.sandbox.paypal.com" 
    : "https://api.paypal.com";

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify(orderRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal order creation failed: ${response.status} ${errorText}`);
  }

  return await response.json();
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
      405
    );
  }

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const paypalClientId = requireEnv("PAYPAL_CLIENT_ID");
    const paypalClientSecret = requireEnv("PAYPAL_CLIENT_SECRET");
    const paypalSandbox = Deno.env.get("PAYPAL_SANDBOX") === "true";
    const siteUrl = Deno.env.get("SITE_URL") || "https://en.copydrum.com";

    const payload = await req.json();
    const { userId, orderId, amountKRW, amountUSD, description, buyerEmail, buyerName, returnUrl, cancelUrl } = payload ?? {};

    if (!userId || !orderId || !amountKRW || !amountUSD) {
      return buildResponse(
        { success: false, error: { message: "userId, orderId, amountKRW, and amountUSD are required" } },
        400
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 주문 확인
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single();

    if (orderError || !order) {
      return buildResponse(
        { success: false, error: { message: "Order not found" } },
        404
      );
    }

    // PayPal Access Token 가져오기
    const accessToken = await getPayPalAccessToken(paypalClientId, paypalClientSecret, paypalSandbox);

    // PayPal Order 생성
    const paypalOrderRequest: PayPalOrderRequest = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orderId,
          description: description || `Order ${order.order_number || orderId}`,
          amount: {
            currency_code: "USD",
            value: amountUSD.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "CopyDrum",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: returnUrl || `${siteUrl}/payments/paypal/return`,
        cancel_url: cancelUrl || `${siteUrl}/payments/paypal/cancel`,
      },
    };

    const paypalOrder = await createPayPalOrder(accessToken, paypalOrderRequest, paypalSandbox);

    // 승인 URL 찾기
    const approvalLink = paypalOrder.links.find(link => link.rel === "approve");
    if (!approvalLink) {
      return buildResponse(
        { success: false, error: { message: "PayPal approval URL not found" } },
        500
      );
    }

    // 주문에 PayPal Order ID 저장
    await supabase
      .from("orders")
      .update({
        payment_provider: "paypal",
        pg_transaction_id: paypalOrder.id,
        metadata: {
          ...(order.metadata || {}),
          paypal_order_id: paypalOrder.id,
          paypal_status: paypalOrder.status,
        },
      })
      .eq("id", orderId);

    return buildResponse({
      success: true,
      data: {
        orderId,
        paypalOrderId: paypalOrder.id,
        approvalUrl: approvalLink.href,
      },
    });
  } catch (error) {
    console.error("[paypal-init] Error:", error);
    return buildResponse(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Internal server error",
        },
      },
      500
    );
  }
});

