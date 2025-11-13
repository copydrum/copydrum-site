import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const normalizeStoragePath = (rawPath: string | null | undefined, bucket: string): string | null => {
  if (!rawPath) {
    return null;
  }

  let path = rawPath.trim();
  if (!path) {
    return null;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const url = new URL(path);
      const segments = url.pathname.split("/").filter(Boolean);
      const bucketIndex = segments.findIndex((segment) => segment === bucket);
      if (bucketIndex >= 0 && bucketIndex < segments.length - 1) {
        path = segments.slice(bucketIndex + 1).join("/");
      } else if (segments.length > 0) {
        path = segments.slice(-1)[0];
      }
    } catch {
      // ignore and fall back to original path
    }
  }

  return path.replace(/^\/+/, "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response("Server configuration error", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const { orderId, orderItemId } = await req.json();
    if (!orderId || !orderItemId) {
      return new Response("Missing parameters", { status: 400, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const { data: row, error: queryError } = await adminClient
      .from("order_items")
      .select(
        `
        id,
        order_id,
        price,
        order:orders!inner (
          id,
          user_id,
          status
        ),
        sheet:drum_sheets!inner (
          id,
          title,
          artist,
          pdf_path,
          pdf_url
        )
      `,
      )
      .eq("id", orderItemId)
      .eq("order_id", orderId)
      .maybeSingle();

    if (queryError || !row) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    if (row.order.user_id !== user.id) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const allowStatuses = new Set(["completed", "payment_confirmed"]);
    const orderStatus = (row.order.status ?? "").toLowerCase();

    if (!allowStatuses.has(orderStatus)) {
      return new Response("Download not allowed for this order status", {
        status: 403,
        headers: corsHeaders,
      });
    }

    const bucket = Deno.env.get("SHEET_PDF_BUCKET") ?? "sheet-pdfs";
    const pdfPath =
      normalizeStoragePath(row.sheet?.pdf_path as string | null, bucket) ??
      normalizeStoragePath(row.sheet?.pdf_url as string | null, bucket);

    if (!pdfPath) {
      return new Response("File path not configured", { status: 404, headers: corsHeaders });
    }

    const { data: signed, error: signedError } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(pdfPath, 60);

    if (signedError || !signed?.signedUrl) {
      return new Response("Failed to sign url", { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ url: signed.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Download function error:", error);
    return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
  }
});



