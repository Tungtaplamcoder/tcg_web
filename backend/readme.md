Acknowledged. I will follow the strict formatting and execution rules exactly: one step per response, clean code blocks with file path headers, zero placeholders, and wait for "Next" before proceeding.

---

### File: backend/README.md

```markdown
# Trading Card Game E-commerce Backend

Production-ready Node.js backend for a TCG e-commerce platform.

## Tech Stack

- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js
- **Database:** PostgreSQL 16
- **ORM:** Prisma
- **Real-time:** Socket.io
- **Payments:** SePay Payment Gateway
- **Auth:** JWT (Access + Refresh tokens)
- **Validation:** Zod
- **Scheduling:** node-cron

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Environment Variables](#environment-variables)
3. [Authentication & Authorization](#authentication--authorization)
4. [API Response Standards](#api-response-standards)
5. [Frontend API Integration Guide](#frontend-api-integration-guide)
   - [Auth Endpoints](#auth-endpoints)
   - [Product & Inventory Endpoints](#product--inventory-endpoints)
   - [Order & Checkout Endpoints](#order--checkout-endpoints)
   - [Admin Endpoints](#admin-endpoints)
   - [Chat Endpoints](#chat-endpoints)
6. [SePay Payment Integration](#sepay-payment-integration)
   - [Redirect Flow](#redirect-flow)
   - [Webhook Flow](#webhook-flow)
   - [Idempotency & Reconciliation](#idempotency--reconciliation)
7. [Socket.io Live Chat Events](#socketio-live-chat-events)
8. [Error Handling & Rate Limiting](#error-handling--rate-limiting)
9. [Security Best Practices](#security-best-practices)

---

## Getting Started

```bash
cd backend
npm install
npx prisma migrate deploy
npm run seed # optional, creates admin user and sample data
npm run dev
```

Production:

```bash
npm run build
npm start
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill all values.

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | `development` or `production` | `development` |
| `PORT` | Backend port | `4000` |
| `DATABASE_URL` | PostgreSQL Prisma connection string | `postgresql://user:pass@localhost:5432/tcg_db?schema=public` |
| `JWT_ACCESS_SECRET` | Secret for access tokens | `change_me_access` |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | `change_me_refresh` |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |
| `SEPAY_API_URL` | SePay base URL | `https://my.sepay.vn` |
| `SEPAY_WEBHOOK_SECRET` | Secret used to verify SePay webhook signature | `sepay_webhook_secret` |
| `SEPAY_ACCOUNT_NUMBER` | Merchant bank account number | `123456789` |
| `SEPAY_ACCOUNT_NAME` | Merchant bank account name | `TCG COMPANY` |
| `FRONTEND_URL` | CORS allowed origin | `http://localhost:3000` |
| `REDIS_URL` | Optional Redis for Socket.io adapter | `redis://localhost:6379` |
| `SMTP_HOST` | Email host for notifications | `smtp.gmail.com` |
| `SMTP_PORT` | Email port | `587` |
| `SMTP_USER` | Email username | `noreply@tcg.com` |
| `SMTP_PASS` | Email password | `email_pass` |
| `ADMIN_EMAIL` | Initial admin email | `admin@tcg.com` |
| `ADMIN_PASSWORD` | Initial admin password | `Admin@123` |

---

## Authentication & Authorization

- **JWT Access Token:** Short-lived (15 min). Sent as `Authorization: Bearer <token>`.
- **Refresh Token:** Long-lived (7 days). Stored in HTTP-only cookie (`refreshToken`) or returned in body for mobile.
- **Roles:** `CUSTOMER`, `ADMIN`, `MODERATOR`.
- **RBAC Middleware:** Checks `role` claim in JWT.

**Refresh flow:**
1. Client calls `POST /api/v1/auth/refresh-token` with refresh token.
2. Server rotates refresh token and returns new access + refresh tokens.
3. Old refresh token is invalidated immediately.

---

## API Response Standards

All endpoints return JSON.

**Success:**

```json
{
  "success": true,
  "data": { },
  "message": "Operation successful",
  "timestamp": "2026-08-17T10:00:00.000Z"
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email" }
    ]
  },
  "timestamp": "2026-08-17T10:00:00.000Z"
}
```

**Pagination:**

`GET /api/v1/products?page=1&limit=20&search=charizard&category=Pokemon&sortBy=price&order=desc`

Response data includes:

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 100,
    "totalPages": 5
  }
}
```

---

## Frontend API Integration Guide

Base URL: `/api/v1`

### Auth Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Register new customer | Public |
| POST | `/auth/login` | Login with email/password | Public |
| POST | `/auth/refresh-token` | Refresh access token | Public (requires refresh token) |
| POST | `/auth/logout` | Logout and revoke refresh token | User |
| GET | `/auth/me` | Get current user profile | User |
| PATCH | `/auth/me` | Update profile | User |
| POST | `/auth/change-password` | Change password | User |
| POST | `/auth/forgot-password` | Request password reset | Public |
| POST | `/auth/reset-password` | Reset password with token | Public |

**Register**

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "Secure@123",
  "fullName": "John Doe",
  "phone": "+84912345678",
  "address": "123 Main St, Hanoi"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "customer@example.com",
      "fullName": "John Doe",
      "role": "CUSTOMER",
      "avatarUrl": null
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Login**

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "Secure@123"
}
```

Response `200`: Same structure as register.

---

### Product & Inventory Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/products` | List products with filters, pagination | Public |
| GET | `/products/:id` | Get product details | Public |
| GET | `/products/:id/stock` | Get real-time stock quantity | Public |
| GET | `/categories` | List all categories | Public |
| GET | `/cards` | List all individual card items (inventory) | Public |
| GET | `/cards/:id` | Get card item details | Public |
| GET | `/sets` | List all card sets | Public |

**List Products**

`GET /api/v1/products?page=1&limit=20&category=Pokemon&search=Pikachu&minPrice=10&maxPrice=100&inStock=true`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Pikachu VMAX",
        "slug": "pikachu-vmax",
        "description": "Rare card",
        "category": "Pokemon",
        "setName": "Vivid Voltage",
        "cardNumber": "044/185",
        "rarity": "ULTRA_RARE",
        "price": 49.99,
        "stockQuantity": 12,
        "images": ["https://cdn.tcg.com/pikachu-vmax.jpg"],
        "createdAt": "2026-08-17T10:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

**Get Product Details**

`GET /api/v1/products/:id`

Response includes:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Pikachu VMAX",
    "slug": "pikachu-vmax",
    "description": "Detailed description",
    "category": "Pokemon",
    "setName": "Vivid Voltage",
    "cardNumber": "044/185",
    "rarity": "ULTRA_RARE",
    "condition": "NEAR_MINT",
    "price": 49.99,
    "stockQuantity": 12,
    "images": ["https://cdn.tcg.com/pikachu-vmax.jpg"],
    "attributes": {
      "holo": true,
      "firstEdition": false
    },
    "cards": [
      {
        "id": "card-uuid",
        "sku": "TCG-POK-001",
        "condition": "NEAR_MINT",
        "status": "AVAILABLE"
      }
    ],
    "createdAt": "2026-08-17T10:00:00.000Z"
  }
}
```

**Get Real-time Stock**

`GET /api/v1/products/:id/stock`

Response:

```json
{
  "success": true,
  "data": {
    "productId": "uuid",
    "stockQuantity": 12,
    "availableStock": 10,
    "reservedStock": 2
  }
}
```

---

### Order & Checkout Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/orders/checkout` | Create order and get SePay payment URL | User |
| GET | `/orders` | List user's orders | User |
| GET | `/orders/:id` | Get order details | User |
| POST | `/orders/:id/cancel` | Cancel pending order | User |
| POST | `/orders/:id/pay` | Regenerate payment URL if still pending | User |
| GET | `/orders/:id/payment-status` | Poll payment status | User |

**Checkout**

```http
POST /api/v1/orders/checkout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2
    },
    {
      "cardId": "uuid",
      "quantity": 1
    }
  ],
  "shippingAddress": {
    "fullName": "John Doe",
    "phone": "+84912345678",
    "addressLine1": "123 Main St",
    "city": "Hanoi",
    "state": "Hanoi",
    "country": "Vietnam",
    "zipCode": "100000"
  },
  "paymentMethod": "SEPAY"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "order": {
      "id": "uuid",
      "orderCode": "TCG-20260817-ABCDEF",
      "status": "PENDING",
      "totalAmount": 99.98,
      "shippingFee": 2.00,
      "grandTotal": 101.98,
      "createdAt": "2026-08-17T10:00:00.000Z",
      "expiresAt": "2026-08-17T10:30:00.000Z"
    },
    "payment": {
      "paymentUrl": "https://my.sepay.vn/pay?code=SEPAY_ORDER_CODE",
      "qrCodeUrl": "https://my.sepay.vn/qr/SEPAY_ORDER_CODE.png",
      "accountNumber": "123456789",
      "accountName": "TCG COMPANY",
      "amount": 101.98,
      "transferContent": "TCG-20260817-ABCDEF"
    }
  }
}
```

**Important:** The `transferContent` must be used by the customer when making the bank transfer. The system matches incoming SePay transfers using this unique content.

**List Orders**

`GET /api/v1/orders?page=1&limit=10&status=PENDING`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "orderCode": "TCG-20260817-ABCDEF",
        "status": "PENDING",
        "totalAmount": 99.98,
        "grandTotal": 101.98,
        "createdAt": "2026-08-17T10:00:00.000Z",
        "expiresAt": "2026-08-17T10:30:00.000Z",
        "items": [
          {
            "productId": "uuid",
            "productName": "Pikachu VMAX",
            "quantity": 2,
            "unitPrice": 49.99
          }
        ]
      }
    ],
    "meta": { "page": 1, "limit": 10, "totalItems": 5, "totalPages": 1 }
  }
}
```

**Cancel Order**

`POST /api/v1/orders/:id/cancel`

Only orders with status `PENDING` can be cancelled. Response `200` returns updated order.

**Regenerate Payment URL**

`POST /api/v1/orders/:id/pay`

Only if order is `PENDING` and not expired. Returns same payment object as checkout.

---

### Admin Endpoints

All admin endpoints require `Authorization: Bearer <admin_access_token>` and role `ADMIN` or `MODERATOR` (as specified).

| Method | Endpoint | Description | Role |
|---|---|---|---|
| GET | `/admin/users` | List all users | ADMIN |
| PATCH | `/admin/users/:id/role` | Change user role | ADMIN |
| PATCH | `/admin/users/:id/status` | Ban/unban user | ADMIN |
| GET | `/admin/products` | List products | ADMIN, MODERATOR |
| POST | `/admin/products` | Create product | ADMIN, MODERATOR |
| PATCH | `/admin/products/:id` | Update product | ADMIN, MODERATOR |
| DELETE | `/admin/products/:id` | Soft delete product | ADMIN |
| POST | `/admin/products/:id/cards` | Add inventory cards | ADMIN, MODERATOR |
| PATCH | `/admin/cards/:id` | Update card item | ADMIN, MODERATOR |
| GET | `/admin/orders` | List all orders | ADMIN, MODERATOR |
| PATCH | `/admin/orders/:id/status` | Update order status | ADMIN |
| GET | `/admin/payments/logs` | List payment logs | ADMIN |
| POST | `/admin/payments/reconcile` | Manually reconcile payment | ADMIN |
| GET | `/admin/dashboard/stats` | Dashboard stats | ADMIN, MODERATOR |
| GET | `/admin/chat/rooms` | List all chat rooms | ADMIN, MODERATOR |
| GET | `/admin/chat/rooms/:id/messages` | Get messages for a room | ADMIN, MODERATOR |

**Dashboard Stats**

`GET /api/v1/admin/dashboard/stats`

Response:

```json
{
  "success": true,
  "data": {
    "totalRevenue": 15000.00,
    "totalOrders": 320,
    "totalCustomers": 120,
    "totalProducts": 45,
    "totalStock": 800,
    "pendingOrders": 5,
    "completedOrders": 300,
    "cancelledOrders": 15,
    "recentOrders": [
      {
        "id": "uuid",
        "orderCode": "TCG-20260817-ABCDEF",
        "customer": "john@example.com",
        "grandTotal": 101.98,
        "status": "COMPLETED",
        "createdAt": "2026-08-17T10:00:00.000Z"
      }
    ],
    "revenueByDay": [
      { "date": "2026-08-17", "revenue": 500.00 },
      { "date": "2026-08-16", "revenue": 450.00 }
    ]
  }
}
```

**Reconcile Payment**

`POST /api/v1/admin/payments/reconcile`

```json
{
  "paymentLogId": "uuid",
  "action": "MARK_AS_COMPLETED",
  "note": "Manual verification completed"
}
```

---

### Chat Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/chat/rooms` | Get user's chat rooms | User |
| POST | `/chat/rooms` | Create a support chat room | User |
| GET | `/chat/rooms/:id/messages` | Get messages in a room | User (participant) or Admin |
| POST | `/chat/rooms/:id/messages` | Send message via REST (fallback) | User (participant) or Admin |

**Create Chat Room**

```http
POST /api/v1/chat/rooms
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "subject": "Order issue",
  "orderId": "uuid (optional)"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "room": {
      "id": "uuid",
      "subject": "Order issue",
      "orderId": "uuid",
      "status": "OPEN",
      "createdAt": "2026-08-17T10:00:00.000Z"
    }
  }
}
```

---

## SePay Payment Integration

### Redirect Flow

1. **Customer initiates checkout** via `POST /api/v1/orders/checkout`.
2. Backend creates an `Order` with status `PENDING`, generates unique `orderCode` (e.g., `TCG-YYYYMMDD-XXXXXXXX`), and stores payment intent.
3. Backend returns `paymentUrl` and `qrCodeUrl` from SePay. Frontend redirects user to `paymentUrl` or shows QR code for bank transfer.
4. Customer completes bank transfer using the provided `accountNumber`, `accountName`, `amount`, and **transferContent** (must exactly match `orderCode`).
5. SePay processes the transfer and sends a webhook to our backend.
6. Backend matches the transfer content to an order, marks order as `PAID`, deducts inventory, and emits socket event `order:paid` to the user.
7. Frontend polls `GET /api/v1/orders/:id/payment-status` or listens to socket event to detect successful payment.

**SePay Payment URL format:**

`https://my.sepay.vn/pay?code=<SEPAY_ORDER_CODE>`

The `code` is generated by our backend and sent to SePay when creating the payment request. In our system, we use the `orderCode` as the SePay payment code.

### Webhook Flow

**Endpoint:** `POST /api/v1/webhooks/sepay`

**Headers:**
- `Content-Type: application/json`
- `X-SePay-Signature`: HMAC SHA256 signature of the raw JSON body using `SEPAY_WEBHOOK_SECRET`.

**Webhook Payload (from SePay):**

```json
{
  "id": "sepay_transaction_id",
  "account_number": "123456789",
  "account_name": "TCG COMPANY",
  "amount": 101.98,
  "content": "TCG-20260817-ABCDEF",
  "transaction_date": "2026-08-17T10:05:00.000Z",
  "reference_code": "BANK_REFERENCE",
  "transfer_type": "in",
  "balance_after": 1000.00
}
```

**Backend Processing:**

1. Verify webhook signature using HMAC SHA256. If invalid, log to `PaymentLog` with status `SIGNATURE_MISMATCH` and return `200` (to prevent SePay retries but flag for manual review).
2. Parse payload safely. If any required field missing, log to `PaymentLog` with status `INVALID_PAYLOAD` and return `200`.
3. Check idempotency: Look for existing `PaymentLog` with `sepayTransactionId`. If exists and already processed, return `200` without side effects.
4. Extract `content` and try to match to an `Order` by `orderCode` in `PENDING` status.
5. If order not found or amount mismatch, log to `PaymentLog` with status `MISMATCH` and return `200`. Admin must manually reconcile.
6. If matched and amount correct:
   - Use Prisma `$transaction` to:
     - Lock the order row (`SELECT ... FOR UPDATE` via raw query or optimistic locking with version).
     - Verify order is still `PENDING`.
     - Update order status to `PAID`.
     - Deduct inventory stock with `decrement` on product/stock records.
     - Create `PaymentLog` with status `COMPLETED`, `processedAt`.
     - Create `OrderStatusHistory`.
   - Emit socket event to user room `order:<userId>` with `order:paid` payload.
   - Return `200` with `{ success: true }`.

**Important Security Notes:**

- Webhook endpoint must **never** crash. All unexpected errors are caught, logged to `PaymentLog` with status `ERROR`, and return `200` to acknowledge receipt.
- All raw webhook payloads are stored in `PaymentLog` for audit, even if processing fails.
- The `content` field is used for matching; ensure unique order codes to prevent collisions.
- Use `SEPAY_WEBHOOK_SECRET` to verify signature. Never expose this secret.

### Idempotency & Reconciliation

- **Idempotency key:** `sepayTransactionId` from webhook payload. Unique constraint in `PaymentLog`.
- **Duplicate webhook:** If same `sepayTransactionId` arrives, the second request sees existing log and returns `200` without altering order/inventory.
- **Mismatched transfers:** Logged with status `MISMATCH` or `AMOUNT_MISMATCH`. Admin can use `POST /api/v1/admin/payments/reconcile` to manually link a payment log to an order or mark as completed after investigation.
- **Order expiry:** Cron job runs every 5 minutes, finds `PENDING` orders older than 30 minutes, cancels them, restores reserved stock, and emits socket event `order:cancelled`.

---

## Socket.io Live Chat Events

Connect to Socket.io using the same origin or with JWT auth.

**Connection:**

```js
const socket = io('http://localhost:4000', {
  auth: {
    token: 'Bearer <access_token>'
  }
});
```

**Authentication:** Server verifies JWT from `auth.token`. If invalid, connection is refused.

**Room Structure:**

- Each user joins a personal room: `user:<userId>`
- Chat rooms are joined dynamically: `chat:<roomId>`
- Admin/moderator users join `admin:chat` to receive new chat room notifications.

### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `chat:join` | `{ roomId: string }` | User joins a chat room to receive messages |
| `chat:leave` | `{ roomId: string }` | User leaves a chat room |
| `chat:message` | `{ roomId: string, content: string, attachments?: string[] }` | Send a message to a chat room |
| `chat:typing` | `{ roomId: string, isTyping: boolean }` | Indicate typing status |
| `chat:read` | `{ roomId: string, messageIds: string[] }` | Mark messages as read |
| `order:subscribe` | `{ orderId: string }` | Subscribe to order status updates |
| `presence:update` | `{ status: 'online' \| 'away' \| 'offline' }` | Update user presence |

### Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `chat:joined` | `{ roomId: string }` | Successfully joined room |
| `chat:left` | `{ roomId: string }` | Left room |
| `chat:message` | `{ id: string, roomId: string, sender: { id, fullName, avatarUrl, role }, content: string, attachments: string[], createdAt: string }` | New message received |
| `chat:typing` | `{ roomId: string, userId: string, isTyping: boolean }` | Another user typing |
| `chat:read` | `{ roomId: string, userId: string, messageIds: string[] }` | Messages read by another user |
| `chat:new_room` | `{ room: { id, subject, userId, createdAt } }` | New support room created (admin only) |
| `chat:error` | `{ code: string, message: string }` | Error event |
| `order:paid` | `{ orderId: string, orderCode: string, status: string, paidAt: string }` | Order payment confirmed |
| `order:cancelled` | `{ orderId: string, orderCode: string, status: string, cancelledAt: string }` | Order cancelled (expiry or manual) |
| `order:status_changed` | `{ orderId: string, orderCode: string, oldStatus: string, newStatus: string }` | Any order status change |
| `presence:update` | `{ userId: string, status: string }` | Another user's presence changed |

**Socket.io Middleware:**

- JWT authentication is mandatory.
- Rate limiting per socket connection (e.g., max 30 messages per minute).
- Validation of message content (max length 2000 chars, no XSS).

**Example Client Chat Flow:**

```js
socket.on('connect', () => {
  console.log('Connected');
  socket.emit('chat:join', { roomId: 'chat-room-uuid' });
});

socket.on('chat:message', (message) => {
  displayMessage(message);
});

function sendMessage(roomId, content) {
  socket.emit('chat:message', { roomId, content });
}
```

**REST Fallback:** If socket connection fails, use `POST /api/v1/chat/rooms/:id/messages` to send messages. The server will broadcast via socket.

---

## Error Handling & Rate Limiting

- **Global Error Handler:** All errors are caught and returned as structured JSON with appropriate status codes.
- **Validation:** Zod schemas validate all request bodies, params, and queries.
- **Rate Limiting:**
  - Auth endpoints: 10 requests per 15 minutes per IP.
  - General API: 100 requests per 15 minutes per user (or IP).
  - Webhook endpoint: 100 requests per minute per IP (SePay may retry).
  - Socket messages: 30 messages per minute per user.

Rate limit exceeded returns `429 Too Many Requests`.

---

## Security Best Practices

- All secrets stored in environment variables; never hardcoded.
- Passwords hashed using bcrypt (cost factor 12).
- JWT tokens signed with HS256; access and refresh secrets are different.
- Refresh tokens are rotated and revoked on logout.
- CORS restricted to `FRONTEND_URL`.
- Helmet security headers enabled.
- Input sanitization and validation via Zod.
- SQL injection prevented via Prisma ORM.
- XSS prevented by not rendering raw HTML and sanitizing chat messages.
- Webhook signature verification.
- Idempotent payment processing to prevent duplicate credits.
- Optimistic/pessimistic locking on order and inventory updates to prevent overselling.
- Payment logs stored for audit; never crash on webhook errors.
- Cron jobs run in a separate process to avoid blocking main event loop.
- Socket.io connections authenticated and rate limited.

---

## Deployment Notes

- Run `npx prisma migrate deploy` before starting.
- Use a process manager (PM2, Docker) for production.
- Scale Socket.io with Redis adapter if multiple instances.
- Ensure PostgreSQL has `FOR UPDATE` support (default).
- Set `NODE_ENV=production` for hardened security.

---

## Support

For integration issues, contact backend team. Ensure all webhook logs are reviewed daily via admin dashboard.
