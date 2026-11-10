// Markers のウィジェット（Scriptable用）。Scriptableに貼ったスクリプトが、毎回これを読み込んで動かす
const REPO = 'tkwkt123-ops/markers-data';
const C = { bg: new Color('#f5f5f5'), card: new Color('#ffffff'), ink: new Color('#3d4441'), soft: new Color('#a2a8a5'), sage: new Color('#79a694'), salmon: new Color('#f4b097'), deep: new Color('#ea9f86') };

// GitHubのキー（iPhoneのキーチェーンに保存。最初の1回だけ聞く）
let token = Keychain.contains('markers-token') ? Keychain.get('markers-token') : '';
if (!token && !config.runsInWidget) {
  const a = new Alert(); a.title = 'GitHubのキー'; a.message = 'Markersで使っているキー（github_pat_…）を貼り付けてください';
  a.addSecureTextField('github_pat_…'); a.addAction('保存'); a.addCancelAction('やめる');
  if (await a.present() === 0) { token = a.textFieldValue(0).trim(); Keychain.set('markers-token', token); }
}

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date(), today = ymd(now), month = today.slice(0, 7);
const fam = config.widgetFamily || 'medium';

let db = null, err = '';
try {
  const r = new Request(`https://api.github.com/repos/${REPO}/contents/data.json`);
  r.headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json' };
  db = JSON.parse(await r.loadString());
  if (!db.rounds) throw new Error('キーを確かめてください');
} catch (e) { err = token ? '読み込めませんでした' : 'Scriptableで一度開いてキーを入れてください'; }


function text(stack, s, size, color, weight = 'regular') {
  const t = stack.addText(String(s));
  t.font = weight === 'bold' ? Font.boldRoundedSystemFont(size) : weight === 'medium' ? Font.mediumRoundedSystemFont(size) : Font.regularRoundedSystemFont(size);
  t.textColor = color; t.lineLimit = 1; t.minimumScaleFactor = 0.6;
  return t;
}
function card(parent) {
  const c = parent.addStack(); c.layoutVertically(); c.backgroundColor = C.card; c.cornerRadius = 16; c.setPadding(10, 12, 10, 12);
  return c;
}

// ===== 週のカレンダー（中サイズのふだんの表示）。ウィジェットの「Parameter」に「まとめ」と入れると前の表示 =====
const BASE = 'https://tkwkt123-ops.github.io/markers/';
const fm = FileManager.local();
async function stickerImage(name) {
  const f = fm.joinPath(fm.cacheDirectory(), 'markers-' + name);
  if (fm.fileExists(f)) return fm.readImage(f);
  const img = await new Request(BASE + 'stickers/' + name).loadImage();
  fm.writeImage(f, img); return img;
}
function hashStr(t) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function coinColor(t) { return t < 90 ? '#ea9f86' : t < 95 ? '#f4b097' : t < 100 ? '#79a694' : t < 105 ? '#9dbcaf' : t < 110 ? '#b9c6c0' : '#cfd2d0'; }
async function dayImage(day, info) {
  const S = 120, dc = new DrawContext(); dc.size = new Size(S, S); dc.opaque = false; dc.respectScreenScale = true;
  const circle = (r, color) => { dc.setFillColor(new Color(color)); dc.fillEllipse(new Rect(S / 2 - r, S / 2 - r, r * 2, r * 2)); };
  const label = (t, color, size, bold) => { dc.setTextAlignedCenter(); dc.setTextColor(new Color(color)); dc.setFont(bold ? Font.boldRoundedSystemFont(size) : Font.mediumRoundedSystemFont(size)); dc.drawTextInRect(String(t), new Rect(0, S / 2 - size * 0.62, S, size * 1.4)); };
  if (info.round) { circle(50, '#ffffff'); circle(40, coinColor(info.round)); label(info.round, '#ffffff', 38, true); }
  else if (info.sticker) { dc.drawImageInRect(await stickerImage(info.sticker), new Rect(4, 4, S - 8, S - 8)); }
  else if (info.rest) { circle(46, '#e7ebe9'); dc.setFillColor(new Color('#9dbcaf')); dc.fillEllipse(new Rect(38, 34, 44, 44)); dc.setFillColor(new Color('#e7ebe9')); dc.fillEllipse(new Rect(50, 28, 40, 40)); }
  else label(day.getDate(), info.future ? '#c9cccb' : '#a2a8a5', 36, info.today);
  if (info.today) { dc.setFillColor(new Color('#79a694')); for (let a = 0; a < 360; a += 15) { const x = S / 2 + 56 * Math.cos(a * Math.PI / 180), y = S / 2 + 56 * Math.sin(a * Math.PI / 180); dc.fillEllipse(new Rect(x - 2.6, y - 2.6, 5.2, 5.2)); } }
  return dc.getImage();
}
async function calendarWidget() {
  const w = new ListWidget(); w.backgroundColor = new Color('#fbfbfa'); w.url = BASE; w.setPadding(14, 12, 12, 12);
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  if (!db) { text(w, 'Markers', 14, C.sage, 'bold'); w.addSpacer(6); text(w, err, 12, C.soft); return w; }
  const ps = db.practices || [], rounds = db.rounds || [], rests = db.rests || [];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const weekMin = ps.filter(p => days.some(d => ymd(d) === p.date)).reduce((a, p) => a + (p.minutes || 0), 0);
  const weekCnt = ps.filter(p => days.some(d => ymd(d) === p.date)).length;
  const head = w.addStack(); head.centerAlignContent();
  text(head, `${now.getFullYear()}年 ${now.getMonth() + 1}月`, 14, C.ink, 'bold'); head.addSpacer();
  text(head, weekCnt ? `今週 ${Math.round(weekMin / 6) / 10}時間・${weekCnt}回` : '今週の練習はまだ', 11, C.soft, 'medium');
  w.addSpacer(10);
  const row = w.addStack();
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  for (const [i, d] of days.entries()) {
    const k = ymd(d), isToday = k === today;
    const r = rounds.filter(x => x.date === k && x.holes && x.holes.every(h => h.score != null)).pop();
    const p = ps.filter(x => x.date === k).pop();
    const info = { today: isToday, future: k > today, rest: rests.includes(k),
      round: r ? r.holes.reduce((a, h) => a + h.score, 0) : null,
      sticker: p ? `m${+k.slice(5, 7)}-${hashStr(p.id) % 5}.png` : null };
    const col = row.addStack(); col.layoutVertically(); col.centerAlignContent();
    const lw = col.addStack(); lw.addSpacer(); text(lw, WD[i], 11, isToday ? C.sage : C.soft, isToday ? 'bold' : 'medium'); lw.addSpacer();
    col.addSpacer(6);
    const iw = col.addStack(); iw.addSpacer(); const im = iw.addImage(await dayImage(d, info)); im.imageSize = new Size(38, 38); iw.addSpacer();
    if (i < 6) row.addSpacer();
  }
  return w;
}
const param = (args.widgetParameter || '').trim();
let w;
if (fam === 'medium' && param !== 'まとめ') w = await calendarWidget();
else {
w = new ListWidget();
w.backgroundColor = C.bg;
w.url = 'https://tkwkt123-ops.github.io/markers/';
w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

if (!db) {
  text(w, 'Markers', 14, C.sage, 'bold'); w.addSpacer(6); text(w, err, 12, C.soft);
} else {
  const ps = db.practices || [], rs = (db.rounds || []).filter(r => r.holes && r.holes.every(h => h.score != null));
  const total = r => r.holes.reduce((a, h) => a + h.score, 0);
  const mp = ps.filter(p => p.date.startsWith(month));
  const hours = Math.round(mp.reduce((a, p) => a + (p.minutes || 0), 0) / 6) / 10;
  const lastP = ps.map(p => p.date).sort().pop();
  const days = lastP ? Math.round((new Date(today) - new Date(lastP)) / 864e5) : null;
  const latest = [...rs].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const best = rs.reduce((b, r) => !b || total(r) < total(b) ? r : b, null);
  const todayDone = [...(db.rounds || []), ...ps].some(x => x.date === today);
  const rest = (db.rests || []).includes(today);
  const status = todayDone ? ['今日の記録あり', C.sage] : rest ? ['今日は休み', C.soft] : ['今日の記録がまだ', C.deep];
  const md = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;

  const head = w.addStack(); head.centerAlignContent();
  text(head, 'Markers', 12, C.sage, 'bold'); head.addSpacer();
  const dot = head.addText('●'); dot.font = Font.systemFont(8); dot.textColor = status[1];
  head.addSpacer(4); text(head, status[0], 10, status[1], 'medium');
  w.addSpacer(8);

  if (fam === 'small') {
    const c = card(w);
    text(c, '今月の練習', 10, C.soft, 'medium');
    const row = c.addStack(); row.bottomAlignContent();
    text(row, hours, 30, C.ink, 'bold'); row.addSpacer(2); text(row, '時間', 11, C.soft);
    text(c, `${mp.length}回${days != null ? `・${days === 0 ? '今日' : days + '日前'}` : ''}`, 11, C.soft);
  } else {
    const row = w.addStack(); row.spacing = 8;
    const a = card(row);
    text(a, '今月の練習', 10, C.soft, 'medium');
    const ar = a.addStack(); ar.bottomAlignContent();
    text(ar, hours, 28, C.ink, 'bold'); ar.addSpacer(2); text(ar, '時間', 11, C.soft);
    text(a, `${mp.length}回${days != null ? `・最後は${days === 0 ? '今日' : days + '日前'}` : ''}`, 10, C.soft);
    const b = card(row);
    text(b, latest ? `最新 ${md(latest.date)}` : '最新', 10, C.soft, 'medium');
    const br = b.addStack(); br.bottomAlignContent();
    text(br, latest ? total(latest) : '–', 28, C.salmon, 'bold'); br.addSpacer(4);
    text(br, best ? `ベスト ${total(best)}` : '', 10, C.soft);
    text(b, latest ? (latest.course || '').replace(/【.*?】|（.*?）/g, '') : '', 10, C.soft);
  }
}

}

if (config.runsInWidget) Script.setWidget(w);
else if (fam === 'small') await w.presentSmall(); else await w.presentMedium();
Script.complete();
