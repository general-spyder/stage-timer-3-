const $ = id => document.getElementById(id);
let S = null, T = { remainingMs: 0, totalMs: 1, running: false, timeUp: false };
const root = document.documentElement.style;

function fmt(ms) {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(Math.floor(s / 60))}:${p(sec)}`;
}
function ordinal(d) { const t = d % 100; if (t > 10 && t < 14) return d + 'TH'; return d + (['TH', 'ST', 'ND', 'RD'][d % 10] || 'TH'); }
function clock() {
  const n = new Date();
  const month = n.toLocaleString('en-GB', { month: 'long' }).toUpperCase();
  let h = n.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  $('date').textContent = `${ordinal(n.getDate())} ${month} ${n.getFullYear()} - ${h}:${String(n.getMinutes()).padStart(2, '0')}${ap}`;
}
const q = f => `'${String(f).replace(/'/g, '')}', 'Poppins', sans-serif`;

function renderState() {
  if (!S) return;
  const st = S.style;
  root.setProperty('--fg', st.textColor); root.setProperty('--bg', st.bgColor);
  root.setProperty('--f-title', q(st.fonts.title)); root.setProperty('--f-timer', q(st.fonts.timer));
  root.setProperty('--f-mod', q(st.fonts.moderator)); root.setProperty('--f-date', q(st.fonts.date));
  const bg = $('bg');
  bg.style.backgroundImage = st.bgImage ? `url("${st.bgImage}")` : 'none';
  bg.style.backgroundSize = st.bgFit === 'fill' ? '100% 100%' : st.bgFit;
  const logo = $('logo'); if (st.logo) { logo.src = st.logo; logo.style.display = 'block'; } else logo.style.display = 'none';
  $('title').textContent = S.title; $('moderator').textContent = S.moderator;
  // upcoming items
  const i = S.schedule.findIndex(x => x.id === S.activeId);
  const up = S.schedule.slice(i + 1, i + 4);
  $('next').innerHTML = up.length ? 'NEXT' + up.map(x => `<small>${x.start ? x.start + ' &nbsp;' : ''}${esc(x.title)}${x.moderator ? ' – ' + esc(x.moderator) : ''}</small>`).join('') : '';
  renderTick();
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderTick() {
  const el = $('timer');
  if (T.timeUp) { el.textContent = 'TIME UP'; el.className = 'abs timeup'; }
  else { el.textContent = fmt(T.remainingMs); el.className = 'abs' + (T.remainingMs > 0 && T.remainingMs <= 300000 ? ' hot' : ''); }
  const elapsed = T.totalMs > 0 ? 1 - T.remainingMs / T.totalMs : 0;
  const pr = Math.min(1, Math.max(0, elapsed));
  $('thumb').style.setProperty('--p', pr);
  $('fill').style.clipPath = `inset(0 ${(1 - pr) * 100}% 0 0)`; // gradient is revealed as time elapses
}

const es = new EventSource('/events');
es.addEventListener('state', e => { S = JSON.parse(e.data); renderState(); });
es.addEventListener('tick', e => { T = JSON.parse(e.data); renderTick(); });
clock(); setInterval(clock, 1000);
