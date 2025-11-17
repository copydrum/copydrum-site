import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // POST 요청 처리 (KG이니시스에서 returnUrl로 POST 데이터 전송)
    if (req.method === "POST") {
      // form-data 또는 x-www-form-urlencoded 파싱
      const contentType = req.headers.get("content-type") || "";
      
      let formData: Record<string, string> = {};
      
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const body = await req.text();
        const params = new URLSearchParams(body);
        for (const [key, value] of params.entries()) {
          formData[key] = value;
        }
      } else if (contentType.includes("application/json")) {
        formData = await req.json();
      } else {
        // form-data 처리
        const formDataObj = await req.formData();
        for (const [key, value] of formDataObj.entries()) {
          formData[key] = value instanceof File ? await value.text() : String(value);
        }
      }

      const resultCode = formData.resultCode || "";
      const mid = formData.mid || "";
      const authToken = formData.authToken || "";
      const idcName = formData.idc_name || "";
      const authUrl = formData.authUrl || "";
      const netCancelUrl = formData.netCancelUrl || "";
      const MOID = formData.MOID || formData.oid || "";
      const TotPrice = formData.TotPrice || "";
      const goodName = formData.goodName || "";
      const resultMsg = formData.resultMsg || "";

      // 클라이언트로 리다이렉트 (GET 파라미터로 전달)
      // Referer 헤더 또는 Origin 헤더에서 클라이언트 도메인 추출
      const referer = req.headers.get("referer") || req.headers.get("origin") || "";
      let clientOrigin = "https://www.copydrum.com";
      
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          clientOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
        } catch {
          // 파싱 실패 시 기본값 사용
        }
      }
      
      const redirectUrl = new URL("/payments/inicis/return", clientOrigin);
      
      // GET 파라미터로 데이터 전달
      const params = new URLSearchParams();
      if (resultCode) params.set("resultCode", resultCode);
      if (mid) params.set("mid", mid);
      if (authToken) params.set("authToken", authToken);
      if (idcName) params.set("idc_name", idcName);
      if (authUrl) params.set("authUrl", authUrl);
      if (netCancelUrl) params.set("netCancelUrl", netCancelUrl);
      if (MOID) params.set("MOID", MOID);
      if (TotPrice) params.set("TotPrice", TotPrice);
      if (goodName) params.set("goodName", goodName);
      if (resultMsg) params.set("resultMsg", resultMsg);

      redirectUrl.search = params.toString();

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: redirectUrl.toString(),
        },
      });
    }

    // GET 요청 처리 (브라우저가 리다이렉트 후 접근)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const resultCode = url.searchParams.get("resultCode") || "";

      if (resultCode) {
        // 이미 GET 파라미터가 있으면 클라이언트로 리다이렉트
        const referer = req.headers.get("referer") || req.headers.get("origin") || "";
        let clientOrigin = "https://www.copydrum.com";
        
        if (referer) {
          try {
            const refererUrl = new URL(referer);
            clientOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
          } catch {
            // 파싱 실패 시 기본값 사용
          }
        }
        
        const redirectUrl = new URL("/payments/inicis/return", clientOrigin);
        redirectUrl.search = url.search;
        
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            Location: redirectUrl.toString(),
          },
        });
      }

      // 데이터가 없으면 에러 페이지로
      return new Response("No payment data received", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("[inicis-return] Error", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: "결제 반환 처리 중 오류가 발생했습니다.",
          details: error instanceof Error ? error.message : String(error),
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

