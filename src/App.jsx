// App.jsx — Weekly 4‑Hour Assignment Board (clean design, no auth)
// Purpose: A big‑screen friendly weekly board where each person books EXACTLY one 4‑hour slot per week.
// Storage: localStorage by default (shared backend optional via CONFIG.backendUrl)
// Notes: Designed to be embedded in SharePoint or opened directly (Vercel).

import React, { useEffect, useMemo, useState } from "react";

// ==========================
// CONFIG
// ==========================
const CONFIG = {
  backendUrl: null,     // set to '/api' after adding Vercel serverless functions to share across devices
  refreshMs: 60000,     // auto refresh interval
  onePerWeek: true,     // enforce exactly one 4h booking per person per week
  hoursStart: 7,        // start of visible day
  hoursEnd: 20,         // end (exclusive)
};

// ==========================
// Date Helpers
// ==========================
function startOfISOWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7; // Monday=1..Sunday=7
  if (day !== 1) x.setUTCDate(x.getUTCDate() - (day - 1));
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function addDays(date, days) { const d = new Date(date); d.setUTCDate(d.getUTCDate() + days); return d; }
function weekKeyFromDate(d) {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNo = 1 + Math.round(((target - week1) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
const HOURS = Array.from({ length: (CONFIG.hoursEnd - CONFIG.hoursStart) + 1 }, (_, i) => CONFIG.hoursStart + i);
const fmt = (h) => `${String(h).padStart(2, "0")}:00`;
const label = (d) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

// ==========================
// Color helpers (stable per name)
// ==========================
function hashColor(name) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = [210, 15, 140, 270, 340, 95, 30, 185];
  const hue = hues[h % hues.length];
  return `hsl(${hue} 85% 90%)`; // pastel bg
}
function borderColor(name) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = [210, 15, 140, 270, 340, 95, 30, 185];
  const hue = hues[h % hues.length];
  return `hsl(${hue} 70% 65%)`;
}

// ==========================
// Storage layer (localStorage by default, optional REST)
// ==========================
const LS_KEY = "weekly_four_hour_board_v1";
function loadAllLS() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } }
function saveAllLS(obj) { try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch {} }
async function apiGetWeekLS(weekKey) { const all = loadAllLS(); return Object.values(all).filter(b => b.weekKey === weekKey); }
async function apiCreateLS(body) {
  const all = loadAllLS();
  const id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  all[id] = { id, ...body };
  saveAllLS(all);
  return all[id];
}
async function apiDeleteLS(id) { const all = loadAllLS(); delete all[id]; saveAllLS(all); }

async function apiGetWeekHTTP(weekKey) {
  const r = await fetch(`${CONFIG.backendUrl}/bookings?weekKey=${encodeURIComponent(weekKey)}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiCreateHTTP(body) {
  const r = await fetch(`${CONFIG.backendUrl}/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiDeleteHTTP(id) {
  const r = await fetch(`${CONFIG.backendUrl}/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
}

const API = CONFIG.backendUrl
  ? { getWeek: apiGetWeekHTTP, create: apiCreateHTTP, del: apiDeleteHTTP }
  : { getWeek: apiGetWeekLS, create: apiCreateLS, del: apiDeleteLS };

// ==========================
// Tests (light sanity)
// ==========================
function runTests() {
  const out = []; const t = (n, c) => out.push({ n, ok: !!c });
  const d = new Date(Date.UTC(2025,0,1));
  t('weekKey shape', /^\d{4}-W\d{2}$/.test(weekKeyFromDate(d)));
  const b = new Date(Date.UTC(2025,10,10)); t('addDays', addDays(b,2).getUTCDate()===12);
  return out;
}

// ==========================
// UI
// ==========================
export default function App(){
  return (
    <>
      <Styles />
      <Board />
    </>
  );
}

function Board(){
  const [baseDate, setBaseDate] = useState(() => startOfISOWeek(new Date()));
  const weekKey = useMemo(() => weekKeyFromDate(baseDate), [baseDate]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(baseDate, i)), [baseDate]);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tv, setTv] = useState(false);

  // form
  const [name, setName] = useState('');
  const [dayIndex, setDayIndex] = useState(0);
  const [startHour, setStartHour] = useState(8);

  async function load(){
    setLoading(true); setError('');
    try{ const data = await API.getWeek(weekKey); setBookings(data);} catch(e){ setError(String(e.message||e)); } finally{ setLoading(false);} }

  useEffect(()=>{ load(); }, [weekKey]);
  useEffect(()=>{ const id=setInterval(load, CONFIG.refreshMs); return ()=>clearInterval(id); }, []);

  async function submit(){
    const nm = name.trim(); if(!nm){ setError('Please enter your name'); return; }
    if(CONFIG.onePerWeek){
      const has = bookings.some(b=> b.title===nm);
      if(has){ setError('You already have a 4‑hour assignment this week.'); return; }
    }
    const d = days[dayIndex];
    const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
    try{
      await API.create({ id: undefined, title: nm, dayISO: iso, startHour, durationHours: 4, weekKey });
      setName(''); await load();
    }catch(e){ setError(String(e.message||e)); }
  }

  async function remove(id){ try{ await API.del(id); await load(); } catch(e){ setError(String(e.message||e)); } }

  // calendar placement
  const hourHeight = 52; // px per hour row
  const topPx = h => (h - CONFIG.hoursStart) * hourHeight;
  const heightPx = dur => dur * hourHeight;

  return (
    <div className={`wrap ${tv? 'tv' : ''}`}>
      <header className="card head">
        <div className="title">
          <h1>Weekly 4‑Hour Assignment Board</h1>
          <div className="muted">Week <span className="mono">{weekKey}</span></div>
          {loading && <div className="muted sm">Refreshing…</div>}
          {error && <div className="error sm">{error}</div>}
        </div>
        <div className="controls">
          <button className="btn" onClick={()=>setBaseDate(new Date(baseDate.getTime()-7*86400000))}>Prev</button>
          <button className="btn" onClick={()=>setBaseDate(startOfISOWeek(new Date()))}>Today</button>
          <button className="btn" onClick={()=>setBaseDate(new Date(baseDate.getTime()+7*86400000))}>Next</button>
          <button className="btn" onClick={()=>setTv(v=>!v)}>{tv? 'Normal' : 'TV Mode'}</button>
        </div>
      </header>

      {!CONFIG.backendUrl && (
        <div className="card note">No backend configured — data is stored only in <b>this browser</b>. Set <code>CONFIG.backendUrl</code> once you add the simple /api backend on Vercel.</div>
      )}

      <section className="card form">
        <div className="grid formgrid">
          <label>Person<input placeholder="e.g., Alex" value={name} onChange={e=>setName(e.target.value)} /></label>
          <label>Day<select value={dayIndex} onChange={e=>setDayIndex(parseInt(e.target.value))}>{days.map((d,i)=>(<option key={i} value={i}>{d.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</option>))}</select></label>
          <label>Start<select value={startHour} onChange={e=>setStartHour(parseInt(e.target.value))}>{HOURS.map(h=> (<option key={h} value={h}>{fmt(h)}</option>))}</select></label>
          <div className="right"><button className="btn primary" onClick={submit}>Assign 4 hours</button></div>
        </div>
      </section>

      <section className="grid two">
        {/* Calendar */}
        <div className="card calendar">
          <div className="calhead" />
          {days.map((d,i)=> (<div key={i} className="calhead dayh"><div>{d.toLocaleDateString(undefined,{weekday:'short'})}<span className="muted sm"> {d.toLocaleDateString(undefined,{month:'short', day:'numeric'})}</span></div></div>))}

          {/* time gutter */}
          <div className="times">
            {Array.from({length: CONFIG.hoursEnd - CONFIG.hoursStart}, (_,i)=>CONFIG.hoursStart+i).map(h => (
              <div key={h} className="timecell">{fmt(h)}</div>
            ))}
          </div>

          {/* day columns */}
          {days.map((d,di)=> (
            <div key={di} className="daycol" style={{height: (CONFIG.hoursEnd-CONFIG.hoursStart)*hourHeight}}>
              {Array.from({length: CONFIG.hoursEnd - CONFIG.hoursStart}, (_,i)=>CONFIG.hoursStart+i).map(h => (<div key={h} className="row" />))}
              {bookings.filter(b=>new Date(b.dayISO).toDateString()===d.toDateString()).map(b => (
                <div key={b.id} className="block" style={{ top: topPx(b.startHour), height: heightPx(b.durationHours||4), background: hashColor(b.title), borderColor: borderColor(b.title) }} title={`${b.title} • ${fmt(b.startHour)}–${fmt(b.startHour+(b.durationHours||4))}`}>
                  <div className="btitle">{b.title}</div>
                  <div className="muted sm">{fmt(b.startHour)}–{fmt(b.startHour+(b.durationHours||4))}</div>
                  <button className="link sm" onClick={()=>remove(b.id)}>cancel</button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* People legend / list */}
        <div className="card legend">
          <div className="legendhead">People this week</div>
          <div className="legendlist">
            {Array.from(new Set(bookings.map(b=>b.title))).sort().map(n => (
              <div key={n} className="chip" style={{ background: hashColor(n), borderColor: borderColor(n) }}>{n}</div>
            ))}
          </div>

          <div className="muted sm" style={{marginTop:8}}>
            {CONFIG.onePerWeek ? 'Each person can book one 4‑hour slot per week.' : 'Multiple bookings per week allowed.'}
          </div>

          <div className="muted sm" style={{marginTop:16}}>
            Built‑in checks: {runTests().filter(t=>t.ok).length}/{runTests().length} passed
          </div>
        </div>
      </section>
    </div>
  );
}

// ==========================
// Styles — clean, TV‑friendly, no Tailwind required
// ==========================
const Styles = () => (
  <style>{`
    :root{--bg:#f7f7fb;--card:#fff;--muted:#6b7280;--border:#e5e7eb;--text:#0f172a;--accent:#2563eb}
    body{background:var(--bg);color:var(--text);font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, "Apple Color Emoji","Segoe UI Emoji"}
    .wrap{max-width:1200px;margin:0 auto;padding:24px}
    .wrap.tv{font-size:1.15rem}
    .card{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.05);padding:16px}
    .head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
    h1{margin:0;font-size:22px}
    .mono{font-family:ui-monospace, SFMono-Regular, Menlo, monospace}
    .muted{color:var(--muted)}
    .sm{font-size:12px}
    .error{color:#b91c1c}
    .controls{display:flex;gap:8px}
    .btn{border:1px solid var(--border);background:#fff;border-radius:12px;padding:8px 12px;cursor:pointer}
    .btn.primary{background:var(--accent);color:#fff;border-color:transparent}
    .btn:active{transform:translateY(1px)}
    .note{background:#fffbeb;border-color:#fde68a;color:#92400e}

    .grid.two{display:grid;grid-template-columns: 2fr 1fr; gap:12px;}
    .formgrid{display:grid;grid-template-columns:2fr 2fr 1fr auto;gap:12px;align-items:end}
    label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted)}
    input,select{border:1px solid var(--border);border-radius:12px;padding:8px 10px}
    .right{display:flex;justify-content:flex-end;align-items:end}

    /* Calendar */
    .calendar{display:grid;grid-template-columns: 72px repeat(7,1fr); gap:0}
    .calhead{display:contents}
    .dayh>div{padding:10px 8px;font-weight:700;text-align:center}
    .times{display:grid;grid-auto-rows:52px;border-right:1px solid var(--border)}
    .timecell{font-size:12px;color:var(--muted);padding:4px 8px}
    .daycol{position:relative;border-left:1px solid var(--border)}
    .row{height:52px;border-top:1px dashed #eee}
    .block{position:absolute;left:6px;right:6px;border:1px solid;border-radius:12px;padding:8px;overflow:hidden}
    .btitle{font-weight:700}

    /* Legend */
    .legendhead{font-weight:700;margin-bottom:8px}
    .legendlist{display:flex;flex-wrap:wrap;gap:8px}
    .chip{border:1px solid;border-radius:999px;padding:6px 10px}

    @media (max-width: 980px){
      .grid.two{grid-template-columns:1fr}
      .formgrid{grid-template-columns:1fr 1fr;}
      .calendar{grid-template-columns: 56px repeat(7, 1fr)}
    }
  `}</style>
);
