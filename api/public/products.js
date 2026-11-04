/**
 * Public Endpoint: /api/public/products
 * Protected by:
 * 1. Strict Schema Validation (Type, Length, Format) - rejects non-conforming query parameters.
 * 2. Moderate Sliding Window Rate Limiting (default 60 req/min per IP, configurable).
 */
import { withRateLimit } from '../_lib/rate-limiter.js';
import { withStrictSchema, ProductsQuerySchema } from '../_lib/schema-validator.js';
import { withErrorHandler } from '../_lib/error-handler.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Pre-validated by ProductsQuerySchema
  const { category, search, limit = 20, page = 1 } = req.validatedQuery || req.query || {};

  // Sample catalog response
  const products = [
    { id: 'dev-001', name: 'Devshree Heavy Duty 20V Cordless Brushless Drill', category: 'Power Tools', price: 4299, rating: 4.8 },
    { id: 'dev-002', name: 'Devshree Precision Hand Tool Master Kit (45 Pcs)', category: 'Hand Tools', price: 1899, rating: 4.9 },
    { id: 'dev-003', name: 'Devshree SS 304 Architectural Mortise Handle Lock', category: 'Hardware', price: 1250, rating: 4.7 },
    { id: 'dev-004', name: 'Devshree Industrial Digital Vernier Caliper 150mm', category: 'Measuring Tools', price: 899, rating: 4.6 }
  ];

  let filtered = products;
  if (category) {
    filtered = filtered.filter(p => p.category.toLowerCase().includes(String(category).toLowerCase()));
  }
  if (search) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(String(search).toLowerCase()));
  }

  return res.status(200).json({
    success: true,
    total: filtered.length,
    page: Number(page),
    limit: Number(limit),
    data: filtered
  });
}

export default withErrorHandler(
  withRateLimit(withStrictSchema(handler, { query: ProductsQuerySchema }), 'public'),
  '/api/public/products'
);
