const $ = id => document.getElementById(id);
let S = null, T = null, toastT;

/* ---- helpers ---- */
function toast(msg, ok) { const t = $('toast'); t.textContent = msg; t.className = 'show' + (ok ? ' ok' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = '', 3500); }
async function send(c) { const r = await window.api.cmd(c); if (r && r.error) toast(r.error); return r; }
const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmt = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function readImage(file, maxBytes, label) {
  return new Promise(res => {
    if (!file) return res(null);
    if (file.size > maxBytes) { toast(`${label} must be ${maxBytes / 1048576} MB or smaller (yours is ${(file.size / 1048576).toFixed(1)} MB).`); return res(null); }
    const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file);
  });
}

/* ---- tabs ---- */
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#tabs button, .tab').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); $('tab-' + b.dataset.tab).classList.add('on');
});

/* ---- timer tab ---- */
$('title').addEventListener('input', debounce(() => send({ type: 'setText', title: $('title').value })));
$('moderator').addEventListener('input', debounce(() => send({ type: 'setText', moderator: $('moderator').value })));
$('btnSet').onclick = () => send({ type: 'setTime', minutes: $('min').value, seconds: $('sec').value });
$('btnStart').onclick = () => send({ type: T && T.running ? 'pause' : 'start' });
$('btnReset').onclick = () => send({ type: 'reset' });
$('btnPlus').onclick = () => send({ type: 'adjust', delta: 60000 });
$('btnMinus').onclick = () => send({ type: 'adjust', delta: -60000 });
$('btnOpen').onclick = () => send({ type: 'openOutput', displayId: Number($('displaySel').value) });
$('btnClose').onclick = () => send({ type: 'closeOutput' });
window.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); $('btnStart').click(); }
});

/* ---- schedule tab ---- */
$('sAdd').onclick = async () => {
  const r = await send({ type: 'scheduleAdd', title: $('sTitle').value, moderator: $('sMod').value, start: $('sStart').value, minutes: $('sMin').value, seconds: $('sSec').value });
  if (r.ok) { $('sTitle').value = ''; $('sMod').value = ''; $('sTitle').focus(); }
};
$('sNext').onclick = () => send({ type: 'next' });
$('sNextGo').onclick = () => send({ type: 'next', autostart: true });
$('sPrev').onclick = () => send({ type: 'prev' });
$('auto').onchange = e => send({ type: 'setAuto', value: e.target.checked });
$('sBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.dataset.id;
  if (b.dataset.a === 'load') send({ type: 'scheduleLoad', id });
  if (b.dataset.a === 'go') send({ type: 'scheduleLoad', id, autostart: true });
  if (b.dataset.a === 'up') send({ type: 'scheduleMove', id, dir: -1 });
  if (b.dataset.a === 'down') send({ type: 'scheduleMove', id, dir: 1 });
  if (b.dataset.a === 'del') send({ type: 'scheduleRemove', id });
});

/* ---- appearance tab ---- */
$('fontAdd').onclick = async () => { const n = $('fontPick').value.trim(); if (!n) return; if ((await send({ type: 'addFont', name: n })).ok) $('fontPick').value = ''; };
$('fontChips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) send({ type: 'removeFont', name: b.dataset.f }); });
const fontSel = { fTitle: 'title', fTimer: 'timer', fModerator: 'moderator', fDate: 'date' };
for (const [id, key] of Object.entries(fontSel)) $(id).onchange = e => send({ type: 'setStyle', patch: { fonts: { [key]: e.target.value } } });
$('textColor').onchange = e => send({ type: 'setStyle', patch: { textColor: e.target.value } });
$('bgColor').onchange = e => send({ type: 'setStyle', patch: { bgColor: e.target.value } });
$('bgFit').onchange = e => send({ type: 'setStyle', patch: { bgFit: e.target.value } });
$('logoFile').onchange = async e => { const d = await readImage(e.target.files[0], 1048576, 'Logo'); e.target.value = ''; if (d) send({ type: 'setStyle', patch: { logo: d } }); };
$('bgFile').onchange = async e => { const d = await readImage(e.target.files[0], 8 * 1048576, 'Background'); e.target.value = ''; if (d) send({ type: 'setStyle', patch: { bgImage: d } }); };
$('logoClear').onclick = () => send({ type: 'setStyle', patch: { logo: '' } });
$('bgClear').onclick = () => send({ type: 'setStyle', patch: { bgImage: '' } });

/* ---- support tab ---- */
$('licGo').onclick = async () => { const r = await send({ type: 'activate', key: $('licKey').value }); if (r.ok) { toast('Paid features unlocked. Thank you!', true); $('licKey').value = ''; } };
$('licOff').onclick = () => send({ type: 'deactivate' });

/* ---- render ---- */
function setIfIdle(el, v) { if (document.activeElement !== el) el.value = v; }
let lastSched = '';
function render() {
  if (!S) return;
  setIfIdle($('title'), S.title); setIfIdle($('moderator'), S.moderator);
  if (!document.activeElement || !['min', 'sec'].includes(document.activeElement.id)) {
    $('min').value = Math.floor(S.totalMs / 60000); $('sec').value = Math.floor((S.totalMs % 60000) / 1000);
  }
  $('auto').checked = S.autoAdvance;
  $('badge').textContent = S.licensed ? 'Paid' : 'Free'; $('badge').classList.toggle('paid', S.licensed);
  $('licStatus').textContent = S.licensed ? `Paid version – licensed to ${S.licenseInfo.name}${S.licenseInfo.exp ? ' until ' + new Date(S.licenseInfo.exp).toLocaleDateString() : ''}` : 'Free version';
  renderExtras();
  // paid gating
  document.querySelector('.paidBlock').classList.toggle('locked', !S.licensed);
  document.querySelectorAll('.paidOnly').forEach(x => x.style.display = S.licensed ? 'none' : '');
  $('paidNote').style.display = S.licensed ? 'none' : '';
  $('bgColor').value = S.style.bgColor; $('bgFit').value = S.style.bgFit; $('textColor').value = S.style.textColor;
  // fonts
  $('fontCount').textContent = `${S.myFonts.length} of ${S.fontLimit} custom fonts used`;
  $('fontChips').innerHTML = S.myFonts.map(f => `<span class="chip">${esc(f)}<button data-f="${esc(f)}" aria-label="Remove ${esc(f)}">×</button></span>`).join('');
  const opts = ['Poppins', 'Montserrat', 'Bebas Neue', ...S.myFonts];
  for (const [id, key] of Object.entries(fontSel)) {
    const el = $(id); el.innerHTML = opts.map(f => `<option${f === S.style.fonts[key] ? ' selected' : ''}>${esc(f)}</option>`).join('');
  }
  // schedule (re-render only on change)
  const sig = JSON.stringify([S.schedule, S.activeId]);
  if (sig !== lastSched) {
    lastSched = sig;
    $('sEmpty').style.display = S.schedule.length ? 'none' : '';
    $('sBody').innerHTML = S.schedule.map(x => `<tr class="${x.id === S.activeId ? 'active' : ''}"><td>${esc(x.start || '–')}</td><td>${esc(x.title)}</td><td>${esc(x.moderator)}</td>
      <td>${String(x.minutes).padStart(2, '0')}:${String(x.seconds).padStart(2, '0')}</td>
      <td><button data-a="load" data-id="${x.id}">Load</button><button data-a="go" data-id="${x.id}">Start</button><button data-a="up" data-id="${x.id}" aria-label="Move up">↑</button><button data-a="down" data-id="${x.id}" aria-label="Move down">↓</button><button data-a="del" data-id="${x.id}">Delete</button></td></tr>`).join('');
  }
}
function renderTick() {
  if (!T) return;
  $('liveTime').textContent = T.timeUp ? 'TIME UP' : fmt(T.remainingMs);
  $('liveTime').style.color = T.timeUp ? '#ffbf00' : (T.remainingMs > 0 && T.remainingMs <= 300000 ? '#ff0000' : '');
  $('btnStart').textContent = T.running ? 'Pause' : (T.remainingMs > 0 && T.remainingMs < T.totalMs ? 'Resume' : 'Start');
}
const es = new EventSource('/events');
es.addEventListener('state', e => { S = JSON.parse(e.data); render(); });
es.addEventListener('tick', e => { T = JSON.parse(e.data); renderTick(); });

/* ---- system data ---- */
window.api.displays().then(list => { $('displaySel').innerHTML = list.map(d => `<option value="${d.id}">${esc(d.label)}</option>`).join(''); const ext = list[1]; if (ext) $('displaySel').value = ext.id; });
window.api.fonts().then(list => { $('sysfonts').innerHTML = list.map(f => `<option value="${esc(f)}">`).join(''); });

/* ---- languages (30). Tab labels translated for fr/es; add more in TX ---- */
const LANGS = { en: 'English', fr: 'Français', es: 'Español', pt: 'Português', de: 'Deutsch', it: 'Italiano', nl: 'Nederlands', ru: 'Русский', zh: '中文', ja: '日本語', ko: '한국어', ar: 'العربية', hi: 'हिन्दी', bn: 'বাংলা', ur: 'اردو', id: 'Indonesia', tr: 'Türkçe', vi: 'Tiếng Việt', th: 'ไทย', pl: 'Polski', uk: 'Українська', ro: 'Română', el: 'Ελληνικά', sv: 'Svenska', cs: 'Čeština', hu: 'Magyar', he: 'עברית', fa: 'فارسی', sw: 'Kiswahili', tl: 'Filipino' };
const TX = { fr: { timer: 'Minuteur', schedule: 'Programme', look: 'Apparence', account: 'Compte', support: 'Mise à niveau', feedback: 'Avis', updates: 'Mises à jour' },
  es: { timer: 'Temporizador', schedule: 'Programa', look: 'Apariencia', account: 'Cuenta', support: 'Mejorar', feedback: 'Opiniones', updates: 'Actualizaciones' } };
$('langSel').innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
const sys = (navigator.language || 'en').slice(0, 2); $('langSel').value = LANGS[sys] ? sys : 'en';
function applyLang(l) {
  document.documentElement.lang = l; document.documentElement.dir = ['ar', 'he', 'fa', 'ur'].includes(l) ? 'rtl' : 'ltr';
  document.querySelectorAll('#tabs button').forEach(b => { b.dataset.en = b.dataset.en || b.textContent; b.textContent = (TX[l] && TX[l][b.dataset.tab]) || b.dataset.en; });
}
$('langOk').onclick = async () => { await send({ type: 'setLang', lang: $('langSel').value }); $('mLang').classList.remove('on'); };
$('langChange').onclick = () => { $('langSel').value = S.lang || 'en'; $('mLang').classList.add('on'); };
/* ---- account ---- */
const srv = (p, b) => window.api.srv(p, b);
async function signup(name, email) { const r = await srv('/signup', { name, email }); if (r.error) toast(r.error); else toast(r.offline ? 'Saved. We will sync when you are online.' : 'Account created.', true); return r; }
$('sOk').onclick = async () => { const r = await signup($('sName').value, $('sEmail').value); if (r.ok) $('mSign').classList.remove('on'); };
$('sSkip').onclick = () => { send({ type: 'skipSignup' }); $('mSign').classList.remove('on'); };
$('aUp').onclick = () => signup($('aName').value, $('aEmail').value);
$('aIn').onclick = async () => { const r = await srv('/signin', { email: $('aEmail').value }); toast(r.ok ? 'Signed in.' : (r.error || 'No account found for that email.'), !!r.ok); };
/* ---- upgrade / pay ---- */
async function loadPrice() { const r = await srv('/price'); $('price').textContent = r.price ? `GHS ${r.price}` : 'Connect to the internet to see the price'; if (r.price) $('pay').textContent = `Pay GHS ${r.price}`; }
document.querySelector('[data-tab=support]').addEventListener('click', loadPrice);
$('pay').onclick = async () => {
  const net = $('pNet').value; $('payMsg').textContent = 'Processing…';
  const r = await srv('/pay', { name: $('pName').value, country: $('pCountry').value, email: $('pEmail').value, phone: $('pPhone').value, network: net });
  if (r.url) window.api.openExternal(r.url);
  $('payMsg').textContent = r.message || (r.url ? 'Complete the payment in your browser. Your key will be emailed.' : (r.error || 'Payment could not start.'));
};
/* ---- feedback / updates ---- */
$('fbSend').onclick = async () => { const r = await srv('/feedback', { user: S && S.user, text: $('fbText').value, version: S && S.version }); toast(r.ok ? 'Thank you for your feedback!' : (r.error || 'Could not send.'), !!r.ok); if (r.ok) $('fbText').value = ''; };
$('updCheck').onclick = () => { $('updMsg').textContent = 'Checking…'; window.api.checkUpdate(); };
$('updInstall').onclick = () => window.api.installUpdate();
window.api.onUpdate(m => { if (m === 'READY') { $('updMsg').textContent = 'Update downloaded.'; $('updInstall').style.display = ''; } else $('updMsg').textContent = m; });
/* ---- themes ---- */
$('thSave').onclick = () => send({ type: 'themeSave', name: $('thName').value, bgColor: $('thBg').value, textColor: $('thFg').value });
$('themeChips').addEventListener('click', e => {
  const b = e.target.closest('button'), c = e.target.closest('.chip'); if (!c) return;
  if (b) send({ type: 'themeDelete', i: +c.dataset.i }); else send({ type: 'themeApply', i: +c.dataset.i });
});
let gated = false;
function renderExtras() {
  applyLang(S.lang || 'en');
  $('themeCount').textContent = `${S.themes.length} of ${S.themeLimit} themes used`;
  $('themeChips').innerHTML = S.themes.map((t, i) => `<span class="chip" data-i="${i}" style="cursor:pointer;background:${t.bgColor};color:${t.textColor};${i === S.themeIdx ? 'outline:2px solid #ffbf00' : ''}">${esc(t.name)}<button aria-label="Delete theme">×</button></span>`).join('');
  $('acctStatus').textContent = S.user ? `Signed in as ${S.user.name} (${S.user.email})` : 'Not signed in';
  $('ver').textContent = `Version ${S.version}`;
  if (!gated) { gated = true; if (!S.lang) $('mLang').classList.add('on'); }
  $('mSign').classList.toggle('on', !!S.lang && !S.user && !S.skipSignup && !$('mLang').classList.contains('on'));
}
