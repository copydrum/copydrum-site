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

interface PortOnePaymentConfirmPayload {
  paymentId: string; // PortOne payment ID (imp_uid, transaction_id)
  orderId?: string | null; // 주문 ID (merchant_uid) - 선택사항
}

interface PortOnePaymentResponse {
  id: string;
  status: string;
  amount: {
    total: number;
    currency: string;
  };
  requestedAt: number;
  paidAt?: number;
  cancelledAt?: number;
  failReason?: string;
  channelKey: string;
  storeId: string;
  orderId: string;
  customer?: {
    customerId?: string;
    email?: string;
    fullName?: string;
  };
  metadata?: Record<string, unknown>;
}

// 통화 변환 상수 (KRW 기준)
const KRW_PER_UNIT: Record<string, number> = {
  KRW: 1,
  USD: 1300, // 1 USD = 1300 KRW
  JPY: 10,   // 1 JPY = 10 KRW
};

// PortOne API로 결제 상태 조회
async function getPortOnePayment(
  paymentId: string,
  apiKey: string
): Promise<PortOnePaymentResponse> {
  const response = await fetch(`https://api.portone.io/v2/payments/${paymentId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `PortOne API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return await response.json();
}

// 통화별 금액 비교 (단위 변환 고려)
function compareAmounts(
  portoneAmount: number,
  portoneCurrency: string,
  orderAmountKRW: number
): boolean {
  // PortOne 응답의 currency에 따라 단위 변환
  let portoneAmountInKRW: number;

  if (portoneCurrency === "CURRENCY_USD" || portoneCurrency === "USD") {
    // USD는 센트 단위로 전달됨 (예: 231 센트 = 2.31 USD)
    const usdAmount = portoneAmount / 100;
    portoneAmountInKRW = usdAmount * KRW_PER_UNIT.USD;
  } else if (portoneCurrency === "CURRENCY_JPY" || portoneCurrency === "JPY") {
    // JPY는 엔 단위로 전달됨 (예: 300 엔)
    portoneAmountInKRW = portoneAmount * KRW_PER_UNIT.JPY;
  } else {
    // KRW는 원 단위로 전달됨
    portoneAmountInKRW = portoneAmount;
  }

  // 1% 오차 허용 (환율 변동 고려)
  const tolerance = orderAmountKRW * 0.01;
  const difference = Math.abs(portoneAmountInKRW - orderAmountKRW);

  console.log("[portone-payment-confirm] 금액 비교", {
    portoneAmount,
    portoneCurrency,
    portoneAmountInKRW,
    orderAmountKRW,
    difference,
    tolerance,
    match: difference <= tolerance,
  });

  return difference <= tolerance;
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
    const portoneApiKey = requireEnv("PORTONE_API_KEY");

    const payload: PortOnePaymentConfirmPayload = await req.json();
    const { paymentId, orderId } = payload;

    console.log("[portone-payment-confirm] 결제 확인 요청", {
      paymentId,
      orderId: orderId || null,
    });

    // paymentId는 필수
    if (!paymentId) {
      return buildResponse(
        { success: false, error: { message: "paymentId is required" } },
        400,
        origin
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // orderId가 없으면 PortOne API에서 먼저 가져오기
    let finalOrderId = orderId;
    let portonePaymentForOrderId: PortOnePaymentResponse | null = null;
    
    if (!finalOrderId) {
      console.log("[portone-payment-confirm] orderId가 없음, PortOne API에서 조회 시도", { paymentId });
      try {
        portonePaymentForOrderId = await getPortOnePayment(paymentId, portoneApiKey);
        if (portonePaymentForOrderId.orderId) {
          finalOrderId = portonePaymentForOrderId.orderId;
          console.log("[portone-payment-confirm] PortOne API에서 orderId 발견", {
            paymentId,
            orderId: finalOrderId,
          });
        } else {
          console.warn("[portone-payment-confirm] PortOne API 응답에 orderId가 없음", {
            paymentId,
            portonePayment: portonePaymentForOrderId,
          });
        }
      } catch (apiError) {
        console.error("[portone-payment-confirm] PortOne API 조회 실패 (orderId 조회용)", {
          paymentId,
          error: apiError,
        });
        // API 조회 실패해도 계속 진행 (transaction_id로 조회 시도)
      }
    }

    // 주문 확인: orderId가 있으면 id로, 없으면 transaction_id로 조회
    let order;
    let orderError;
    
    if (finalOrderId) {
      // orderId가 있을 때: id로 조회
      console.log("[portone-payment-confirm] orderId로 주문 조회", { orderId: finalOrderId });
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, drum_sheets(*))")
        .eq("id", finalOrderId)
        .maybeSingle();
      order = data;
      orderError = error;
    } else {
      // orderId가 없을 때: transaction_id로 조회 (가장 최근 주문)
      console.log("[portone-payment-confirm] transaction_id로 주문 조회", { paymentId });
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, drum_sheets(*))")
        .eq("transaction_id", paymentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      order = data;
      orderError = error;
    }

    if (orderError || !order) {
      console.error("[portone-payment-confirm] 주문을 찾을 수 없음", {
        originalOrderId: orderId || null,
        finalOrderId: finalOrderId || null,
        paymentId,
        orderError,
        searchMethod: finalOrderId ? "by_id" : "by_transaction_id",
        note: "모든 조회 방법을 시도했지만 주문을 찾지 못함",
      });
      
      // 추가 디버깅: transaction_id로 저장된 주문이 있는지 확인
      const { data: allOrdersWithTransactionId, error: checkError } = await supabase
        .from("orders")
        .select("id, transaction_id, created_at, payment_status")
        .eq("transaction_id", paymentId)
        .limit(5);
      
      console.log("[portone-payment-confirm] transaction_id로 조회된 주문 목록", {
        paymentId,
        foundOrders: allOrdersWithTransactionId || [],
        checkError,
      });
      
      return buildResponse(
        { 
          success: false, 
          error: { 
            message: "Order not found",
            details: {
              paymentId,
              originalOrderId: orderId || null,
              finalOrderId: finalOrderId || null,
              searchMethod: finalOrderId ? "by_id" : "by_transaction_id",
              debug: {
                transactionIdSearchResult: allOrdersWithTransactionId || [],
              }
            }
          } 
        },
        404,
        origin
      );
    }

    console.log("[portone-payment-confirm] 주문 조회 성공", {
      orderId: order.id,
      transaction_id: order.transaction_id,
      payment_status: order.payment_status,
      status: order.status,
      searchMethod: orderId ? "by_id" : "by_transaction_id",
    });

    // 이미 결제 완료된 경우
    if (order.payment_status === "paid") {
      console.log("[portone-payment-confirm] 이미 결제 완료된 주문", { orderId });
      return buildResponse({
        success: true,
        data: { orderId, message: "Order already paid" },
      }, 200, origin);
    }

    // PortOne API로 결제 상태 조회 (이미 호출한 경우 재사용)
    let portonePayment: PortOnePaymentResponse;
    if (portonePaymentForOrderId) {
      // 이미 호출한 결과 재사용
      portonePayment = portonePaymentForOrderId;
      console.log("[portone-payment-confirm] PortOne 결제 조회 결과 재사용", {
        paymentId,
        portonePaymentId: portonePayment.id,
        status: portonePayment.status,
        amount: portonePayment.amount,
        portoneOrderId: portonePayment.orderId,
        channelKey: portonePayment.channelKey,
        metadata: portonePayment.metadata,
        tx_id: portonePayment.id, // PortOne에서 반환하는 실제 payment ID
      });
    } else {
      // 처음 호출
      try {
        portonePayment = await getPortOnePayment(paymentId, portoneApiKey);
        console.log("[portone-payment-confirm] PortOne 결제 조회 성공", {
          paymentId,
          portonePaymentId: portonePayment.id,
          status: portonePayment.status,
          amount: portonePayment.amount,
          portoneOrderId: portonePayment.orderId,
          channelKey: portonePayment.channelKey,
          metadata: portonePayment.metadata,
          tx_id: portonePayment.id, // PortOne에서 반환하는 실제 payment ID
        });
      } catch (apiError) {
        console.error("[portone-payment-confirm] PortOne API 조회 실패", {
          paymentId,
          error: apiError,
        });
        return buildResponse(
          {
            success: false,
            error: {
              message: "Failed to fetch payment status from PortOne",
              details: apiError instanceof Error ? apiError.message : String(apiError),
            },
          },
          500,
          origin
        );
      }
    }

    // 결제 상태 검증
    // PortOne API 조회 결과를 우선시하여 처리
    // (웹훅에서 "READY"로 왔어도 API 조회 결과가 "PAID"면 처리)
    if (portonePayment.status !== "PAID") {
      console.warn("[portone-payment-confirm] 결제 상태가 PAID가 아님 (PortOne API 조회 결과)", {
        paymentId,
        status: portonePayment.status,
        note: "웹훅에서 READY 상태로 왔어도 API 조회 결과가 PAID가 아니면 처리하지 않음",
      });
      return buildResponse(
        {
          success: false,
          error: {
            message: `Payment status is not PAID: ${portonePayment.status}`,
            status: portonePayment.status,
          },
        },
        400,
        origin
      );
    }

    // merchant_uid(orderId) 일치 확인 (orderId가 있을 때만)
    if (orderId && portonePayment.orderId && portonePayment.orderId !== orderId) {
      console.error("[portone-payment-confirm] orderId 불일치", {
        portoneOrderId: portonePayment.orderId,
        expectedOrderId: orderId,
      });
      return buildResponse(
        {
          success: false,
          error: {
            message: "Order ID mismatch",
            portoneOrderId: portonePayment.orderId,
            expectedOrderId: orderId,
          },
        },
        400,
        origin
      );
    }
    
    // orderId가 없고 PortOne에서 orderId를 받은 경우, 해당 주문과 매칭 확인
    if (!orderId && portonePayment.orderId) {
      console.log("[portone-payment-confirm] PortOne에서 받은 orderId로 주문 매칭 확인", {
        portoneOrderId: portonePayment.orderId,
        foundOrderId: order.id,
      });
      
      // PortOne의 orderId와 찾은 주문의 id가 다를 수 있으므로
      // transaction_id로 이미 찾았으므로 경고만 로그
      if (portonePayment.orderId !== order.id) {
        console.warn("[portone-payment-confirm] PortOne orderId와 찾은 주문 ID 불일치 (계속 진행)", {
          portoneOrderId: portonePayment.orderId,
          foundOrderId: order.id,
        });
      }
    }

    // PayPal 채널 확인 (channelKey에 'paypal'이 포함되어 있는지 확인)
    const isPayPalPayment = portonePayment.channelKey?.toLowerCase().includes('paypal') || 
                            portonePayment.metadata?.paymentMethod === 'paypal' ||
                            false;

    // 카카오페이 채널 확인 (channelKey에 'kakaopay'가 포함되어 있는지 확인)
    const isKakaoPayPayment = portonePayment.channelKey?.toLowerCase().includes('kakaopay') ||
                               portonePayment.loggedProvider?.toLowerCase() === 'kakaopay' ||
                               false;

    console.log("[portone-payment-confirm] 결제 채널 확인", {
      paymentId,
      channelKey: portonePayment.channelKey,
      loggedProvider: portonePayment.loggedProvider,
      isPayPalPayment,
      isKakaoPayPayment,
      metadata: portonePayment.metadata,
    });

    // 금액 검증
    const portoneAmount = portonePayment.amount.total;
    const portoneCurrency = portonePayment.amount.currency;
    const orderAmountKRW = order.total_amount;

    console.log("[portone-payment-confirm] 금액 검증 시작", {
      portoneAmount,
      portoneCurrency,
      orderAmountKRW,
      isPayPalPayment,
    });

    if (!compareAmounts(portoneAmount, portoneCurrency, orderAmountKRW)) {
      console.error("[portone-payment-confirm] 금액 불일치", {
        portoneAmount,
        portoneCurrency,
        orderAmountKRW,
        isPayPalPayment,
      });
      return buildResponse(
        {
          success: false,
          error: {
            message: "Amount mismatch",
            portoneAmount,
            portoneCurrency,
            orderAmountKRW,
          },
        },
        400,
        origin
      );
    }

    // 모든 검증 통과 - 주문 상태 업데이트
    const now = new Date().toISOString();

    // 1. 캐시 충전 처리
    if (order.order_type === "cash") {
      console.log("[portone-payment-confirm] 캐시 충전 처리 시작", {
        orderId,
        paymentId,
        isPayPalPayment,
        chargeAmount: order.total_amount,
      });
      const chargeAmount = order.total_amount;
      const bonusCredits = order.metadata?.bonusCredits || 0;
      const totalCredits = chargeAmount + bonusCredits;

      // 사용자 프로필 업데이트 (RPC 사용 권장)
      const { error: profileError } = await supabase.rpc("increment_user_credit", {
        user_id_param: order.user_id,
        amount_param: totalCredits
      });

      if (profileError) {
        console.warn("[portone-payment-confirm] RPC 실패, 직접 업데이트 시도:", profileError);
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
        metadata: { order_id: order.id, payment_id: paymentId }
      });
    }

    // 2. 악보 구매 처리
    if (order.order_type === "product" && order.order_items) {
      console.log("[portone-payment-confirm] 악보 구매 처리 시작", {
        orderId,
        paymentId,
        isPayPalPayment,
        itemCount: order.order_items.length,
      });
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
          console.error("[portone-payment-confirm] 구매 기록 생성 오류 (무시하고 진행):", purchaseError);
        }
      }
    }

    // 3. 주문 상태 업데이트
    // payment_provider 결정: PayPal > KakaoPay > PortOne 순서
    let paymentProvider = "portone";
    if (isPayPalPayment) {
      paymentProvider = "paypal";
    } else if (isKakaoPayPayment) {
      paymentProvider = "kakaopay";
    }
    
    // payment_method 결정
    let paymentMethod = order.metadata?.payment_method || order.payment_method || "unknown";
    if (isPayPalPayment) {
      paymentMethod = "paypal";
    } else if (isKakaoPayPayment) {
      paymentMethod = "kakaopay";
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_provider: paymentProvider,
        transaction_id: paymentId,
        paid_at: now,
        status: "completed",
        metadata: {
          ...(order.metadata || {}),
          portone_payment_id: paymentId,
          portone_order_id: portonePayment.orderId || order.id,
          portone_amount: portoneAmount,
          portone_currency: portoneCurrency,
          portone_status: portonePayment.status,
          portone_paid_at: portonePayment.paidAt ? new Date(portonePayment.paidAt).toISOString() : null,
          portone_channel_key: portonePayment.channelKey,
          payment_method: paymentMethod,
          is_paypal_payment: isPayPalPayment,
          is_kakaopay_payment: isKakaoPayPayment,
          completed_by: "portone_payment_confirm",
          confirmed_at: now,
        },
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("[portone-payment-confirm] 주문 업데이트 오류", updateError);
      return buildResponse(
        { success: false, error: { message: "Failed to update order" } },
        500,
        origin
      );
    }

    console.log("[portone-payment-confirm] 결제 확인 및 주문 업데이트 성공", {
      orderId: order.id,
      paymentId,
      transaction_id: order.transaction_id,
      isPayPalPayment,
      isKakaoPayPayment,
      payment_provider: isPayPalPayment ? "paypal" : (isKakaoPayPayment ? "kakaopay" : "portone"),
      status: "paid",
    });

    return buildResponse({
      success: true,
      data: {
        orderId,
        paymentId,
        status: portonePayment.status,
        amount: portonePayment.amount,
      },
    }, 200, origin);
  } catch (error) {
    console.error("[portone-payment-confirm] 오류", error);
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



