import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
// URL de destino para reenviar los webhooks
const WEBHOOK_FORWARD_URL = "https://devplataform.cashcolombia.com/webhook/zonagamer-cashconector-webhook";      
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Autenticar el webhook de Shopify
    const { payload, session, topic, shop } = await authenticate.webhook(request);
    console.log(`[Webhook Forward] Received ${topic} webhook for ${shop}`);
    // Preparar los datos a reenviar
    const forwardData = {
      topic,
      shop,
      payload,
      session: session ? {
        id: session.id,
        shop: session.shop,
        isOnline: session.isOnline,
      } : null,
      receivedAt: new Date().toISOString(),
    };
    // Reenviar el webhook a la URL configurada
    const forwardResponse = await fetch(WEBHOOK_FORWARD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Topic": topic,
        "X-Webhook-Shop": shop,
        "X-Webhook-Source": "shopify-app",
      },
      body: JSON.stringify(forwardData),
    });
    if (!forwardResponse.ok) {
      const errorText = await forwardResponse.text().catch(() => "Unknown error");
      console.error(
        `[Webhook Forward] Error forwarding webhook ${topic} to ${WEBHOOK_FORWARD_URL}: ${forwardResponse.status} ${forwardResponse.statusText}`,
        errorText
      );
      return new Response(
        JSON.stringify({
          error: "Failed to forward webhook",
          status: forwardResponse.status,
          statusText: forwardResponse.statusText
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const forwardResponseData = await forwardResponse.json().catch(() => null);
    console.log(`[Webhook Forward] ✓ Webhook ${topic} from ${shop} forwarded successfully`);
    // Retornar respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        topic,
        shop,
        forwarded: true,
        forwardResponse: forwardResponseData
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("[Webhook Forward] Error processing webhook:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

