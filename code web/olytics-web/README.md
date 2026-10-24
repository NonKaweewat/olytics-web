# Olytics Web (Dashboard)

เว็บ Dashboard ของระบบ Olytics — Next.js + Node.js รันบน Amazon EC2 (public subnet) ดึงข้อมูลจาก Amazon Redshift (private subnet) ผ่าน SQL port 5439
ข้อมูลทุกหน้าอ่านจาก **KPI view ของทีม data** (`dw.v_br01` … `v_br14`, รายการอยู่ใน KPI.txt) — ตัวเลขบนเว็บจึงตรงกับที่ทีม data คำนวณ เว็บต้องการแค่สิทธิ์ `SELECT` บน view เหล่านี้

## Login ตาม role

login แล้วระบบพาไปหน้าของ role นั้น และซ่อน/กันหน้าที่ไม่มีสิทธิ์ (เปิด URL ตรงๆ ก็โดนเด้งกลับ, API ตอบ 403) — role มาจาก 1 ใน 2 ทาง ตาม `AUTH_PROVIDER`:
- `cognito` (ใช้จริง) — **Amazon Cognito**: อีเมลอยู่ group ไหนใน User Pool = role นั้น (ดูหัวข้อ [Amazon Cognito](#amazon-cognito))
- `local` (ค่าเริ่มต้น, ทดสอบในเครื่อง) — บัญชีใน `.env.local` (`DASHBOARD_USERS`)

**ทุก role เห็นหน้า Overview** + หน้าของตัวเอง (login แล้วเข้าหน้าของตัวเองก่อน)

| role | ผู้ใช้ข้อมูล | หน้า | BR | view ที่ใช้ | ตัวกรอง |
|---|---|---|---|---|---|
| `executive` | ผู้บริหาร | `/overview` | BR01 BR02 | br01, br02_top_states, br14 | ปี, เดือน |
| `finance` | การเงินและการชำระเงิน | overview + `/payments` | BR03 | br03 (+ br01 ยอดขายรวม) | — |
| `category` | บริหารหมวดสินค้า | overview + `/categories` | BR04 BR14 | br14 (+ br01 จำนวนคำสั่งซื้อ) | ปี, เดือน, หมวด |
| `seller` | ฝ่ายดูแลผู้ขาย | overview + `/sellers` | BR05 BR06 BR07 | br05, br06, br07 | ปี, เดือน, ภาค, รัฐผู้ขาย |
| `logistics` | โลจิสติกส์และการจัดส่ง | overview + `/delivery` | BR08 BR09 | br08, br09 | ปี, เดือน, ภาค, รัฐลูกค้า |
| `cx` | ลูกค้าและประสบการณ์ลูกค้า | overview + `/customers` | BR10 BR11 BR12 | br10, br11, br12 | ปี, เดือน |
| `marketing` | การตลาด | overview + `/marketing` | BR13 BR14 | br13, br14 | ปี, เดือน, หมวด, ภาค, รัฐ |
| `analyst` | นักวิเคราะห์ / BI | ทุกหน้า + `/query-lab` | | | |
| `admin` | ผู้ดูแลระบบ | ทุกหน้า + `/query-lab` + `/settings` | | | |

- **เดือน**: เลือกได้หลังเลือกปี — KPI / อันดับ / ตาราง ตามเดือน ส่วนกราฟแนวโน้มรายเดือนแสดงทั้งปีที่เลือก
- **ภาค**: 5 ภาคของบราซิล จับกลุ่มจากรัฐในเว็บเอง ([lib/regions.ts](lib/regions.ts)) เลือกภาคแล้วรายชื่อรัฐเหลือเฉพาะในภาค · North: AC AP AM PA RO RR TO · Northeast: AL BA CE MA PB PE PI RN SE · Central-West: DF GO MT MS · Southeast: ES MG RJ SP · South: PR RS SC
- หน้าที่ยังกรองภาค/เวลาไม่ได้ เพราะ view ไม่มีคอลัมน์นั้น — รายการที่ขอทีม data อยู่ใน [VIEW_REQUESTS.md](../../VIEW_REQUESTS.md)
- ทุกหน้ามีตัวกรองครบ แต่ละการ์ดกรองเท่าที่ view ของมันมีคอลัมน์ ([lib/scope.ts](lib/scope.ts)) ที่เหลือขึ้นคำเตือนสีส้ม — ทีม data เพิ่มคอลัมน์ตาม VIEW_REQUESTS.md แล้วใช้ได้เอง (ตรวจคอลัมน์ทุก 5 นาที)
- ข้อมูลจำลอง: view มีคอลัมน์ครบตาม VIEW_REQUESTS.md เป็นค่าเริ่มต้น (ทุกกราฟตามตัวกรอง) · ตั้ง `MOCK_VIEWS=current` เพื่อดูแบบ view ของทีม data ตอนนี้ · รัน server ตัวที่สองพร้อมกันได้ด้วย `NEXT_DIST_DIR=.next-test`
- แก้ว่า role ไหนเห็นหน้าไหน: [lib/roles.ts](lib/roles.ts) ไฟล์เดียว
- โหมด local: เพิ่ม/ลบผู้ใช้ที่ `DASHBOARD_USERS` ใน `.env.local` (รูปแบบ `user:password:role` คั่นด้วย `,`) · `DASHBOARD_USER` / `DASHBOARD_PASSWORD` แบบเดิม = บัญชี admin

## Amazon Cognito

เว็บใช้หน้า login เดิม แล้วส่งอีเมล + รหัสไปตรวจที่ Cognito จากฝั่ง server (`USER_PASSWORD_AUTH`) ตรวจลายเซ็น ID token แล้วอ่าน `cognito:groups` เป็น role ([lib/cognito.ts](lib/cognito.ts))
ไม่ใช้ Hosted UI เพราะ Cognito บังคับ callback เป็น HTTPS แต่ EC2 เปิดแบบ http · การ login ไม่ต้องใช้ IAM credentials (ไม่ติดข้อจำกัด LabRole)

**สิ่งที่ทีมต้องตั้งใน Cognito** (Console → Amazon Cognito, region เดียวกับระบบ):
1. **User pool** — Sign-in option: **Email**
2. **App client** — แบบ public / *ไม่สร้าง client secret* (ถ้ามี secret ให้ใส่ `COGNITO_CLIENT_SECRET`) และเปิด Authentication flow **`ALLOW_USER_PASSWORD_AUTH`**
3. **Groups** — สร้าง group ชื่อ **ตรงกับ role** ตัวพิมพ์เล็กทั้งหมด:
   `executive` `finance` `category` `seller` `logistics` `cx` `marketing` `analyst` `admin`
4. **Users** — สร้าง user ด้วยอีเมล แล้ว **Add user to group** ตาม role (อยู่หลาย group ได้ → ได้สิทธิ์สูงสุด: admin > analyst > อื่นๆ)
   - สร้างด้วยรหัสชั่วคราว → login ครั้งแรกหน้าเว็บจะให้ตั้งรหัสใหม่เอง
   - user ที่ไม่อยู่ group ไหนเลย login ได้แต่จะขึ้น "ยังไม่ได้กำหนด role"

**ตั้งค่าเว็บ** (`.env.local` บน EC2):
```
AUTH_PROVIDER=cognito
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx   # หน้า User pool overview
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx  # หน้า App clients
```
ตรวจได้ที่หน้า Settings (บัญชี admin) แถว "Login"

> ทดสอบแล้วแบบ offline (จำลอง Cognito API + token ที่เซ็นด้วย key ทดสอบ): group → role, หลาย group, ไม่มี group, รหัสชั่วคราว, รหัสผิด, token ปลอม/ผิด app client — **ยังไม่ได้ทดสอบกับ User Pool จริง**
- ตัวกรองแต่ละหน้า = เท่าที่ view รองรับ (เช่น v_br03 ไม่มีวันที่ หน้า Payments จึงไม่มีตัวกรอง) การ์ดที่ไม่ขึ้นกับตัวกรองมีหมายเหตุ "ทั้งช่วงข้อมูล" ใต้การ์ด

## รวมหลายแถวของ view ยังไง

view ส่วนใหญ่แยกรายเดือน / รายรัฐ เวลาเว็บรวมหลายแถว จะคำนวณอัตราและค่าเฉลี่ยใหม่จากผลรวม (ไม่เฉลี่ยค่าเฉลี่ย):
- ส่งช้า % = `SUM(late_orders) / SUM(total_delivered_orders)` · วันจัดส่งเฉลี่ย = `SUM(sum_delivery_days) / SUM(total_delivered_orders)`
- รีวิวเฉลี่ย = `SUM(review_score × review_count) / SUM(review_count)` · รีวิวต่อผู้ขาย ถ่วงด้วย `reviewed_orders`
- ส่งให้ขนส่งทัน % = `SUM(on_time_orders) / (SUM(on_time_orders) + SUM(late_orders))`
- จำนวนคำสั่งซื้อรายเดือนรวมทุกหมวด ใช้ v_br01 (รวม v_br14 ข้ามหมวดจะนับคำสั่งซื้อที่มีหลายหมวดซ้ำ)
- โค้ดอยู่ที่ [lib/metrics/](lib/metrics) หนึ่งไฟล์ต่อหน้า

## รันบนเครื่อง (ใช้ข้อมูลจำลอง)

ต้องมี Node.js 22 — ถ้า clone มาจาก GitHub ให้ `cd "code web/olytics-web"` ก่อน (ขั้นตอนเต็มอยู่ใน [README หน้าแรกของ repo](../../README.md))

> Windows PowerShell: ใช้ `npm.cmd` แทน `npm` (เช่น `npm.cmd install`, `npm.cmd run dev`)

```bash
npm install
cp .env.example .env.local   # แล้วเปลี่ยน change-me ใน DASHBOARD_USERS เป็นรหัสของตัวเอง
npm run dev
```

เปิด http://localhost:3000 แล้ว login ด้วย user / password ใน `DASHBOARD_USERS`

**`DATA_SOURCE=mock`** = สร้างคลังข้อมูลจำลองในหน่วยความจำ (PGlite = Postgres ที่รันใน Node) ด้วยตารางเดียวกับ ER diagram + ข้อมูลสุ่ม 25,000 คำสั่งซื้อ แล้วสร้าง **view ชื่อและคอลัมน์เดียวกับของทีม data** ([lib/mockviews.ts](lib/mockviews.ts)) เว็บจึงรัน SQL ชุดเดียวกับที่จะยิง Redshift
- สูตรใน mock view เป็นการเดาตาม design document ของจริงใช้ view ของทีม data
- ตัวเลขเป็นข้อมูลสุ่ม **ห้ามเอาไปใส่รายงาน**
- เปิดหน้าแรกหลัง start server จะช้า ~4 วินาที (สร้างข้อมูลครั้งเดียว)

## ต่อ Redshift จริง

1. ตั้งค่าใน `.env.local`: `DATA_SOURCE=redshift`, `REDSHIFT_HOST`, `REDSHIFT_DATABASE=dev`, `REDSHIFT_USER`, `REDSHIFT_PASSWORD`, **`REDSHIFT_SCHEMA=dw`**
2. เว็บอ่านแค่ 15 view: `v_br01_monthly_sales` … `v_br14_monthly_category_sales` (ชื่อคอลัมน์ต้องตรงกับ KPI.txt) — ถ้าทีม data เปลี่ยนชื่อ view/คอลัมน์ แก้ใน [lib/metrics/](lib/metrics) และ [lib/sql.ts](lib/sql.ts) (รายชื่อ view)
3. แนะนำให้สร้าง Redshift user แบบ read-only ให้เว็บ:
   ```sql
   CREATE USER olytics_web PASSWORD '...';
   GRANT USAGE ON SCHEMA dw TO olytics_web;
   GRANT SELECT ON ALL TABLES IN SCHEMA dw TO olytics_web;  -- รวม view
   ```

## Query Lab (Athena)

- ใช้ `{db}.ชื่อ view` ใน SQL — ระบบจะแทนเป็น `ATHENA_DATABASE` (Glue Data Catalog) หรือ `REDSHIFT_SCHEMA` · SQL ตัวอย่างอ่าน KPI view (Athena ต้องมี view ชื่อเดียวกันใน Glue Data Catalog)
- mock mode: SQL รันจริงบนคลังข้อมูลจำลอง แต่เวลาและ data scanned ของ Athena เป็นค่าจำลอง
- Credentials ของ Athena: ผูก **LabInstanceProfile** (LabRole) ให้ EC2 แล้วไม่ต้องใส่ key; หรือใส่ `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` จาก Learner Lab (เปลี่ยนทุก session)
- ตั้ง `ATHENA_OUTPUT_LOCATION` เป็น S3 path สำหรับเก็บผล query
- รับเฉพาะคำสั่ง `SELECT` / `WITH`

## Deploy ขึ้น EC2

1. สร้าง EC2 (Amazon Linux 2023, t3.small) ใน **public subnet** ของ VPC เดียวกับ Redshift, IAM instance profile = `LabInstanceProfile`
2. Security Group
   - **EC2 SG**: Inbound HTTP 80 จาก `0.0.0.0/0` (+ SSH 22 จาก IP ตัวเอง)
   - **Redshift SG**: Inbound TCP 5439 จาก **EC2 SG เท่านั้น**
3. คัดลอกโฟลเดอร์นี้ขึ้น EC2 (git clone หรือ scp, ไม่ต้องเอา `node_modules` / `.next`)
4. `cp .env.example .env.local` แล้วใส่ค่าจริง (**เปลี่ยนรหัสทุกบัญชีใน `DASHBOARD_USERS`**)
5. `bash deploy/ec2-setup.sh` → เปิด `http://<EC2 public IP>/`

Health check (ไม่ต้อง login): `GET /api/health`

> ⚠️ Learner Lab: ปิด EC2 / Redshift เมื่อไม่ใช้เพื่อประหยัดงบ เปิดใหม่แล้ว public IP ของ EC2 จะเปลี่ยน

## โครงสร้างโค้ด

```
app/
  login/              หน้า login
  (dash)/             dashboard ทุกหน้า (layout อ่าน role → sidebar แสดงเฉพาะหน้าที่มีสิทธิ์)
    overview/ payments/ categories/ sellers/ delivery/ customers/ marketing/ query-lab/ settings/
  api/
    data/[page]/      ข้อมูล dashboard เป็น JSON (เช็ค role)
    login, logout, filters, health, query
components/           Charts (recharts), Card, DataTable, KpiCard, Sidebar, FilterBar, ...
lib/
  roles.ts            role → หน้าที่เห็น (แก้สิทธิ์ที่นี่)
  auth.ts             session cookie (HMAC, เก็บ user + role) — ใช้ใน middleware
  login.ts            ตรวจรหัส: local (DASHBOARD_USERS) หรือ cognito
  cognito.ts          Amazon Cognito sign-in + ตั้งรหัสใหม่ + group → role
  metrics/*.ts        SQL ของแต่ละหน้า (อ่าน KPI view)
  sql.ts              รายชื่อ view + ตัวช่วยสร้าง WHERE
  mockviews.ts        view จำลองชื่อ/คอลัมน์เดียวกับของทีม data
  db.ts               query() → Redshift หรือคลังข้อมูลจำลอง ตาม DATA_SOURCE
  mockdb.ts           คลังข้อมูลจำลอง (PGlite) ตาม ER diagram
  redshift.ts         pg connection pool (port 5439, SSL)
  querylab.ts         Athena vs Redshift
middleware.ts         บังคับ login + เช็คสิทธิ์ role ทุกหน้าและ API
```
