/* ============================================================
 *  VhagarBot Approve Bot  (discord.js v14)
 * ------------------------------------------------------------
 *  หน้าที่: ให้เจ้าของ (คุณ) พิมพ์คำสั่งในห้อง Discord แล้วบอท
 *  จะแก้ไฟล์ licenses.json บน GitHub ให้อัตโนมัติ — เพื่อนแค่ส่ง
 *  Machine Code 6 หลักมา คุณก็ !approve ตามด้วยโค้ดได้เลย
 *
 *  คำสั่ง (พิมพ์ใน Discord):
 *    !approve <CODE> [ชื่อเพื่อน] [จำนวนวัน]
 *        → อนุมัติโค้ด  เช่น  !approve TT6EY4 เมจิ 30
 *          ไม่ระบุวัน = ไม่หมดอายุ
 *    !revoke  <CODE>   → ระงับ usage (ปิดใช้งานทันที แต่ยังไม่ลบ)
 *    !enable  <CODE>   → เปิดคืนหลังจาก revoke
 *    !remove  <CODE>   → ลบโค้ดออกจากไฟล์
 *    !list             → โชว์รายการที่อนุมัติทั้งหมด
 *    !check   <CODE>   → เช็คสถานะโค้ดเดียว
 *
 *  ต้องตั้ง Environment Variables (ใส่ใน Render / หรือ .env ตอนทดสอบ):
 *    DISCORD_TOKEN   = token ของบอท (Discord Developer Portal)
 *    GITHUB_TOKEN    = Fine-grained PAT ที่มีสิทธิ์ Contents:RW ใน repo licenses
 *    GITHUB_REPO     = "sixdayth/vhagarbot-licenses"  (เจ้าของ/ชื่อrepo)
 *    GITHUB_FILE     = "licenses.json"                 (พาธไฟล์ใน repo)
 *    GITHUB_BRANCH   = "main"                          (branches อื่นก็ใส่ได้)
 *    ADMIN_USER_ID   = (แนะนำ) Discord User ID ของคุณ — ใส่แล้วจะมีแค่คุณที่ใช้คำสั่งได้
 *    PORT            = Render ใส่ให้อัตโนมัติ (ไว้เปิด HTTP ปลุกบอทกันหลับ)
 *
 *  หมายเหตุ intents: ต้องเปิด "Message Content Intent" ใน Discord Developer Portal
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, REST, Routes, Events } = require('discord.js');

// ---------- โหลด .env (ถ้ามี ไว้ทดสอบเครื่องตัวเอง) ----------
try { loadDotEnv(path.join(__dirname, '.env')); } catch (e) {}
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

// ---------- อ่านค่า config ----------
const CFG = {
  discordToken: process.env.DISCORD_TOKEN || '',
  ghToken: process.env.GITHUB_TOKEN || '',
  ghRepo: process.env.GITHUB_REPO || 'sixdayth/vhagarbot-licenses',
  ghFile: process.env.GITHUB_FILE || 'licenses.json',
  ghBranch: process.env.GITHUB_BRANCH || 'main',
  adminId: process.env.ADMIN_USER_ID || '',
  prefix: process.env.PREFIX || '!',
};

const API = 'https://api.github.com/repos/' + CFG.ghRepo + '/contents/' + CFG.ghFile;
const RAW = 'https://raw.githubusercontent.com/' + CFG.ghRepo + '/' + CFG.ghBranch + '/' + CFG.ghFile;

const B32 = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function validCode(c) {
  return typeof c === 'string' && c.length === 6 && c.split('').every((ch) => B32.includes(ch));
}
function normCode(c) { return (c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function ghHeaders() {
  return {
    Authorization: 'Bearer ' + CFG.ghToken,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'vhagar-approve-bot',
    'Content-Type': 'application/json',
  };
}

// ---------- อ่าน licenses.json จาก GitHub (ได้ content + sha) ----------
async function readLicenses() {
  const res = await fetch(API + '?ref=' + encodeURIComponent(CFG.ghBranch) + '&t=' + Date.now(), {
    headers: ghHeaders(), cache: 'no-store',
  });
  if (res.status === 404) {
    // ไฟล์ยังไม่มี → สร้างใหม่
    return { doc: { licenses: {} }, sha: null };
  }
  if (!res.ok) throw new Error('GitHub อ่านไฟล์ไม่สำเร็จ HTTP ' + res.status);
  const j = await res.json();
  let doc;
  try {
    doc = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
  } catch (e) {
    throw new Error(' licenses.json ใน GitHub ไม่ใช่ JSON ที่ถูกต้อง');
  }
  if (!doc.licenses) doc.licenses = {};
  return { doc, sha: j.sha };
}

// ---------- เขียน licenses.json กลับ GitHub ----------
async function writeLicenses(doc, sha, msg) {
  const body = JSON.stringify(doc, null, 2);
  const payload = {
    message: msg,
    content: Buffer.from(body, 'utf8').toString('base64'),
    branch: CFG.ghBranch,
  };
  if (sha) payload.sha = sha;
  const res = await fetch(API, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(payload) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('GitHub เขียนไฟล์ไม่สำเร็จ HTTP ' + res.status + ' ' + t.slice(0, 200));
  }
  const j = await res.json();
  return j.content && j.content.sha;
}

function nowDate() { return new Date().toISOString().slice(0, 10); }
function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ============================================================
//  คำสั่งต่าง ๆ
// ============================================================
async function cmdApprove(code, name, days) {
  const { doc, sha } = await readLicenses();
  const entry = doc.licenses[code] || {};
  entry.user = name || entry.user || '(ไม่ระบุ)';
  entry.created = entry.created || nowDate();
  entry.expires = days ? addDays(days) : '';
  entry.disabled = false;
  doc.licenses[code] = entry;
  await writeLicenses(doc, sha, 'approve ' + code + ' (' + entry.user + ')');
  return '✅ อนุมัติ `' + code + '` ให้ ' + entry.user +
    (days ? '\n⏳ หมดอายุใน ' + days + ' วัน (' + entry.expires + ')' : '\n♾️ ไม่หมดอายุ');
}

async function cmdRevoke(code) {
  const { doc, sha } = await readLicenses();
  if (!doc.licenses[code]) return '⚠️ ไม่พบ `' + code + '` ในรายการ';
  doc.licenses[code].disabled = true;
  await writeLicenses(doc, sha, 'revoke ' + code);
  return '🚫 ระงับ `' + code + '` แล้ว (บอทฝั่งเพื่อนจะใช้ไม่ได้ในการตรวจครั้งถัดไป)';
}

async function cmdEnable(code) {
  const { doc, sha } = await readLicenses();
  if (!doc.licenses[code]) return '⚠️ ไม่พบ `' + code + '` ในรายการ';
  doc.licenses[code].disabled = false;
  await writeLicenses(doc, sha, 'enable ' + code);
  return '🔓 เปิดใช้งาน `' + code + '` คืนแล้ว';
}

async function cmdRemove(code) {
  const { doc, sha } = await readLicenses();
  if (!doc.licenses[code]) return '⚠️ ไม่พบ `' + code + '` ในรายการ';
  delete doc.licenses[code];
  await writeLicenses(doc, sha, 'remove ' + code);
  return '🗑️ ลบ `' + code + '` ออกจากไฟล์แล้ว';
}

async function cmdList() {
  const { doc } = await readLicenses();
  const keys = Object.keys(doc.licenses);
  if (!keys.length) return 'ไม่มีโค้ดที่อนุมัติเลย';
  const now = Date.now();
  const lines = keys.map((k) => {
    const e = doc.licenses[k] || {};
    let st = 'ปกติ';
    if (e.disabled) st = '🚫ระงับ';
    else if (e.expires && new Date(e.expires).getTime() < now) st = '⌛หมดอายุ';
    return '`' + k + '` ' + (e.user || '-') + ' | ' + (e.expires || '♾️') + ' | ' + st;
  });
  const text = '📋 มีทั้งหมด ' + keys.length + ' โค้ด:\n' + lines.join('\n');
  return text.length > 1990 ? text.slice(0, 1990) + '\n…' : text;
}

async function cmdCheck(code) {
  const { doc } = await readLicenses();
  const e = doc.licenses[code];
  if (!e) return 'ไม่พบ `' + code + '` ในรายการ';
  return '🔎 `' + code + '`\nชื่อ: ' + (e.user || '-') + '\nสร้าง: ' + (e.created || '-') +
    '\nหมดอายุ: ' + (e.expires || 'ไม่หมดอายุ') + '\nสถานะ: ' + (e.disabled ? '🚫 ถูกระงับ' : '✅ ปกติ');
}

// ============================================================
//  ตั้งค่า + เริ่มบอท
// ============================================================
const SLASH = [
  { name: 'approve', desc: 'อนุมัติ Machine Code', opts: [
    { n: 'code', d: 'รหัส 6 หลัก', r: true },
    { n: 'name', d: 'ชื่อเพื่อน (เว้นได้)', r: false },
    { n: 'days', d: 'จำนวนวันหมดอายุ (เว้นได้)', r: false },
  ] },
  { name: 'revoke', desc: 'ระงับโค้ด', opts: [{ n: 'code', d: 'รหัส 6 หลัก', r: true }] },
  { name: 'enable', desc: 'เปิดคืนโค้ด', opts: [{ n: 'code', d: 'รหัส 6 หลัก', r: true }] },
  { name: 'remove', desc: 'ลบโค้ด', opts: [{ n: 'code', d: 'รหัส 6 หลัก', r: true }] },
  { name: 'list', desc: 'โชว์ทุกรหัส', opts: [] },
  { name: 'check', desc: 'เช็คสถานะ 1 รหัส', opts: [{ n: 'code', d: 'รหัส 6 หลัก', r: true }] },
];

function clientReady() {
  console.log('[VhagarBot Approve] ล็อกอินสำเร็จเป็น ' + TAG);
  console.log('GitHub repo : ' + CFG.ghRepo + ' / ' + CFG.ghFile + ' @ ' + CFG.ghBranch);
  console.log('Raw URL     : ' + RAW);
  console.log('Admin       : ' + (CFG.adminId ? CFG.adminId : '(ทุกคนในห้องที่ bot เห็น — ควรใส่ ADMIN_USER_ID)'));
}

const PREFIX = CFG.prefix;

const CMD_SET = new Set(['approve', 'revoke', 'enable', 'remove', 'list', 'check']);

async function handle(text) {
  // รองรับทั้ง "!approve ..." (พิมพ์) และ "/approve ..." (slash ที่แปลงมาแล้ว)
  const raw = text.trim();
  const head0 = raw.split(/\s+/)[0] || '';
  const cmd = head0.replace(/^[!\/]/, '').toLowerCase();
  if (!CMD_SET.has(cmd)) return null; // ไม่ใช่คำสั่งเรา → ไม่ทำอะไร
  const args = raw.split(/\s+/).slice(1);
  try {
    if (cmd === 'approve') {
      const code = normCode(args[0]);
      if (!validCode(code)) return 'รูปแบบโค้ดไม่ถูก ต้อง 6 ตัวจากชุด `' + B32 + '`\nตัวอย่าง: `' + PREFIX + 'approve TT6EY4 เมจิ 30`';
      const rest = args.slice(1);
      let days = null;
      if (rest.length && /^\d+$/.test(rest[rest.length - 1])) {
        days = parseInt(rest.pop(), 10);
      }
      const name = rest.join(' ').trim();
      return await cmdApprove(code, name, days);
    }
    if (cmd === 'revoke') { const c = normCode(args[0]); return validCode(c) ? await cmdRevoke(c) : 'โค้ดไม่ถูกต้อง'; }
    if (cmd === 'enable') { const c = normCode(args[0]); return validCode(c) ? await cmdEnable(c) : 'โค้ดไม่ถูกต้อง'; }
    if (cmd === 'remove') { const c = normCode(args[0]); return validCode(c) ? await cmdRemove(c) : 'โค้ดไม่ถูกต้อง'; }
    if (cmd === 'list') return await cmdList();
    if (cmd === 'check') { const c = normCode(args[0]); return validCode(c) ? await cmdCheck(c) : 'โค้ดไม่ถูกต้อง'; }
  } catch (e) {
    console.error('[VhagarBot Approve] command error', e);
    return '⚠️ เกิดข้อผิดพลาด: ' + e.message;
  }
  return null;
}

async function registerSlash(client) {
  try {
    const body = SLASH.map((s) => ({
      name: s.name,
      description: s.desc,
      options: (s.opts || []).map((o) => ({
        name: o.n, description: o.d, type: 3, required: !!o.r,
      })),
    }));
    await client.application.commands.set(body);
    console.log('✅ ลงคำสั่ง slash (' + SLASH.length + ' ตัว) ระดับ global สำเร็จ');
  } catch (e) {
    console.error('⚠️ ลง slash commands ไม่สำเร็จ (ยังเป็นแบบ !คำสั่งได้ปกติ):', e.message);
  }
}

let TAG = 'VhagarBot Approve';

function isAllowed(user) {
  if (!CFG.adminId) return true; // ไม่ได้ตั้ง → ใครในห้องที่ bot เห็นก็ใช้ได้
  return user && user.id === CFG.adminId;
}

async function start() {
  process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e && e.stack ? e.stack : e));
  process.on('uncaughtException', (e) => console.error('[uncaughtException]', e && e.stack ? e.stack : e));

  if (!CFG.discordToken) { console.error('[boot] DISCORD_TOKEN ว่างเปล่า'); process.exit(1); }
  if (!CFG.ghToken) { console.error('[boot] GITHUB_TOKEN ว่างเปล่า'); process.exit(1); }

  // --- log วินิจฉัยตอนบูต (ASCII ล้วน ๆ กัน log ตกหล่น) ---
  const dt = CFG.discordToken;
  console.log('[boot] node=' + process.version +
    ' DISCORD_TOKEN len=' + dt.length + ' head=' + dt.slice(0, 4) + '...' + dt.slice(-3) +
    ' GITHUB_TOKEN len=' + CFG.ghToken.length +
    ' ADMIN=' + (CFG.adminId || '(none)') +
    ' repo=' + CFG.ghRepo);

  // HTTP server เล็ก ๆ ให้ Render มองว่าบริการนี้ "เป็นเว็บ" + UptimeRobot ปลุกได้
  const PORT = process.env.PORT || 8080;
  http.createServer((req, res) => {
    const ok = { status: 'up', app: 'vhagar-approve-bot', time: new Date().toISOString(), repo: CFG.ghRepo };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ok));
  }).listen(PORT, '0.0.0.0', () => console.log('[keepalive] HTTP server on port ' + PORT));

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

  client.once(Events.ClientReady, async (c) => {
    TAG = c.user.tag;
    clientReady();
    await registerSlash(c);
  });

  // คำสั่งแบบพิมพ์ข้อความปกติ (!approve ...)
  client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot) return;
    const t = msg.content || '';
    if (!t.startsWith(PREFIX)) return;
    if (!isAllowed(msg.author)) return msg.reply('🔒 เฉพาะเจ้าของเท่านั้นที่ใช้คำสั่งนี้ได้');
    const out = await handle(t);
    if (out) msg.channel.send(out).catch(() => {});
  });

  // คำสั่งแบบ slash (/approve ...)
  client.on(Events.InteractionCreate, async (it) => {
    if (!it.isChatInputCommand()) return;
    if (!isAllowed(it.user)) return it.reply({ content: '🔒 เฉพาะเจ้าของเท่านั้น', ephemeral: true });
    let fake = '/' + it.commandName;
    for (const o of (it.options.data || [])) fake += ' ' + o.value;
    const out = await handle(fake.replace('/', PREFIX));
    if (out) {
      if (it.deferred || it.replied) it.followUp(out).catch(() => {});
      else it.reply({ content: out, allowedMentions: { parse: [] } }).catch(() => {});
    }
  });

  client.on(Events.Error, (e) => console.error('[discord error]', e && e.stack ? e.stack : e));
  client.on(Events.ShardDisconnect, (e, code) => console.error('[shard disconnect] code=' + code + ' reason=' + (e && e.reason)));
  client.on(Events.ShardError, (e) => console.error('[shard error]', e && e.message ? e.message : e));
  console.log('[boot] กำลัง login ไป Discord...');
  await client.login(CFG.discordToken);
  console.log('[boot] login() ส่ง token สำเร็จ กำลังรอ READY...');

  // ถ้า 20 วิแล้วยังไม่ READY = มีปัญหาที่ gateway (token/intent/เน็ต)
  setTimeout(() => {
    if (!client.isReady()) console.error('[watchdog] ผ่าน 20 วิ แล้วยังไม่ READY — บอทต่อ Discord ไม่ติด');
  }, 20000);

  // ปิดบอทแบบนุ่มนวลเมื่อ Render ส่ง SIGTERM (ตอน redeploy)
  const bye = () => { try { client.destroy(); } catch (e) {} process.exit(0); };
  process.on('SIGTERM', bye);
  process.on('SIGINT', bye);
}

start().catch((e) => { console.error('fatal', e); process.exit(1); });
