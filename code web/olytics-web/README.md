# Olytics Web (Dashboard)

เว็บ Dashboard ของระบบ Olytics — Next.js + Node.js รันบน Amazon EC2 (public subnet) ดึงข้อมูลจาก Amazon Redshift (private subnet) ผ่าน SQL port 5439

## หน้าในเว็บ

| Path | หน้า | Use case |
|---|---|---|
| `/login` | เข้าสู่ระบบ | — |
| `/overview` | ภาพรวม (KPI, Monthly Revenue, Top Categories, Orders by State, Delivery vs Review) | UC-04 |
| `/sales` | วิเคราะห์ยอดขาย (KPI, Monthly Revenue, Orders by Month, Best-Selling) | UC-04 |
| `/delivery` | การจัดส่งและรีวิว (KPI, scatter, Review distribution, Delivery status, Key insight) | UC-04 |
| `/query-lab` | รัน SQL เดียวกันบน Athena vs Redshift แล้วเทียบเวลา / data scanned / ค่าใช้จ่าย | UC-03 |
| `/settings` | สถานะการเชื่อมต่อ Redshift | — |

ทุกหน้ากรองด้วย ปี / หมวดสินค้า / รัฐ ได้ (เก็บใน URL query เช่น `?year=2018&state=SP`)

## รันบนเครื่อง (ใช้ข้อมูลจำลอง)

ต้องมี Node.js 22 — ถ้า clone มาจาก GitHub ให้ `cd "code web/olytics-web"` ก่อน (ขั้นตอนเต็มอยู่ใน [README หน้าแรกของ repo](../../README.md))

> Windows PowerShell: ใช้ `npm.cmd` แทน `npm` (เช่น `npm.cmd install`, `npm.cmd run dev`)

```bash
npm install
cp .env.example .env.local   # แล้วตั้ง DASHBOARD_PASSWORD กับ SESSION_SECRET
npm run dev
```

เปิด http://localhost:3000 แล้ว login ด้วย `DASHBOARD_USER` / `DASHBOARD_PASSWORD` จาก `.env.local`

`DATA_SOURCE=mock` = ข้อมูลจำลอง (ตัวเลขไม่ใช่ของจริง) — ใช้ทำ/ทดสอบหน้าเว็บระหว่างรอข้อมูลขึ้น Redshift

## ต่อ Redshift จริง

1. ตั้งค่าใน `.env.local`: `DATA_SOURCE=redshift`, `REDSHIFT_HOST`, `REDSHIFT_DATABASE`, `REDSHIFT_USER`, `REDSHIFT_PASSWORD`, `REDSHIFT_SCHEMA`
2. ตารางที่เว็บใช้ (ตาม ER diagram) — SQL ทั้งหมดอยู่ใน [lib/queries.ts](lib/queries.ts)
   - `fact_order_item` → ยอดขาย, จำนวนออเดอร์, ค่าส่ง, หมวดสินค้า, รายเดือน
   - `fact_order` → `delivery_days`, `late_flag` (1 = ส่งช้า)
   - `fact_review` + `dim_review_score` → คะแนนรีวิว
   - `fact_payment` + `dim_payment_method` → ใช้ใน Query Lab
   - `dim_date` (`year_number`, `month_number`), `dim_customer` (`state`), `dim_product` (`category_english`)
3. แนะนำให้สร้าง Redshift user แบบ read-only ให้เว็บ:
   ```sql
   CREATE USER olytics_web PASSWORD '...';
   GRANT USAGE ON SCHEMA public TO olytics_web;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO olytics_web;
   ```

## Query Lab (Athena)

- ใช้ `{db}.ชื่อตาราง` ใน SQL — ระบบจะแทนเป็น `ATHENA_DATABASE` (Glue Data Catalog) หรือ `REDSHIFT_SCHEMA`
- Credentials ของ Athena: ผูก **LabInstanceProfile** (LabRole) ให้ EC2 แล้วไม่ต้องใส่ key; หรือใส่ `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` จาก Learner Lab (เปลี่ยนทุก session)
- ตั้ง `ATHENA_OUTPUT_LOCATION` เป็น S3 path สำหรับเก็บผล query
- รับเฉพาะคำสั่ง `SELECT` / `WITH`

## Deploy ขึ้น EC2

1. สร้าง EC2 (Amazon Linux 2023, t3.small) ใน **public subnet** ของ VPC เดียวกับ Redshift, IAM instance profile = `LabInstanceProfile`
2. Security Group
   - **EC2 SG**: Inbound HTTP 80 จาก `0.0.0.0/0` (+ SSH 22 จาก IP ตัวเอง)
   - **Redshift SG**: Inbound TCP 5439 จาก **EC2 SG เท่านั้น**
3. คัดลอกโฟลเดอร์นี้ขึ้น EC2 (git clone หรือ scp, ไม่ต้องเอา `node_modules` / `.next`)
4. `cp .env.example .env.local` แล้วใส่ค่าจริง
5. `bash deploy/ec2-setup.sh` → เปิด `http://<EC2 public IP>/`

Health check (ไม่ต้อง login): `GET /api/health`

> ⚠️ Learner Lab: ปิด EC2 / Redshift เมื่อไม่ใช้เพื่อประหยัดงบ เปิดใหม่แล้ว public IP ของ EC2 จะเปลี่ยน

## โครงสร้างโค้ด

```
app/
  login/            หน้า login
  (dash)/           หน้า dashboard ทั้งหมด (sidebar layout)
  api/              login, logout, dashboard, filters, health, query
components/         Charts (recharts), Sidebar, FilterBar, KpiCard, ...
lib/
  queries.ts        SQL ทั้งหมดที่ยิง Redshift
  redshift.ts       pg connection pool (port 5439, SSL)
  mock.ts           ข้อมูลจำลอง
  data.ts           เลือก mock / redshift ตาม DATA_SOURCE
  querylab.ts       Athena vs Redshift
  auth.ts           session cookie (HMAC)
middleware.ts       บังคับ login ทุกหน้า
```
