# Olist internal EC2 API

API สำหรับทดสอบภายใน EC2 ตามคำขอ ใช้ Redshift views จริงทั้ง 15 ตัว ไม่มีการสร้างหรือเปลี่ยนตาราง/สูตร KPI

## ตำแหน่งที่ใช้งาน

- EC2: `olist-dashboard-ec2` (`i-0554cf1a2c662c788`), Region `us-east-1`
- โค้ด: `/home/ec2-user/olist-dashboard/internal-api/`
- การตั้งค่าเดิม: `/home/ec2-user/olist-dashboard/.env`
- Service: `olist-api.service`
- Listener: `127.0.0.1:3001` เท่านั้น
- Nginx `/api/` อนุญาตเฉพาะ loopback; คำขอจากภายนอกต้องได้ `403`
- เก็บ `api-server.js` เดิมในโฟลเดอร์หลักไว้ ไม่ลบหรือเขียนทับ

ยังไม่มีระบบล็อกอินหรือ RBAC ใน API รุ่นทดสอบนี้ **ห้ามเปิด Nginx `/api/` ให้ภายนอกก่อนเพิ่มการยืนยันตัวตนและสิทธิ์**

## ลองบน Linux ของ EC2

```bash
curl -s http://127.0.0.1:3001/api/health
curl -s http://127.0.0.1:3001/api/ready
curl -s http://127.0.0.1:3001/api/kpis
curl -s 'http://127.0.0.1:3001/api/kpis/br01-monthly-sales?year=2018&month=1'
curl -s 'http://127.0.0.1:3001/api/kpis/br05-seller-performance?limit=10&sort=total_sales&direction=desc'
curl -s http://127.0.0.1:3001/api/kpis/br08-late-delivery/schema
```

`/api/health` ตรวจโปรแกรม, `/api/ready` ตรวจฐานข้อมูล, `/api/kpis` แสดง endpoints ทั้งหมด, `/api/kpis/:id/schema` แสดงคอลัมน์และ filters ที่ view นั้นรองรับ

แต่ละ KPI เรียกได้ทั้ง route ทั่วไป `/api/kpis/:id` และ route ตามชื่อที่ส่งมอบ:

| Route ที่ส่งมอบ | KPI ID |
|---|---|
| `/api/sales` | br01-monthly-sales |
| `/api/top-states` | br02-top-states |
| `/api/top-categories` | br02-top-categories |
| `/api/payments` | br03-payment-distribution |
| `/api/category-performance` | br04-category-performance |
| `/api/sellers` | br05-seller-performance |
| `/api/seller-shipping` | br06-seller-on-time |
| `/api/inactive-sellers` | br07-sellers-without-revenue |
| `/api/late-delivery` | br08-late-delivery |
| `/api/delivery-days` | br09-delivery-days |
| `/api/reviews` | br10-review-satisfaction |
| `/api/repeat-customers` | br11-repeat-customers |
| `/api/order-failures` | br12-order-failure-rate |
| `/api/customer-geography` | br13-customer-geography |
| `/api/monthly-categories` | br14-monthly-category-sales |

| ID หลัง `/api/kpis/` | Redshift view |
|---|---|
| br01-monthly-sales | dw.v_br01_monthly_sales |
| br02-top-states | dw.v_br02_top_states |
| br02-top-categories | dw.v_br02_top_categories |
| br03-payment-distribution | dw.v_br03_payment_distribution |
| br04-category-performance | dw.v_br04_category_performance |
| br05-seller-performance | dw.v_br05_seller_performance |
| br06-seller-on-time | dw.v_br06_seller_on_time |
| br07-sellers-without-revenue | dw.v_br07_sellers_without_revenue |
| br08-late-delivery | dw.v_br08_late_delivery |
| br09-delivery-days | dw.v_br09_delivery_days |
| br10-review-satisfaction | dw.v_br10_review_satisfaction |
| br11-repeat-customers | dw.v_br11_repeat_customers |
| br12-order-failure-rate | dw.v_br12_order_failure_rate |
| br13-customer-geography | dw.v_br13_customer_geography |
| br14-monthly-category-sales | dw.v_br14_monthly_category_sales |

พารามิเตอร์: `year`, `month`, `state` (customer state), `seller_state`, `category`, `seller_id`, `payment_type`, `review_score` ใช้ได้เฉพาะ view ที่มีคอลัมน์นั้น ค่าไม่ถูกต้อง/ตัวกรองที่ view ไม่รองรับจะได้ `400` ไม่ถูกละเลย

แบ่งหน้า: `limit` 1–500 (ค่าเริ่มต้น 100) และเลือกใช้ `page` (เริ่มที่ 1) **หรือ** `offset` 0–100000 เพียงแบบเดียว; เรียงด้วย `sort=<ชื่อคอลัมน์>` และ `direction=asc|desc` ผลตอบกลับเป็น `{id,data,pagination}` พร้อม `page`, `hasMore`, `nextOffset` และ `nextPage` จำนวนเงิน/ค่าทศนิยมและ bigint คงเป็น string เพื่อรักษาความแม่นยำ

`/api/sales` เดิมยังส่ง array และรองรับพารามิเตอร์เดียวกัน โดยมี header `X-Has-More` บอกว่ามีหน้าถัดไปหรือไม่

SQL เป็น SELECT จาก allowlist เท่านั้น ค่าตัวกรองใช้ parameter binding และมี query timeout ข้อมูล KPI ยังคงสูตรและ grain ของ view ต้นทาง ไม่มีการรวมเปอร์เซ็นต์หรือเฉลี่ยค่าเฉลี่ยซ้ำ

## การรันและทดสอบ

```bash
sudo systemctl status olist-api --no-pager
sudo systemctl restart olist-api
sudo journalctl -u olist-api -n 30 --no-pager
cd /home/ec2-user/olist-dashboard/internal-api
node --test test/*.test.js
bash scripts/test-api.sh
```

`scripts/test-api.sh` ตรวจสถานะ HTTP, JSON contract, pagination `page=1&limit=20`, parameter validation และ route ตามชื่อทั้ง 15 รายการ โดยแสดง `PASS`/`FAIL` แต่ไม่พิมพ์ response ที่อาจมีข้อมูลละเอียดอ่อน

ใช้ dependencies เดิมจาก `../node_modules` บน EC2 การเริ่มทำงานผ่าน `start-api.js` อ่าน `.env` เดิม และให้ `asm-exec` ทางการ resolve SecretString ที่ runtime ด้วย instance role ส่งให้ child ผ่าน environment โดยไม่บันทึกรหัสผ่านลงโค้ด/log ต้องมีสิทธิ์ Secrets Manager และ AWS MCP ที่ใช้ resolve; หากเปลี่ยน secret ให้ restart service

`asm-exec` ดาวน์โหลดจาก AWS Agent Toolkit (SHA256 `05a9f8164b63b286bcf88bf4223c95b799e0ecaada45ddcd805567f57b20299f`) และตรวจ checksum ก่อนใช้

## Rollback

ตำแหน่ง backup ของแต่ละ deployment จะอยู่ใน `/home/ec2-user/olist-dashboard/backups/` พร้อม `rollback.sh` สำหรับหยุด/คืน service และคืน Nginx จากก่อน deploy ใช้ backup ที่ระบุในผลการ deploy เท่านั้น การ rollback ครั้งแรกจะกลับสู่สภาพเดิมที่ backend ยังไม่ได้รัน

โค้ดชุดนี้ยังไม่เชื่อมหน้าเว็บ Next.js และไม่เพิ่มระบบล็อกอินตามขอบเขตทดสอบภายในที่ผู้ใช้เลือก

## แผนบัญชีฐานข้อมูลแบบ read-only

ก่อนเปิด API ให้ผู้ใช้อื่น ให้ DBA สร้างบัญชีแยกสำหรับ API เช่น `olytics_api_ro` และ grant เฉพาะ `USAGE` บน schema `dw` กับ `SELECT` บน views 15 ตัวข้างต้น จากนั้นอัปเดตค่า username/password ใน Secrets Manager secret เดิม, restart `olist-api`, แล้วทดสอบ `/api/ready` และสคริปต์ API อีกครั้ง การเปลี่ยน secret กลับเป็นเวอร์ชันก่อนหน้าและ restart service คือ rollback ไม่ต้องเปลี่ยนโค้ดหรืออ่านค่า secret ออกมา
