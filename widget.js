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

let db = null, err = '';
try {
  const r = new Request(`https://api.github.com/repos/${REPO}/contents/data.json`);
  r.headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json' };
  db = JSON.parse(await r.loadString());
  if (!db.rounds) throw new Error('キーを確かめてください');
} catch (e) { err = token ? '読み込めませんでした' : 'Scriptableで一度開いてキーを入れてください'; }

const w = new ListWidget();
w.backgroundColor = C.bg;
w.url = 'https://tkwkt123-ops.github.io/markers/';
w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
const fam = config.widgetFamily || 'medium';

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
    text(b, latest ? latest.course.replace(/【.*?】|（.*?）/g, '') : '', 10, C.soft);
  }
}

if (config.runsInWidget) Script.setWidget(w);
else if (fam === 'small') await w.presentSmall(); else await w.presentMedium();
Script.complete();
