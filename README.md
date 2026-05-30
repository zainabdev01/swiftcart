# 🛒 ShopEase — E-Commerce Complete Project
# SQL Server + Node.js + HTML/CSS/JS

## 📁 PROJECT STRUCTURE
```
ecommerce/
├── server.js              ← Main server (entry point)
├── db.js                  ← SQL Server connection
├── .env                   ← Your DB credentials (YAHAN EDIT KARO)
├── package.json           ← Dependencies
├── middleware/
│   └── auth.js            ← JWT token verification
├── routes/
│   ├── auth.js            ← Login / Register APIs
│   ├── products.js        ← Products CRUD APIs
│   ├── cart.js            ← Cart APIs
│   ├── orders.js          ← Orders APIs
│   └── extra.js           ← Payments, Wishlist, Notifications
└── public/
    └── index.html         ← Complete Frontend (1 file)
```

## ⚡ STEP 1 — PREREQUISITES
- Node.js install hona chahiye: https://nodejs.org
- SQL Server install hona chahiye (LocalDB ya Express ya Full)
- Aapki existing SQL database "AdvancedECommerceDB" already bani hui ho

## 🔧 STEP 2 — .ENV FILE EDIT KARO
File kholo: `.env`
Yeh lines apni values se replace karo:

```
DB_SERVER=localhost          ← ya LAPTOP-NAME\SQLEXPRESS
DB_NAME=AdvancedECommerceDB
DB_USER=sa                   ← aapka SQL username
DB_PASSWORD=YourPassword     ← aapka SQL password
PORT=3000
JWT_SECRET=koi_bhi_random_string_likhdo
SESSION_SECRET=koi_bhi_random_string
```

> ⚠️ IMPORTANT: Agar Windows Authentication use karte ho to db.js mein
> `trustedConnection: true` add karo aur user/password hata do.

## 📦 STEP 3 — PACKAGES INSTALL KARO
Terminal kholo, project folder mein jao:
```bash
cd ecommerce
npm install
```

## 🚀 STEP 4 — SERVER START KARO
```bash
node server.js
```
Ya development mein (auto-restart):
```bash
npm run dev
```

Agar sab theek ho to yeh dikhega:
```
✅ SQL Server se Connected ho gaye!
🚀 Server chal raha hai: http://localhost:3000
```

## 🌐 STEP 5 — BROWSER MEIN KHOLO
```
http://localhost:3000
```

## 🔑 DEFAULT LOGIN (Sample Data se)
- Email: admin@gmail.com
- Password: admin123
- Role: Admin (Admin Panel access hoga)

## 📡 API ENDPOINTS LIST
| Method | URL | Description |
|--------|-----|-------------|
| POST | /api/auth/register | Register |
| POST | /api/auth/login | Login |
| GET | /api/products | Sab products |
| GET | /api/products/:id | Single product |
| POST | /api/products | Add product (Admin) |
| PUT | /api/products/:id | Update product (Admin) |
| DELETE | /api/products/:id | Delete product (Admin) |
| GET | /api/cart | My cart |
| POST | /api/cart/add | Add to cart |
| DELETE | /api/cart/:id | Remove from cart |
| POST | /api/orders/place | Place order |
| GET | /api/orders/my | My orders |
| POST | /api/payments | Record payment |
| GET | /api/wishlist | My wishlist |
| POST | /api/wishlist/add | Add to wishlist |
| GET | /api/admin/stats | Dashboard stats (Admin) |
| GET | /api/admin/users | All users (Admin) |
| POST | /api/admin/coupons | Add coupon (Admin) |

## 🧪 SQL SERVER MEIN TEST KARO
SQL Server Management Studio mein yeh queries chalao:

```sql
-- Products check karo
SELECT * FROM vw_ProductDetails;

-- Orders check karo  
SELECT * FROM vw_OrderSummary;

-- Inventory logs check karo
SELECT * FROM InventoryLogs;

-- Audit logs check karo
SELECT * FROM AuditLogs;

-- Cart check karo
SELECT * FROM Cart;
```

## 🔧 TROUBLESHOOTING

### ❌ DB Connection Error
1. SQL Server chal raha hai? Services check karo
2. .env mein DB_SERVER sahi hai? Try karo: `.\SQLEXPRESS` ya `localhost\SQLEXPRESS`
3. SQL Server Authentication enabled hai?
   SSMS > Server Properties > Security > SQL Server and Windows Authentication mode

### ❌ Port Already in Use
.env mein PORT ko 3001 ya koi aur number karo

### ❌ Module Not Found
```bash
npm install
```
dobara chalao

## ✅ FEATURES
- [x] User Registration & Login (JWT)
- [x] Product Listing with Filters (Search, Category, Brand, Price)
- [x] Product Detail Modal with Reviews
- [x] Shopping Cart (Add, Remove, Update)
- [x] Wishlist
- [x] Order Placement (sp_PlaceOrder stored procedure use)
- [x] Coupon/Discount System
- [x] Payment Recording
- [x] Order Tracking
- [x] Return & Refund System
- [x] Notifications
- [x] Admin Dashboard (Stats, Products, Orders, Coupons)
- [x] Inventory Logs (Trigger se auto)
- [x] Audit Logs (Trigger se auto)
- [x] Soft Delete Products
- [x] JWT Authentication & Role-based Access
