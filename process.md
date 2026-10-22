# Olytics Web — Process / Checkpoint

> ไฟล์นี้ใช้บอกว่าทำเว็บถึงไหนแล้ว ถ้า limit หมดกลางทาง ให้เปิดไฟล์นี้แล้วทำต่อจากข้อแรกที่ยังไม่ติ๊ก `[ ]`
> อัปเดตล่าสุด: 2026-10-20

## บริบทโปรเจกต์ (สรุปจากรายงาน + Diagram)

- ระบบ: **Olytics** — Data Warehouse อีคอมเมิร์ซ (Olist, ~100k orders, 2016–2018) บน AWS Learner Lab (us-east-1 / us-west-2)
- Pipeline (เพื่อนทำ): Database → S3 Raw → Lambda → Glue DataBrew → Glue ETL (Star Schema) → S3 Curated → **Redshift (private subnet)**
- **ส่วนของเรา**: เว็บ Dashboard **Next.js + Node.js** รันบน **EC2 (public subnet)** ต่อ Redshift ผ่าน **SQL / Port 5439** (driver `pg`)
- เว็บต้องมี (ตาม UI prototype ในโฟลเดอร์ `web/`):
  1. หน้า Login
  2. Overview — KPI 4 ใบ (Revenue, Orders, Avg Freight, Avg Review), Monthly Revenue, Top Categories, Orders by State, Delivery vs Review scatter
  3. Sales — KPI (Revenue, Orders, AOV, Avg Freight), Monthly Revenue, Orders by Month, Best-Selling table
  4. Delivery & Reviews — KPI (Avg delivery days, Avg review, On-time %, Late %), scatter, Review distribution, Delivery status donut, Key insight
  5. Filter: ปี / หมวดสินค้า / รัฐ
  6. (UC-03) หน้า Query Lab — รัน SQL เดียวกันบน Athena vs Redshift แล้วเทียบเวลา
  7. (UC-04 alt) ต่อ Redshift ไม่ได้ → แสดงข้อความ error
- Schema ใน Redshift (ER diagram จากเพื่อน, อัปเดต 2026-10-20 — แทน Star Schema เดิมในรายงาน):
  - `fact_order(order_key, order_id, purchase_date_key, customer_key, order_status_key, total_sales, total_freight, total_payment, order_count, delivery_days, late_flag)`
  - `fact_order_item(order_item_key, order_id, order_item_id, purchase_date_key, customer_key, seller_key, product_key, order_status_key, price, freight_value, item_count, on_time_flag)`
  - `fact_review(review_key, review_id, order_id, review_date_key, customer_key, review_score_key, review_count)` → `dim_review_score(review_score_key, review_score)`
  - `fact_payment(payment_key, order_id, purchase_date_key, customer_key, payment_method_key, payment_sequential, payment_installments, payment_value)` → `dim_payment_method(payment_method_key, payment_type)`
  - `dim_date(date_key, full_date, day_of_month, month_number, month_name, quarter_number, year_number)`
  - `dim_customer(customer_key, customer_id, customer_unique_id, zip_code_prefix, city, state)`
  - `dim_product(product_key, product_id, category_name, category_english)`, `dim_seller(seller_key, seller_id, zip_code_prefix, city, state)`, `dim_order_status(order_status_key, order_status)`

## การตัดสินใจ (Decisions)

- โค้ดเว็บอยู่ที่ `code web/olytics-web/`
- `DATA_SOURCE=mock` (ค่าเริ่มต้น) ใช้ข้อมูลจำลอง → ทำเว็บได้เลยโดยไม่ต้องรอข้อมูลขึ้น AWS; พอเพื่อนโหลดเสร็จเปลี่ยนเป็น `DATA_SOURCE=redshift`
- Login แบบง่าย: user/pass จาก env (`DASHBOARD_USER`, `DASHBOARD_PASSWORD`) + cookie ที่ sign ด้วย HMAC (ไม่ต้องใช้ IAM เพราะ Learner Lab สร้าง user ไม่ได้)
  - `SESSION_SECRET` ไม่บังคับ: ไม่ตั้ง = สุ่มกุญแจใหม่ทุกครั้งที่ server เปิด (restart แล้วต้อง login ใหม่ — ทีมโอเคแล้ว). middleware รันแบบ runtime nodejs เพื่อใช้กุญแจร่วมกับ API (เก็บใน globalThis)
- กราฟใช้ `recharts`
- Mapping ข้อมูล → กราฟ (lib/queries.ts):
  - Revenue / Orders / Freight / หมวดสินค้า / รายเดือน → `fact_order_item` (revenue = SUM(price))
  - Delivery days / Late % → `fact_order.delivery_days`, `late_flag = 1`
  - Review → `fact_review` + `dim_review_score` join ด้วย order_id
  - หมวดสินค้าใช้ `COALESCE(category_english, category_name)`; filter ปี = `dim_date.year_number` ของ purchase date; filter รัฐ = `dim_customer.state`
  - Delivery Status เหลือ On time / Late (schema ไม่มีวันที่คาดว่าจะส่ง → ไม่มี Early)
- ⚠️ ยังไม่ได้กรอง order_status (เช่น canceled) ออกจากยอดขาย — ถามทีมว่าต้องการไหม
- ⚠️ ต้องยืนยันกับเพื่อน: `late_flag` = 1 แปลว่าส่งช้า, `delivery_days` เป็น NULL เมื่อยังไม่ส่งถึง
- ⚠️ ชื่อ schema ใน Redshift ตั้งผ่าน env `REDSHIFT_SCHEMA` (default `public`)

## Checklist

### Phase 1 — Setup
- [x] อ่านรายงาน + diagram + UI prototype
- [x] สร้าง process.md
- [x] Scaffold Next.js (TypeScript, App Router) ใน `code web/olytics-web`
- [x] ติดตั้ง deps: `next react react-dom recharts pg @aws-sdk/client-athena`

### Phase 2 — Data layer
- [x] `lib/types.ts` — type ของข้อมูล dashboard
- [x] `lib/mock.ts` — ข้อมูลจำลอง (ตัวเลขใกล้ prototype)
- [x] `lib/redshift.ts` — pg Pool ต่อ Redshift (SSL, port 5439)
- [x] `lib/queries.ts` — SQL ทุกกราฟ + filter (year/category/state)
- [x] `lib/data.ts` — เลือก mock / redshift ตาม env
- [x] API routes: `/api/login`, `/api/logout`, `/api/dashboard`, `/api/filters`, `/api/health`, `/api/query`

### Phase 3 — UI
- [x] Theme (dark navy + lime #C6F46B + purple #6D3FE0) ตาม prototype
- [x] หน้า Login + middleware ป้องกันหน้า dashboard
- [x] Layout: Sidebar (Overview / Sales / Delivery & Reviews / Settings) + Filter bar
- [x] Overview page
- [x] Sales page
- [x] Delivery & Reviews page
- [x] Error state เมื่อต่อ Redshift ไม่ได้
- [x] Query Lab (Athena vs Redshift) — UC-03
- [x] Settings page (แสดงสถานะการเชื่อมต่อ / data source)

### Phase 4 — Test & Deploy prep
- [x] `npm run build` ผ่าน
- [x] ทดสอบใน browser (mock mode) ทุกหน้า
- [x] `.env.example` + README (วิธีรัน local / deploy EC2)
- [x] สคริปต์ deploy EC2 (`deploy/ec2-setup.sh` — ติดตั้ง Node, build, รันด้วย pm2, port 80/3000)
- [x] Security Group notes: EC2 เปิด 80/443 (หรือ 3000) จาก internet, Redshift SG เปิด 5439 เฉพาะจาก SG ของ EC2

### Phase 5 — รอเพื่อน (ทำหลังข้อมูลขึ้น Redshift)
- [ ] ได้ endpoint / db / user / password ของ Redshift
- [x] ได้ ER diagram → แก้ SQL ให้ตรงแล้ว (lib/queries.ts, Query Lab presets)
- [ ] ยืนยันความหมาย late_flag / delivery_days / order_status กับเพื่อน
- [ ] ตั้ง `DATA_SOURCE=redshift` แล้วทดสอบทุกหน้า
- [ ] Deploy ขึ้น EC2

## Log
- 2026-10-20: เริ่มงาน อ่านเอกสารครบ เขียนแผนนี้
- 2026-10-20: Phase 1–2 เสร็จ (scaffold, data layer mock/redshift, lib/auth.ts, middleware.ts, lib/querylab.ts, API: login/logout/dashboard/filters/health/query) → ต่อที่ Phase 3 UI
- 2026-10-20: Phase 3 UI เขียนครบทุกหน้า (login, overview, sales, delivery, query-lab, settings) → ต่อที่ Phase 4 build/test
- 2026-10-20: Phase 4 เสร็จ — build ผ่าน, ทดสอบทุกหน้าใน browser (mock), filter/logout/redirect ใช้ได้, ทดสอบ redshift mode ต่อไม่ได้ → ขึ้น error state ถูกต้อง, SQL guard ใน Query Lab ทำงาน. README + deploy/ec2-setup.sh เขียนแล้ว
- **สถานะตอนนี้: เว็บพร้อม รอ Phase 5 (ข้อมูลจากเพื่อน)** — รัน local: cd "code web/olytics-web" && npm run dev (login ดูใน .env.local)
- 2026-10-20: ได้ ER diagram ใหม่ → เขียน lib/queries.ts ใหม่ตาม fact_order / fact_order_item / fact_review / fact_payment, Query Lab presets ใหม่ (เพิ่ม Payment methods), Delivery Status เหลือ On time/Late. build ผ่าน, ทดสอบ mock ผ่าน (ยังไม่ได้ทดสอบกับ Redshift จริง)
- 2026-10-23: SESSION_SECRET ไม่บังคับแล้ว (สุ่มเองตอนเปิด server) — ทดสอบ production: login ได้, restart แล้วต้อง login ใหม่, ตั้งค่าเองแล้ว login ไม่หลุด
