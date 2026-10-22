# Olytics — ระบบคลังข้อมูลอีคอมเมิร์ซแบบอัตโนมัติบน AWS Cloud

โครงงานวิชา Cloud Technology Infrastructure (KMITL) — Data Warehouse ของชุดข้อมูล Olist บน AWS พร้อมเว็บ Dashboard

## โครงสร้าง repo

| โฟลเดอร์ / ไฟล์ | คืออะไร |
|---|---|
| `code web/olytics-web/` | **ตัวเว็บ Dashboard** (Next.js + Node.js) — รายละเอียดใน [README ของเว็บ](code%20web/olytics-web/README.md) |
| `diagram/` | AWS Architecture Diagram |
| `web/` | รูป UI prototype |
| `รายงาน/` | รายงานความก้าวหน้า |
| `process.md` | Checkpoint ว่างานเว็บทำถึงไหนแล้ว |

## เริ่มใช้งาน (สำหรับเพื่อนในทีม)

### สิ่งที่ต้องมี
- [Node.js 22 LTS](https://nodejs.org)
- [Git](https://git-scm.com)
- สิทธิ์เข้า repo (ถ้า repo เป็น Private ให้เจ้าของเพิ่มใน Settings → Collaborators แล้วกดรับคำเชิญในอีเมล)

### ขั้นตอน

```bash
git clone https://github.com/NonKaweewat/olytics-web.git
cd "olytics-web/code web/olytics-web"
npm install
cp .env.example .env.local
```

เปิดไฟล์ `.env.local` แล้วตั้งค่า:

```
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=<ตั้งรหัสเอง>
SESSION_SECRET=<พิมพ์ข้อความสุ่มยาวๆ>
```

แล้วรัน:

```bash
npm run dev
```

เปิด http://localhost:3000 แล้ว login ด้วย user / password ที่ตั้งไว้ใน `.env.local`
ปิดเว็บ: กด `Ctrl + C` ใน Terminal

> ตอนนี้ค่าเริ่มต้นคือ `DATA_SOURCE=mock` = **ข้อมูลจำลอง** (ตัวเลขไม่ใช่ของจริง ห้ามเอาไปใส่รายงาน)
> ถ้าจะต่อ Redshift จริง ดูหัวข้อ "ต่อ Redshift จริง" ใน [README ของเว็บ](code%20web/olytics-web/README.md)

### ปัญหาที่เจอบ่อย

| อาการ | วิธีแก้ |
|---|---|
| `npm` ใช้ไม่ได้ | ยังไม่ได้ติดตั้ง Node.js |
| `Could not read package.json` | ยังไม่ได้ `cd` เข้า `code web/olytics-web` |
| `'next' is not recognized` | ยังไม่ได้ `npm install` |
| `Port 3000 is in use` | มีเว็บเปิดค้างอยู่ ปิดตัวเก่า หรือเข้าตาม port ที่มันบอก เช่น `localhost:3001` |
| login ไม่ได้ | ยังไม่ได้สร้าง `.env.local` หรือไม่ได้ตั้ง `DASHBOARD_PASSWORD` |

## ⚠️ ห้าม commit

- `.env.local` — มีรหัส login และรหัส Redshift (ส่งให้กันทางแชทส่วนตัวแทน)
- `node_modules/`, `.next/` — สร้างใหม่ได้เอง

ทั้งหมดนี้อยู่ใน `.gitignore` แล้ว แต่ก่อน push ให้เช็ค `git status` อีกรอบ

## อัปโหลดงานที่แก้ขึ้น GitHub

```bash
git pull
git add .
git commit -m "อธิบายสั้นๆ ว่าแก้อะไร"
git push
```

(`git pull` ก่อนทุกครั้ง เพื่อดึงงานล่าสุดของเพื่อนมาก่อน จะได้ไม่ชนกัน)
