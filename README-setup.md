# 🐉 VhagarBot — คู่มือตั้ง บอทอนุมัติโค้ดบน Discord (ภาษาไทย ทีละขั้น)

บอทตัวนี้ช่วยให้ **เพื่อนส่ง Machine Code (6 หลัก) มาในห้อง Discord** แล้ว **คุณพิมพ์คำสั่งเดียว** ระบบก็เพิ่มสิทธิ์ให้ในไฟล์ `licenses.json` บน GitHub อัตโนมัติ — ไม่ต้องเข้า GitHub ไม่ต้องแก้ไฟล์เอง

ภาพรวมสิ่งที่ต้องทำ (ทำครั้งเดียว):

1. เตรียม repo `vhagarbot-licenses` + ไฟล์ `licenses.json` บน GitHub
2. สร้างบอทบน Discord → โดน token มา
3. สร้าง token GitHub (สำหรับให้บอทแก้ไฟล์)
4. เอารหัสทั้งหมดไปใส่ Render แล้ว deploy
5. ตั้ง UptimeRobot ปลุกบอทกันหลับ
6. เสร็จ! ใช้งานด้วยคำสั่ง `!approve ...`

> ⏱️ ใช้เวลาประมาณ 20–30 นาที · ไม่ต้องเขียนโค้ด (โค้ดเตรียมไว้ให้หมดแล้ว)

---

## ลบบอทเก่า "spiritvale-discord-bot" ก่อน (ถ้าไม่ได้ใช้แล้ว)

1. เปิด https://dashboard.render.com → ล็อกอิน
2. คลิกชื่อ service `spiritvale-discord-bot`
3. เมนูซ้าย → **Settings**
4. เลื่อนลง **ล่างสุด** → กรอบแดง **Delete Web Service** → คลิก
5. พิมพ์ชื่อ `spiritvale-discord-bot` ยืนยัน → ลบ
6. (ถ้าจะเอา UptimeRobot ตัวเก่าไปใช้กับบอทใหม่ด้วย ไม่ต้องลบ — เดี๋ยวแก้ URLเอา)

---

## ขั้นที่ 1 · เตรียมไฟล์ licenses.json บน GitHub

ถ้ายังไม่มี repo `sixdayth/vhagarbot-licenses`:

1. เปิด https://github.com/new
2. Repository name = `vhagarbot-licenses` → เลือก **Public** (ต้อง public เพราะตัว VhagarBot อ่านผ่าน raw URL)
3. ติ๊ก ✅ *Add a README file* → **Create repository**

เพิ่มไฟล์ license:

1. ในหน้า repo กด **Add file → Create new file**
2. ชื่อไฟล์ = `licenses.json`
3. วางเนื้อหานี้ลงไป:

```json
{
  "licenses": {}
}
```

4. กด **Commit changes**

เสร็จ → ไฟล์นี้จะอยู่ที่ `sixdayth/vhagarbot-licenses/main/licenses.json` (ตรงกับที่ `render.yaml` ตั้งไว้)

---

## ขั้นที่ 2 · สร้างบอทบน Discord

1. เปิด https://discord.com/developers/applications
2. ปุ่ม **New Application** → ตั้งชื่อ (เช่น `VhagarApprove`) → Create
3. เมนูซ้าย → **Bot**
   - กด **Reset Token** → **Copy** เก็บไว้ → ชื่อ **`DISCORD_TOKEN`** (จะเห็นครั้งเดียว)
   - เลื่อนลงหัวข้อ *Privileged Gateway Intents* → เปิดสวิตช์ **MESSAGE CONTENT INTENT** ✅ (สำคัญ ไม่เปิดแล้วบอทอ่านข้อความไม่ออก)
   - กด **Save Changes**
4. ชวนบอทเข้้าเซิร์ฟเวอร์คุณ: เมนูซ้าย → **OAuth2 → URL Generator**
   - ติ๊ก *Scopes* = `bot`
   - ติ๊ก *Bot Permissions* = `Send Messages`, `Read Message History`
   - คัดลอก URL ด้านล่างที่เปิด → วางในเบราว์เซอร์ → เลือกเซิร์ฟเวอร์ → **Authorize**
5. เอา **Discord User ID ของตัวเอง** (ไว้กำหนดสิทธิ์ว่ามีแค่เราที่สั่งได้):
   - เปิด Discord → **Settings (เฟือง) → Advanced** → เปิด **Developer Mode**
   - คลิกขวาที่ **ชื่อตัวเอง** (หรือที่โปรไฟล์) → **Copy User ID** → ตัวเลขยาว ๆ คือ `ADMIN_USER_ID` เก็บไว้

---

## ขั้นที่ 3 · สร้าง GitHub Token (ให้บอทแก้ไฟล์ licenses.json)

1. เปิด https://github.com/settings/personal-access-tokens/new (Fine-grained token)
2. ตั้งค่า:
   - Token name: `vhagar-approve`
   - Expiration: เลือกยาวสุด / หรือ No expiration (ถนัด)
   - **Repository access** → เลือก **Only select repositories** → ติ๊ก `sixdayth/vhagarbot-licenses` (เลือกแค่ repo นี้พอ ปลอดภัยกว่า)
   - ใต้ repo นั้น ที่ **Permissions → Repository permissions**:
     - `Contents` → **Read and write** ✅ (จำเป็น — สำหรับอ่าน/เขียน licenses.json)
     - `Metadata` → Read-only (ปกติเลือกให้อัตโนมัติ)
3. กด **Generate token** → **Copy** เก็บไว้ → ชื่อ **`GITHUB_TOKEN`** (ขึ้นต้น `github_pat_...`)

---

## ขั้นที่ 4 · Deploy บน Render

Render ต้องอ่านโค้ดจาก GitHub ก่อน → สร้าง repo ของตัวบอท:

1. https://github.com/new → Repository name = `vhagar-approve-bot` → Public → **Create** (ไม่ต้องติ๊ก README)
2. อัปโหลดไฟล์ทั้ง 6 จากโฟลเดอร์นี้ (`vhagar-approve-bot`) ขึ้น repo:
   - `approve-bot.js`, `package.json`, `render.yaml`, `.gitignore`, `.env.example`, `README-setup.md`
   - วิธีง่ายสุด: ใน repo กด **uploading an existing file** → ลากไฟล์มาวางทั้งหมด → **Commit changes**
3. เปิด https://dashboard.render.com → **New +** → **Web Service**
   - เชื่อม GitHub repo `sixdayth/vhagar-approve-bot` (ถ้ายังไม่เชื่อมให้กด Configure เชื่อมก่อน)
   - ตั้งค่า:
     - **Runtime**: Node
     - **Build command**: `npm install`
     - **Start command**: `node approve-bot.js`
   - เลื่อนลง **Environment** → กด **Add Environment Variable** ใส่ทั้งหมดนี้:

| KEY | VALUE |
|-----|-------|
| `DISCORD_TOKEN` | token จากขั้น 2 |
| `GITHUB_TOKEN` | token จากขั้น 3 |
| `GITHUB_REPO` | `sixdayth/vhagarbot-licenses` |
| `GITHUB_FILE` | `licenses.json` |
| `GITHUB_BRANCH` | `main` |
| `ADMIN_USER_ID` | Discord User ID ของคุณ (ขั้น 2) |

   - **Plan** = Free → กด **Create Web Service**
4. รอ build ~1–2 นาที → เปิด **Log** ดูให้มีบรรทัด:
   - `ล็อกอินสำเร็จเป็น VhagarApprove#....` (แสดงว่าบอทต่อ Discord ติดแล้ว)
   - `✅ ลงคำสั่ง slash ... สำเร็จ`
5. คัดลอก **URL** ของบอทไว้ (บนสุดของหน้า เช่น `https://vhagar-approve-bot.onrender.com`) → ใช้ในขั้น 5

> ถ้า log ขึ้นว่า `used: DISCORD_TOKEN` หรือ token GitHub ผิด → กลับไปเช็คค่าใน Environment แล้วกด Manual Deploy ใหม่

---

## ขั้นที่ 5 · ตั้ง UptimeRobot ปลุกบอทกันหลับ

Render แผนฟรีจะหลับเมื่อไม่มีคนเรียก → UptimeRobot จะเคาะ URL ทุก 5 นาทีให้ตื่นตลอด

1. เปิด https://uptimerobot.com → ล็อกอิน (บัญชีเดิมที่เคยใช้ก็ได้)
2. ถ้ามี monitor ของ spiritvale เดิม → คลิก **⋮** → **Edit** → เปลี่ยน URL เป็น URL ใหม่ของบอท (ขั้น 4.5) → Save
   ถ้าไม่มี/จะสร้างใหม่ → **Add New Monitor**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `vhagar-approve-bot` (อะไรก็ได้)
   - **URL(s)**: `https://vhagar-approve-bot.onrender.com/health`
   - **Interval**: `5 minutes`
   - **Create Monitor**

ทีนี้บอทจะ online ตลอด ไม่หลับ เพื่อนกดใช้สิทธิ์ได้ทันที (ครั้งแรกหลัง deploy อาจหน่วง ~50 วิ เพราะ Render ปลุกตัว service)

---

## ขั้นที่ 6 · วิธีใช้งานจริง (ทุกวัน)

เพื่อนเปิด VhagarBot ครั้งแรก → เจอหน้าจอ "ส่งรหัสมาให้ dev" พร้อม **Machine Code 6 หลัก** → เพื่อนส่งโค้ดมาในห้อง Discord

คุณตอบในช่องเดียวกันได้เลย (พิมพ์เป็นข้อความธรรมดา หรือพิมพ์ `/` แล้วเลือก slash command ก็ได้):

```
!approve TT6EY4 เมจิ
```
→ บอทตอบ `✅ อนุมัติ TT6EY4 ให้ เมจิ ♾️ ไม่หมดอายุ`

อยากจำกัดวันใช้งาน (เช่น 30 วัน):
```
!approve TT6EY4 เมจิ 30
```

คำสั่งอื่น ๆ:

| คำสั่ง | ทำอะไร |
|--------|--------|
| `!approve <โค้ด> [ชื่อ] [จำนวนวัน]` | อนุมัติ / ต่ออายุ |
| `!revoke <โค้ด>` | ระงับสิทธิ์ทันที (ยังไม่ลบ) |
| `!enable <โค้ด>` | เปิดคืนหลัง revoke |
| `!remove <โค้ด>` | ลบออกจากรายการ |
| `!list` | ดูทุกรหัสที่อนุมัติ |
| `!check <โค้ด>` | เช็คว่าโค้ดนี้สถานะอะไร |

หลังอนุมัติ เพื่อนแค่ **ปิดแล้วเปิด VhagarBot ใหม่** (หรือบอทตรวจรอบถัดไป) ก็ใช้งานได้ — เพราะ VhagarBot อ่านไฟล์ `licenses.json` เดียวกันจาก GitHub

---

## เชื่อมต่อกับ VhagarBot ยังไง (ให้ผู้พัฒนา/ตัวเองอ่าน)

ใน `buildinfo.js` ของ VhagarBot มีฟิลด์ `licenseUrl` ชี้ไปยัง **raw URL** ของ licenses.json:

```
https://raw.githubusercontent.com/sixdayth/vhagarbot-licenses/main/licenses.json
```

- **บอทอนุมัติ** (ตัวนี้) = คน *เขียน* ไฟล์นั้น (ผ่าน GitHub API)
- **VhagarBot** = คน *อ่าน* ไฟล์นั้น (ผ่าน raw URL ด้านบน)

ทั้งสองฝั่งใช้ไฟล์เดียวกัน → อนุมัติปุ๊บ มีผลปั๊บ (GitHub raw อาจหน่วง ~1–5 นาที)

---

## ❓ ปัญหาที่เจอบ่อย

- **บอทไม่ตอบในแชท** → เช็คขั้น 2 ว่าเปิด *MESSAGE CONTENT INTENT* หรือยัง + `ADMIN_USER_ID` ตรงกับคุณไหม (ใส่ผิด → บอทจะปฏิเสธคุณเอง)
- **`GitHub อ่านไฟล์ไม่สำเร็จ HTTP 403/404`** → token ผิด/ไม่มีสิทธิ์, หรือยังไม่ได้สร้างไฟล์ `licenses.json`, หรือ `GITHUB_REPO` พิมพ์ผิด
- **log ขึ้น `Cannot find module 'discord.js'`** → Build command ต้องเป็น `npm install`
- **เข้าครั้งแรกช้า ~50 วิ** → ปกติของ Render ฟรี (UptimeRobot จะช่วยลดความถี่)
- **เปลี่ยน token ภายหลัง** → ใน Render: service → Environment → แก้ค่า → **Apply** แล้วมัน deploy ใหม่เอง

---

## 🧪 (ไม่บังคับ) ทดสอบในเครื่องตัวเองก่อนขึ้น Render

ติดตั้ง Node.js แล้วในโฟลเดอร์นี้:

```
npm install
copy .env.example .env      (แล้วแก้ .env ใส่ค่าจริง)
node approve-bot.js
```

เห็น `ล็อกอินสำเร็จ` = พร้อมนำไป deploy จริง (Render ไม่ต้องมีไฟล์ .env — ใส่ในหน้า Environment แทน)
