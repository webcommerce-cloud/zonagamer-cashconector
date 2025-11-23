import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { payload, shop, topic } = await authenticate.webhook(request);
    
    console.log(`Received ${topic} webhook for ${shop}`);
    console.log("Product data:", JSON.stringify(payload, null, 2));
    
    // URL de tu CRM (para pruebas, luego usar variable de entorno)
    const crmUrl = process.env.CRM_WEBHOOK_URL || "https://devplataform.cashcolombia.com/webhook/shopify-gamer";
    
    // Preparar los datos a enviar
    const webhookData = {
      shop: shop,
      event: topic,
      product: payload,
      timestamp: new Date().toISOString()
    };
    
    // Responder a Shopify inmediatamente para evitar timeouts
    // El envío al CRM se hace de forma asíncrona
    sendToCrm(crmUrl, webhookData, shop).catch((error) => {
      console.error(`Error sending to CRM (async):`, error);
    });
    
    // Siempre responder 200 a Shopify para que no marque el webhook como fallido
    return new Response("OK", { status: 200 });
    
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Aún así responder 200 para evitar que Shopify reintente inmediatamente
    // El error ya está logueado
    return new Response("OK", { status: 200 });
  }
};

// Función auxiliar para enviar al CRM de forma asíncrona
async function sendToCrm(crmUrl: string, data: any, shop: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout de 10 segundos
  
  try {
    const response = await fetch(crmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Agrega aquí headers de autenticación si tu CRM los requiere
        // "Authorization": `Bearer ${process.env.CRM_API_KEY}`,
        // "X-Shopify-Shop": shop,
      },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error sending to CRM: ${response.status} - ${errorText}`);
      throw new Error(`CRM returned ${response.status}: ${errorText}`);
    }
    
    console.log(`✅ Successfully sent product update to CRM for shop: ${shop}`);
    
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error(`Timeout sending to CRM for shop: ${shop}`);
      throw new Error('Request timeout');
    }
    throw error;
  }
}

