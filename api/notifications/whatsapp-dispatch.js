/**
 * WhatsApp Dispatch Notification Serverless Function
 * Handles automated background WhatsApp alerts for Devshree Store Owner (+91 88661 30409)
 * 
 * Supports:
 * 1. CallMeBot WhatsApp API (Free automated direct personal notifications)
 * 2. Meta WhatsApp Cloud API (Official Meta Graph API)
 * 3. Custom Webhook Relay (Zapier, Pabbly, Twilio, Make, WATI, etc.)
 */
import { withErrorHandler } from '../_lib/error-handler.js';
import { withRateLimit } from '../_lib/rate-limiter.js';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { event, order, message, phone } = req.body || {};
  const targetPhone = phone || process.env.STORE_OWNER_PHONE || '918866130409';
  const cleanPhone = String(targetPhone).replace(/\D/g, '');

  const dispatchResults = {
    targetPhone: cleanPhone,
    event: event || 'new_order_placed',
    callmebot: null,
    metaCloud: null,
    webhook: null
  };

  // 1. CallMeBot Free API (If configured via CALLMEBOT_API_KEY)
  const callmebotApiKey = process.env.CALLMEBOT_API_KEY || (req.body && req.body.callmebotApiKey);
  if (callmebotApiKey && message) {
    try {
      const callmebotUrl = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(callmebotApiKey)}`;
      const cmbRes = await fetch(callmebotUrl);
      dispatchResults.callmebot = { status: cmbRes.status, ok: cmbRes.ok };
    } catch (cmbErr) {
      dispatchResults.callmebot = { error: cmbErr.message };
    }
  }

  // 2. Meta WhatsApp Cloud API (If configured via WHATSAPP_CLOUD_TOKEN & WHATSAPP_PHONE_ID)
  const cloudToken = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (cloudToken && phoneId && message) {
    try {
      const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: message }
        })
      });
      const metaData = await metaRes.json();
      dispatchResults.metaCloud = { status: metaRes.status, ok: metaRes.ok, data: metaData };
    } catch (metaErr) {
      dispatchResults.metaCloud = { error: metaErr.message };
    }
  }

  // 3. Custom Webhook Relay (If configured via WA_WEBHOOK_URL or req.body.webhookUrl)
  const webhookUrl = process.env.WA_WEBHOOK_URL || (req.body && req.body.webhookUrl);
  if (webhookUrl) {
    try {
      const whRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: event || 'new_order_placed',
          phone: cleanPhone,
          message,
          order,
          timestamp: Date.now()
        })
      });
      dispatchResults.webhook = { status: whRes.status, ok: whRes.ok };
    } catch (whErr) {
      dispatchResults.webhook = { error: whErr.message };
    }
  }

  return res.status(200).json({
    success: true,
    message: `WhatsApp dispatch processed for +${cleanPhone}`,
    results: dispatchResults,
    waLink: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message || '')}`
  });
}

export default withErrorHandler(withRateLimit(handler, 'public'), '/api/notifications/whatsapp-dispatch');
