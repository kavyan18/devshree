/**
 * DEVSHREE — STRICT INPUT SCHEMA VALIDATOR
 * 
 * Enforces strict type, length, boundary, format, and property validation.
 * Rejects any non-conforming payload with 400 Bad Request.
 * Does NOT silently sanitize, truncate, or escape invalid input.
 */

// 1. Strict Regular Expression Formats
export const FORMAT_PATTERNS = {
  // RFC 5322 compliant email format, rejects angle brackets, control characters, or unquoted spaces
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/,
  
  // Indian 10-digit mobile number, optional +91 prefix
  indianPhone: /^(?:\+91[\-\s]?)?[6-9]\d{9}$/,

  // Standard International / E.164 phone format (10-15 digits)
  phone: /^\+?[1-9]\d{9,14}$/,

  // Indian Postal PIN Code (exactly 6 digits, 100000 - 999999)
  pincode: /^[1-9]\d{5}$/,

  // Indian GST Identification Number (15 alphanumeric characters)
  gstin: /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,

  // Person / Contractor Name (letters, spaces, periods, hyphens, apostrophes)
  personName: /^[a-zA-Z\s.'-]+$/,

  // Alphanumeric identifier or slug (letters, numbers, hyphens, underscores)
  slug: /^[a-zA-Z0-9_-]+$/,

  // Strict numeric string
  numericString: /^\d+$/,

  // Password complexity: minimum 6 chars, at least one letter and at least one number
  password: /^(?=.*[A-Za-z])(?=.*\d).{6,128}$/,

  // Safe text: rejects raw HTML/script tags or event handlers
  noHtmlTags: /^[^<>]*$/
};

/**
 * Custom ValidationError class with status code 400 and structured error details
 */
export class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errors = errors;
  }
}

/**
 * 2. Core Validation Engine
 * Validates any value against a strict schema object.
 * 
 * @param {Object} schema - Schema specification
 * @param {*} value - The input value to validate
 * @param {string} [path=''] - Current field path for error reporting
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string, constraint: string, received: any }> }}
 */
export function validateValue(schema, value, path = '') {
  const errors = [];
  const fieldName = path || schema.name || 'payload';

  // 1. Presence & Required Check
  const isMissing = (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''));
  if (schema.required) {
    if (isMissing) {
      errors.push({
        field: fieldName,
        constraint: 'required',
        message: `Field '${fieldName}' is required and cannot be empty.`,
        received: value
      });
      return { valid: false, errors };
    }
  } else if (isMissing) {
    // Optional field and value is absent -> valid
    return { valid: true, errors: [] };
  }

  // 2. Exact Type Checking
  const expectedType = schema.type;
  if (expectedType) {
    let typeMatches = false;
    const actualType = typeof value;

    if (expectedType === 'string') {
      typeMatches = (actualType === 'string');
    } else if (expectedType === 'number') {
      typeMatches = (actualType === 'number' && !isNaN(value) && isFinite(value));
    } else if (expectedType === 'integer') {
      typeMatches = (actualType === 'number' && Number.isInteger(value));
    } else if (expectedType === 'boolean') {
      typeMatches = (actualType === 'boolean');
    } else if (expectedType === 'array') {
      typeMatches = Array.isArray(value);
    } else if (expectedType === 'object') {
      typeMatches = (actualType === 'object' && value !== null && !Array.isArray(value));
    }

    if (!typeMatches) {
      errors.push({
        field: fieldName,
        constraint: 'type',
        message: `Field '${fieldName}' must be of type '${expectedType}', received '${Array.isArray(value) ? 'array' : actualType}'.`,
        received: value
      });
      return { valid: false, errors }; // Cannot perform further checks if type doesn't match
    }
  }

  // 3. String Specific Checks (Length, Pattern, Format, Enum)
  if (typeof value === 'string') {
    const len = value.length;

    if (schema.minLength !== undefined && len < schema.minLength) {
      errors.push({
        field: fieldName,
        constraint: 'minLength',
        message: `Field '${fieldName}' length (${len}) must be at least ${schema.minLength} characters.`,
        received: value
      });
    }

    if (schema.maxLength !== undefined && len > schema.maxLength) {
      errors.push({
        field: fieldName,
        constraint: 'maxLength',
        message: `Field '${fieldName}' length (${len}) cannot exceed ${schema.maxLength} characters.`,
        received: value
      });
    }

    // Explicit format checks
    if (schema.format) {
      const format = schema.format;
      if (format === 'email') {
        if (len < 3 || len > 100 || !FORMAT_PATTERNS.email.test(value)) {
          errors.push({
            field: fieldName,
            constraint: 'format:email',
            message: `Field '${fieldName}' must be a valid email address (e.g. name@domain.com).`,
            received: value
          });
        }
      } else if (format === 'phone') {
        const cleanDigits = value.replace(/[\s\-\+]/g, '');
        if (cleanDigits.length < 10 || cleanDigits.length > 15 || !(FORMAT_PATTERNS.indianPhone.test(value) || FORMAT_PATTERNS.phone.test(value))) {
          errors.push({
            field: fieldName,
            constraint: 'format:phone',
            message: `Field '${fieldName}' must be a valid mobile phone number (10 to 15 digits).`,
            received: value
          });
        }
      } else if (format === 'pincode') {
        if (!FORMAT_PATTERNS.pincode.test(value)) {
          errors.push({
            field: fieldName,
            constraint: 'format:pincode',
            message: `Field '${fieldName}' must be a valid 6-digit Indian postal PIN code (e.g. 380015).`,
            received: value
          });
        }
      } else if (format === 'gstin') {
        if (!FORMAT_PATTERNS.gstin.test(value.toUpperCase())) {
          errors.push({
            field: fieldName,
            constraint: 'format:gstin',
            message: `Field '${fieldName}' must be a valid 15-character Indian GSTIN format.`,
            received: value
          });
        }
      } else if (format === 'personName') {
        if (!FORMAT_PATTERNS.personName.test(value)) {
          errors.push({
            field: fieldName,
            constraint: 'format:personName',
            message: `Field '${fieldName}' can only contain alphabetical letters, spaces, hyphens, and periods.`,
            received: value
          });
        }
      } else if (format === 'password') {
        if (len < 6 || len > 128) {
          errors.push({
            field: fieldName,
            constraint: 'format:password:length',
            message: `Password must be between 6 and 128 characters long.`,
            received: '***'
          });
        }
      } else if (format === 'safeText') {
        if (!FORMAT_PATTERNS.noHtmlTags.test(value)) {
          errors.push({
            field: fieldName,
            constraint: 'format:safeText',
            message: `Field '${fieldName}' cannot contain HTML or script markup tags.`,
            received: value
          });
        }
      } else if (format === 'url') {
        try {
          const u = new URL(value);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            throw new Error('Invalid protocol');
          }
        } catch (_) {
          errors.push({
            field: fieldName,
            constraint: 'format:url',
            message: `Field '${fieldName}' must be a valid HTTP or HTTPS URL.`,
            received: value
          });
        }
      }
    }

    // Pattern (custom regex)
    if (schema.pattern) {
      const rx = schema.pattern instanceof RegExp ? schema.pattern : new RegExp(schema.pattern);
      if (!rx.test(value)) {
        errors.push({
          field: fieldName,
          constraint: 'pattern',
          message: schema.patternMessage || `Field '${fieldName}' format is invalid.`,
          received: value
        });
      }
    }

    // Enum
    if (schema.enum && Array.isArray(schema.enum)) {
      if (!schema.enum.includes(value)) {
        errors.push({
          field: fieldName,
          constraint: 'enum',
          message: `Field '${fieldName}' must be one of: [${schema.enum.map(e => `'${e}'`).join(', ')}].`,
          received: value
        });
      }
    }
  }

  // 4. Number / Integer Checks (Min, Max, Enum)
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        field: fieldName,
        constraint: 'minimum',
        message: `Field '${fieldName}' (${value}) cannot be less than ${schema.minimum}.`,
        received: value
      });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        field: fieldName,
        constraint: 'maximum',
        message: `Field '${fieldName}' (${value}) cannot be greater than ${schema.maximum}.`,
        received: value
      });
    }

    if (schema.enum && Array.isArray(schema.enum)) {
      if (!schema.enum.includes(value)) {
        errors.push({
          field: fieldName,
          constraint: 'enum',
          message: `Field '${fieldName}' must be one of: [${schema.enum.join(', ')}].`,
          received: value
        });
      }
    }
  }

  // 5. Array Specific Checks (minItems, maxItems, items schema)
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        field: fieldName,
        constraint: 'minItems',
        message: `Array '${fieldName}' must contain at least ${schema.minItems} item(s).`,
        received: value.length
      });
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        field: fieldName,
        constraint: 'maxItems',
        message: `Array '${fieldName}' cannot contain more than ${schema.maxItems} item(s).`,
        received: value.length
      });
    }

    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const itemRes = validateValue(schema.items, value[i], `${fieldName}[${i}]`);
        if (!itemRes.valid) {
          errors.push(...itemRes.errors);
        }
      }
    }
  }

  // 6. Object Specific Checks (properties, additionalProperties: false)
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const definedProps = schema.properties || {};
    const allowAdditional = schema.additionalProperties === true;
    const valueKeys = Object.keys(value);

    // Reject unrecognized extra fields if additionalProperties is not explicitly allowed
    if (!allowAdditional) {
      for (const k of valueKeys) {
        if (!definedProps[k]) {
          errors.push({
            field: path ? `${path}.${k}` : k,
            constraint: 'additionalProperties',
            message: `Unexpected field '${path ? `${path}.${k}` : k}' is not permitted in this schema.`,
            received: value[k]
          });
        }
      }
    }

    // Validate each defined property
    for (const [propName, propSchema] of Object.entries(definedProps)) {
      const propPath = path ? `${path}.${propName}` : propName;
      const propValue = value[propName];
      const propRes = validateValue(propSchema, propValue, propPath);
      if (!propRes.valid) {
        errors.push(...propRes.errors);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Top-level validation function. Throws a ValidationError if invalid.
 * @param {Object} schema
 * @param {*} data
 * @returns {*} data (if valid)
 * @throws {ValidationError}
 */
export function validateOrReject(schema, data, label = 'Request body') {
  const result = validateValue(schema, data);
  if (!result.valid) {
    const firstErr = result.errors[0]?.message || 'Input validation failed.';
    throw new ValidationError(`${label} rejected: ${firstErr}`, result.errors);
  }
  return data;
}

/**
 * 3. PREDEFINED STRICT SCHEMAS FOR ALL APP ENDPOINTS
 */

// A. Auth: Login Schema
export const LoginSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 100,
      format: 'email'
    },
    password: {
      type: 'string',
      required: true,
      minLength: 6,
      maxLength: 128
    }
  }
};

// B. Auth: Signup Schema
export const SignupSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 80,
      format: 'personName'
    },
    email: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 100,
      format: 'email'
    },
    phone: {
      type: 'string',
      required: false,
      minLength: 10,
      maxLength: 15,
      format: 'phone'
    },
    password: {
      type: 'string',
      required: true,
      minLength: 6,
      maxLength: 128,
      format: 'password'
    }
  }
};

// C. Auth: Password Reset Schema
export const PasswordResetSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 100,
      format: 'email'
    }
  }
};

// D. Public: Products Catalog Query Schema
export const ProductsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    category: {
      type: 'string',
      required: false,
      minLength: 1,
      maxLength: 60,
      format: 'safeText'
    },
    search: {
      type: 'string',
      required: false,
      minLength: 1,
      maxLength: 100,
      format: 'safeText'
    },
    page: {
      type: 'integer',
      required: false,
      minimum: 1,
      maximum: 10000
    },
    limit: {
      type: 'integer',
      required: false,
      minimum: 1,
      maximum: 100
    }
  }
};

// E. Checkout / User: Single Order Item Schema
export const OrderItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 64,
      pattern: FORMAT_PATTERNS.slug
    },
    name: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 150,
      format: 'safeText'
    },
    price: {
      type: 'number',
      required: true,
      minimum: 0.01,
      maximum: 1000000
    },
    quantity: {
      type: 'integer',
      required: true,
      minimum: 1,
      maximum: 999
    },
    brand: {
      type: 'string',
      required: false,
      minLength: 1,
      maxLength: 60,
      format: 'safeText'
    }
  }
};

// F. Checkout / User: Delivery Address Schema
export const DeliveryAddressSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 80,
      format: 'personName'
    },
    phone: {
      type: 'string',
      required: true,
      minLength: 10,
      maxLength: 15,
      format: 'phone'
    },
    pincode: {
      type: 'string',
      required: true,
      minLength: 6,
      maxLength: 6,
      format: 'pincode'
    },
    city: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 60,
      format: 'safeText'
    },
    state: {
      type: 'string',
      required: false,
      minLength: 2,
      maxLength: 60,
      format: 'safeText'
    },
    address: {
      type: 'string',
      required: true,
      minLength: 5,
      maxLength: 250,
      format: 'safeText'
    },
    landmark: {
      type: 'string',
      required: false,
      minLength: 0,
      maxLength: 100,
      format: 'safeText'
    },
    gstin: {
      type: 'string',
      required: false,
      minLength: 15,
      maxLength: 15,
      format: 'gstin'
    },
    notes: {
      type: 'string',
      required: false,
      minLength: 0,
      maxLength: 500,
      format: 'safeText'
    }
  }
};

// G. Authenticated: Create Order Schema
export const CreateOrderSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      required: true,
      minItems: 1,
      maxItems: 50,
      items: OrderItemSchema
    },
    shippingAddress: {
      type: 'object',
      required: true,
      properties: DeliveryAddressSchema.properties,
      additionalProperties: false
    },
    paymentMethod: {
      type: 'string',
      required: true,
      enum: ['COD', 'Online UPI / QR', 'UPI', 'Card', 'Net Banking']
    }
  }
};

// H. General: Contact Inquiry Schema
export const ContactInquirySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 80,
      format: 'personName'
    },
    phone: {
      type: 'string',
      required: true,
      minLength: 10,
      maxLength: 15,
      format: 'phone'
    },
    email: {
      type: 'string',
      required: false,
      minLength: 3,
      maxLength: 100,
      format: 'email'
    },
    category: {
      type: 'string',
      required: false,
      minLength: 1,
      maxLength: 60,
      format: 'safeText'
    },
    message: {
      type: 'string',
      required: true,
      minLength: 5,
      maxLength: 1500,
      format: 'safeText'
    }
  }
};

// I. General: Newsletter Subscription Schema
export const NewsletterSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 100,
      format: 'email'
    }
  }
};

// J. Customer Feedback & Review Submission Schema
export const CustomerFeedbackSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    productId: {
      type: 'string',
      required: false,
      maxLength: 60,
      format: 'safeText'
    },
    name: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 80,
      format: 'personName'
    },
    role: {
      type: 'string',
      required: false,
      maxLength: 80,
      format: 'safeText'
    },
    stars: {
      type: 'integer',
      required: true,
      minimum: 1,
      maximum: 5
    },
    invoiceNumber: {
      type: 'string',
      required: false,
      maxLength: 50,
      format: 'safeText'
    },
    category: {
      type: 'string',
      required: false,
      maxLength: 60,
      format: 'safeText'
    },
    comment: {
      type: 'string',
      required: true,
      minLength: 5,
      maxLength: 600,
      format: 'safeText'
    },
    recommend: {
      type: 'boolean',
      required: false
    }
  }
};

/**
 * 4. VERCEL SERVERLESS VALIDATION WRAPPER
 * Wraps any Vercel serverless function and enforces strict schema validation on body, query, or headers.
 * Rejects non-conforming requests with HTTP 400 Bad Request.
 * 
 * @param {Function} handler
 * @param {{ body?: Object, query?: Object }} schemas
 */
export function withStrictSchema(handler, schemas = {}) {
  return async (req, res) => {
    // 1. Validate Query Parameters if query schema provided
    if (schemas.query) {
      const queryData = { ...(req.query || {}) };
      // Parse integers if integer type specified in schema
      for (const [k, s] of Object.entries(schemas.query.properties || {})) {
        if (s.type === 'integer' && queryData[k] !== undefined && queryData[k] !== '') {
          const parsed = Number(queryData[k]);
          if (Number.isInteger(parsed)) {
            queryData[k] = parsed;
          }
        } else if (s.type === 'number' && queryData[k] !== undefined && queryData[k] !== '') {
          const parsed = Number(queryData[k]);
          if (!isNaN(parsed)) {
            queryData[k] = parsed;
          }
        }
      }

      const queryValidation = validateValue(schemas.query, queryData, 'query');
      if (!queryValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request: Query Validation Failed',
          message: 'One or more query parameters do not meet strict schema requirements.',
          details: queryValidation.errors
        });
      }
      req.validatedQuery = queryData;
    }

    // 2. Validate Body if body schema provided
    if (schemas.body) {
      let bodyData = req.body;
      if (typeof bodyData === 'string') {
        try {
          bodyData = JSON.parse(bodyData);
        } catch (_) {
          return res.status(400).json({
            success: false,
            error: 'Bad Request: Malformed JSON',
            message: 'Request body must be valid JSON matching the schema.',
            details: [{ field: 'body', constraint: 'json', message: 'Invalid JSON payload.' }]
          });
        }
      }

      bodyData = bodyData || {};
      const bodyValidation = validateValue(schemas.body, bodyData, 'body');
      if (!bodyValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request: Schema Validation Failed',
          message: 'Payload does not meet strict schema requirements. Rejected.',
          details: bodyValidation.errors
        });
      }
      req.validatedBody = bodyData;
    }

    return handler(req, res);
  };
}

/**
 * 5. EXPRESS / CONNECT MIDDLEWARE GENERATOR
 * @param {{ body?: Object, query?: Object }} schemas
 */
export function schemaValidationMiddleware(schemas = {}) {
  return (req, res, next) => {
    if (schemas.query) {
      const qVal = validateValue(schemas.query, req.query || {}, 'query');
      if (!qVal.valid) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request: Query Validation Failed',
          details: qVal.errors
        });
      }
    }

    if (schemas.body) {
      const bVal = validateValue(schemas.body, req.body || {}, 'body');
      if (!bVal.valid) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request: Body Validation Failed',
          details: bVal.errors
        });
      }
    }

    if (next) next();
  };
}

