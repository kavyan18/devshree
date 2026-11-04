/**
 * Authenticated Endpoint: /api/user/orders
 * Protected by:
 * 1. Strict Schema Validation (Type, Length, Format) - rejects non-conforming order items, addresses, or methods.
 * 2. Looser Sliding Window Rate Limiting (default 240 req/min per user, configurable).
 */
import { withRateLimit } from '../_lib/rate-limiter.js';
import { withStrictSchema, CreateOrderSchema } from '../_lib/schema-validator.js';
import { withErrorHandler } from '../_lib/error-handler.js';

async function handler(req, res) {
  const userId = req.headers['x-user-id'] || 'guest-user';

  if (req.method === 'GET') {
    // Return orders for authenticated user
    return res.status(200).json({
      success: true,
      userId,
      orders: [
        {
          id: 'ord-101',
          invoiceNumber: 'INV-DEV-2026-5572',
          date: '2026-11-04',
          total: 6198,
          status: 'Confirmed',
          items: 2
        }
      ]
    });
  }

  if (req.method === 'POST') {
    // Pre-validated by CreateOrderSchema (strictly checks items, address, payment method)
    const { items, shippingAddress, paymentMethod } = req.validatedBody || req.body || {};

    const newOrder = {
      id: `ord-${Date.now()}`,
      invoiceNumber: `INV-DEV-${Date.now()}`,
      userId,
      items,
      shippingAddress,
      paymentMethod,
      status: 'Confirmed',
      createdAt: new Date().toISOString()
    };

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: newOrder
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

// For POST requests, enforce CreateOrderSchema
const schemaCheckedHandler = async (req, res) => {
  if (req.method === 'POST') {
    return withStrictSchema(handler, { body: CreateOrderSchema })(req, res);
  }
  return handler(req, res);
};

export default withErrorHandler(
  withRateLimit(schemaCheckedHandler, 'authenticated'),
  '/api/user/orders'
);
