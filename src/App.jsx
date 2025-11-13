// App.jsx — Weekly 4‑Hour Assignment Board (people × days grid, no auth)
// Clean light UI (no Tailwind). Multiple bookings allowed per person. CSV export. Big‑screen mode.
// Storage: localStorage by default; optional Vercel /api backend via CONFIG.backendUrl.

import React, { useEffect, useMemo, useState } from "react";

// ==========================
// CONFIG
// ==========================
const CONFIG = {
  backendUrl: '/api',     // set to '/api' after adding serverless functions; otherwise it uses localStorage only
  refreshMs: 60000,     // auto refresh interval
  hours: Array.from({ length: 13 }, (_, i) => 6 + i), // 06:00–18:00 choices for start time
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
const fmt = (h) => `${String(h).padStart(2, "0")}:00`;

// ==========================
// Colors per person (stable)
// ==========================
function colorFor(name) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = [210, 15, 140, 270, 340, 95, 30, 185];
  const hue = hues[h % hues.length];
  return {
    bg: `hsl(${hue} 85% 92%)`,
    border: `hsl(${hue} 70% 68%)`,
  };
}

// ==========================
// Storage layer (localStorage default, optional REST)
// ==========================
const LS_BOOKINGS = "w4h_bookings_v1";
const LS_PEOPLE = "w4h_people_v1";
function loadObj(key){ try{return JSON.parse(localStorage.getItem(key)||"{}");}catch{return{}} }
function saveObj(key,val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch{} }
function loadArr(key){ try{return JSON.parse(localStorage.getItem(key)||"[]");}catch{return[]} }
function saveArr(key,val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch{} }

// Local bookings
async function apiGetWeekLS(weekKey){ const all = loadObj(LS_BOOKINGS); return Object.values(all).filter(b=>b.weekKey===weekKey); }
async function apiCreateLS(body){ const all = loadObj(LS_BOOKINGS); const id = `b_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; all[id] = {id,...body}; saveObj(LS_BOOKINGS, all); return all[id]; }
async function apiDeleteLS(id){ const all = loadObj(LS_BOOKINGS); delete all[id]; saveObj(LS_BOOKINGS, all); }

// Optional HTTP API (same shapes)
async function apiGetWeekHTTP(weekKey){ const r = await fetch(`${CONFIG.backendUrl}/bookings?weekKey=${encodeURIComponent(weekKey)}`); if(!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiCreateHTTP(body){ const r = await fetch(`${CONFIG.backendUrl}/bookings`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}); if(!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDeleteHTTP(id){ const r = await fetch(`${CONFIG.backendUrl}/bookings/${encodeURIComponent(id)}`, {method:'DELETE'}); if(!r.ok) throw new Error(await r.text()); }

const API = CONFIG.backendUrl
  ? { getWeek: apiGetWeekHTTP, create: apiCreateHTTP, del: apiDeleteHTTP }
  : { getWeek: apiGetWeekLS,   create: apiCreateLS,   del: apiDeleteLS };

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

  const [people, setPeople] = useState(() => loadArr(LS_PEOPLE));  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tv, setTv] = useState(false);

  // form
  const [person, setPerson] = useState(() => (loadArr(LS_PEOPLE)[0]||"Alex"));
  const [dayIndex, setDayIndex] = useState(0);
  const [startHour, setStartHour] = useState(8);
  const [newPerson, setNewPerson] = useState("");

  async function load(){ setLoading(true); setError(''); try{ setBookings(await API.getWeek(weekKey)); } catch(e){ setError(String(e.message||e)); } finally{ setLoading(false);} }
  useEffect(()=>{ load(); }, [weekKey]);
  useEffect(()=>{ const id=setInterval(load, CONFIG.refreshMs); return ()=>clearInterval(id); }, []);

  function addPerson(){ const p = newPerson.trim(); if(!p) return; const list = Array.from(new Set([...people, p])); setPeople(list); saveArr(LS_PEOPLE, list); if(!person) setPerson(p); setNewPerson(""); }

  async function submit(){
    const nm = person?.trim(); if(!nm){ setError('Pick a person'); return; }
    const d = days[dayIndex]; const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
    try{ await API.create({ title: nm, dayISO: iso, startHour, durationHours:4, weekKey }); await load(); }
    catch(e){ setError(String(e.message||e)); }
  }

  async function remove(id){ try{ await API.del(id); await load(); } catch(e){ setError(String(e.message||e)); } }

  function exportCSV(){
    const rows = [[`Week`, weekKey], [], ["Person","Day","Date","Start","End"]];
    bookings.sort((a,b)=>a.title.localeCompare(b.title)).forEach(b=>{
      const d = new Date(b.dayISO);
      rows.push([b.title, d.toLocaleDateString(undefined,{weekday:'short'}), d.toLocaleDateString(), fmt(b.startHour), fmt(b.startHour+(b.durationHours||4))]);
    });
    const csv = rows.map(r=>r.join(",")).join("\n");
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`assignments_${weekKey}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className={`wrap ${tv? 'tv' : ''}`}>
      <header className="card head">
        <div>
          <h1>Weekly 4‑Hour Assignment Board</h1>
          <div className="muted">WEEK <span className="mono">{weekKey}</span>
            <span className="dot">•</span>
            {days.map((d,i)=> (
              <span key={i} className="weekday">{d.toLocaleDateString(undefined,{weekday:'short'})} <span className="muted sm">{d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>{i<6?' ':' '}</span>
            ))}
          </div>
          {loading && <div className="muted sm">Refreshing…</div>}
          {error && <div className="error sm">{error}</div>}
        </div>
        <div className="controls">
          <button className="btn" onClick={()=>setBaseDate(new Date(baseDate.getTime()-7*86400000))}>Prev</button>
          <button className="btn" onClick={()=>setBaseDate(startOfISOWeek(new Date()))}>Today</button>
          <button className="btn" onClick={()=>setBaseDate(new Date(baseDate.getTime()+7*86400000))}>Next</button>
          <button className="btn" onClick={exportCSV}>Export CSV</button>
          <button className="btn" onClick={()=>setTv(v=>!v)}>{tv? 'Big‑screen On' : 'Big‑screen Off'}</button>
        </div>
      </header>

      {!CONFIG.backendUrl && (
        <div className="card note">No backend configured — data is stored only in <b>this browser</b>. Set <code>CONFIG.backendUrl</code> after adding a simple <code>/api</code> on Vercel if you want everyone to share bookings.</div>
      )}

      <section className="card form">
        <div className="formgrid">
          <label>Person<select value={person} onChange={e=>setPerson(e.target.value)}>{people.map(p=> <option key={p} value={p}>{p}</option>)}</select></label>
          <label>Day<select value={dayIndex} onChange={e=>setDayIndex(parseInt(e.target.value))}>{days.map((d,i)=>(<option key={i} value={i}>{d.toLocaleDateString(undefined,{weekday:'long'})}</option>))}</select></label>
          <label>Start time<select value={startHour} onChange={e=>setStartHour(parseInt(e.target.value))}>{CONFIG.hours.map(h=> <option key={h} value={h}>{fmt(h)}</option>)}</select></label>
          <div className="right"><button className="btn primary" onClick={submit}>Assign 4 hours</button></div>
          <div className="grow"></div>
          <label className="grow">Add person<input placeholder="Name (e.g., Jamie)" value={newPerson} onChange={e=>setNewPerson(e.target.value)} /></label>
          <div><button className="btn" onClick={addPerson}>+ Add</button></div>
        </div>
      </section>

      {/* PEOPLE × DAYS grid */}
      <section className="card gridboard">
        <div className="gridhead" />
        {days.map((d,i)=> <div key={i} className="gridhead dayh"><div>{d.toLocaleDateString(undefined,{weekday:'short'})}<span className="muted sm"> {d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span></div></div>)}

        <div className="peoplecol">
          <div className="peoplelabel">PEOPLE</div>
          {people.map(p=> (
            <div key={p} className="personrow">
              <div className="bullet" style={{background: colorFor(p).bg, borderColor: colorFor(p).border}}>{p[0]?.toUpperCase()}</div>
              <div className="pname">{p}</div>
            </div>
          ))}
        </div>

        {days.map((d,di)=> (
          <div key={di} className="daycells">
            {people.map(p=>{
              const cell = bookings.filter(b=> b.title===p && new Date(b.dayISO).toDateString()===d.toDateString());
              return (
                <div key={p} className="cell">
                  {cell.length===0 ? (
                    <div className="empty">—</div>
                  ) : (
                    <div className="chips">
                      {cell.sort((a,b)=>a.startHour-b.startHour).map(b=>{
                        const {bg,border} = colorFor(p);
                        return (
                          <div key={b.id} className="chip" style={{background:bg, borderColor:border}}>
                            {fmt(b.startHour)}–{fmt(b.startHour + (b.durationHours||4))}
                            <button className="x" onClick={()=>remove(b.id)} aria-label="remove">×</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <footer className="muted sm center">Change weeks with Prev/Next. Export CSV to share. Toggle Big‑screen for TVs.</footer>
    </div>
  );
}

// ==========================
// Styles — light card UI (no Tailwind)
// ==========================
const Styles = () => (
  <style>{`
    :root{--bg:#f7f7fb;--card:#fff;--muted:#6b7280;--border:#e5e7eb;--text:#0f172a;--accent:#2563eb}
    body{background:var(--bg);color:var(--text);font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial}
    .wrap{max-width:1200px;margin:0 auto;padding:24px}
    .wrap.tv{font-size:1.15rem}
    .card{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.05);padding:16px}
    .head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
    h1{margin:0;font-size:28px}
    .mono{font-family:ui-monospace, SFMono-Regular, Menlo, monospace}
    .muted{color:var(--muted)}
    .sm{font-size:12px}
    .center{text-align:center;margin-top:8px}
    .error{color:#b91c1c}
    .controls{display:flex;gap:8px}
    .btn{border:1px solid var(--border);background:#fff;border-radius:12px;padding:8px 12px;cursor:pointer}
    .btn.primary{background:var(--accent);color:#fff;border-color:transparent}
    .btn:active{transform:translateY(1px)}
    .note{background:#fffbeb;border-color:#fde68a;color:#92400e}

    .form .formgrid{display:grid;grid-template-columns:1.2fr 1fr 1fr auto 1fr auto;gap:12px;align-items:end}
    label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted)}
    input,select{border:1px solid var(--border);border-radius:12px;padding:8px 10px}
    .right{display:flex;justify-content:flex-end}

    .gridboard{display:grid;grid-template-columns: 160px repeat(7, 1fr);gap:0}
    .gridhead{display:contents}
    .dayh>div{padding:12px 10px;font-weight:700;text-align:center}

    .peoplecol{border-right:1px solid var(--border)}
    .peoplelabel{font-weight:700;margin:0 0 8px 8px;color:var(--muted)}
    .personrow{display:flex;align-items:center;gap:10px;padding:10px 8px;border-top:1px solid var(--border)}
    .bullet{width:28px;height:28px;border-radius:999px;border:1px solid;display:grid;place-items:center;font-weight:700;color:#111}
    .pname{font-weight:600}

    .daycells{display:grid;grid-template-rows: 40px repeat(var(--people-rows, 0), 56px)}
    /* rows per day are simulated by borders in .cell below */

    .daycells .cell{border-left:1px solid var(--border);border-top:1px solid var(--border);padding:8px;min-height:56px}
    .empty{height:28px;border:1px dashed #d1d5db;border-radius:999px;display:grid;place-items:center;color:#c0c8d2}
    .chips{display:flex;flex-wrap:wrap;gap:6px}
    .chip{border:1px solid;border-radius:999px;padding:6px 10px;position:relative}
    .chip .x{background:transparent;border:0;cursor:pointer;margin-left:8px;color:#111}

    @media (max-width: 980px){
      .wrap{padding:12px}
      .form .formgrid{grid-template-columns:1fr 1fr 1fr auto;}
      .gridboard{grid-template-columns:120px repeat(7,1fr)}
    }
  `}</style>
);
