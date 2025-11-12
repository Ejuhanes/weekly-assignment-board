import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Download, Monitor, MonitorCog } from "lucide-react";

// --- Minimal shadcn/ui primitives (inline) ---
const Button = ({ className = "", children, ...props }) => (
  <button
    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium shadow-sm border border-gray-200 hover:shadow transition ${className}`}
    {...props}
  >
    {children}
  </button>
);
const Card = ({ className = "", children }) => (
  <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}>{children}</div>
);
const CardContent = ({ className = "", children }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

// --- Helpers ---
const startOfWeek = (date) => {
  // Monday as first day of week (ISO)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // if Sunday (0), go back 6
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
const addDays = (date, days) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};
const formatDate = (date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
const weekKey = (d) => {
  const y = d.getUTCFullYear();
  // ISO week number
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday in current week decides the year
  tmp.setUTCDate(tmp.getUTCDate() + 3 - ((tmp.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const weekNo = 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return `${y}-W${String(weekNo).padStart(2, "0")}`;
};

// Default hours people can start a 4h block
const HOURS = Array.from({ length: 13 }, (_, i) => 6 + i); // 06:00–18:00 start => up to 22:00 end
const HOUR_LABEL = (h) => `${String(h).padStart(2, "0")}:00`;

// Color palette for person chips
const COLORS = [
  "bg-blue-100 text-blue-900 border-blue-200",
  "bg-green-100 text-green-900 border-green-200",
  "bg-amber-100 text-amber-900 border-amber-200",
  "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
  "bg-cyan-100 text-cyan-900 border-cyan-200",
  "bg-rose-100 text-rose-900 border-rose-200",
  "bg-violet-100 text-violet-900 border-violet-200",
  "bg-emerald-100 text-emerald-900 border-emerald-200",
];

// --- LocalStorage helpers ---
const LS_KEY = "four_hour_board_v1";
const loadState = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const saveState = (state) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
};

export default function FourHourAssignmentBoard() {
  const [baseDate, setBaseDate] = useState(() => startOfWeek(new Date()));
  const [people, setPeople] = useState(() => loadState()?.people ?? [
    { id: "p1", name: "Alex", color: 0 },
    { id: "p2", name: "Sam", color: 1 },
    { id: "p3", name: "Taylor", color: 2 },
  ]);
  const [assignments, setAssignments] = useState(() => loadState()?.assignments ?? {});
  const [newPerson, setNewPerson] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState(people[0]?.id ?? "");
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedStart, setSelectedStart] = useState(8);
  const [bigScreen, setBigScreen] = useState(false);

  const wkKey = useMemo(() => weekKey(baseDate), [baseDate]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(baseDate, i)), [baseDate]);

  useEffect(() => {
    saveState({ people, assignments });
  }, [people, assignments]);

  const thisWeek = assignments[wkKey] || {};

  const handleAddPerson = () => {
    const name = newPerson.trim();
    if (!name) return;
    const id = `p${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    const color = people.length % COLORS.length;
    const next = [...people, { id, name, color }];
    setPeople(next);
    setNewPerson("");
    if (!selectedPersonId) setSelectedPersonId(id);
  };

  const toggleBigScreen = () => setBigScreen((v) => !v);

  const assignFourHours = () => {
    if (!selectedPersonId) return;
    const endHour = selectedStart + 4;
    if (endHour > 24) return; // basic guard

    // Enforce max of 4h per person per week
    const week = { ...thisWeek };
    week[selectedPersonId] = { dayIndex: selectedDay, startHour: selectedStart };

    setAssignments({ ...assignments, [wkKey]: week });
  };

  const clearAssignment = (pid) => {
    const week = { ...thisWeek };
    delete week[pid];
    setAssignments({ ...assignments, [wkKey]: week });
  };

  const exportCSV = () => {
    const rows = [["Week", "Person", "Day", "Start", "End"]];
    const w = assignments[wkKey] || {};
    for (const pid of Object.keys(w)) {
      const person = people.find((p) => p.id === pid);
      if (!person) continue;
      const { dayIndex, startHour } = w[pid];
      const d = days[dayIndex];
      const end = startHour + 4;
      rows.push([wkKey, person.name, d.toLocaleDateString(undefined, { weekday: "long" }), HOUR_LABEL(startHour), HOUR_LABEL(end)]);
    }
    const csv = rows.map((r) => r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${wkKey}_4h_assignments.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const goPrev = () => setBaseDate((d) => addDays(d, -7));
  const goNext = () => setBaseDate((d) => addDays(d, +7));
  const goToday = () => setBaseDate(startOfWeek(new Date()));

  const personColor = (pid) => {
    const p = people.find((x) => x.id === pid);
    return p ? COLORS[p.color % COLORS.length] : COLORS[0];
  };

  const initials = (name) => name.split(/\s+/).map((n) => n[0]?.toUpperCase()).slice(0, 2).join("");

  return (
    <div className={`min-h-screen w-full ${bigScreen ? "p-4" : "p-6"} bg-gradient-to-b from-gray-50 to-white text-gray-900`}> 
      <div className="max-w-7xl mx-auto grid gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-6 h-6" />
            <h1 className="text-2xl font-semibold">Weekly 4‑Hour Assignment Board</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={goPrev}><ChevronLeft className="w-4 h-4"/>Prev</Button>
            <Button onClick={goToday}>Today</Button>
            <Button onClick={goNext}>Next<ChevronRight className="w-4 h-4"/></Button>
          </div>
        </div>

        {/* Week summary */}
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm uppercase tracking-wide text-gray-500">Week</span>
              <span className="text-lg font-semibold">{wkKey}</span>
              <span className="text-gray-400">•</span>
              <div className="flex gap-3 text-sm text-gray-600">
                {days.map((d, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="font-medium">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <span className="text-xs">{formatDate(d)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={exportCSV}><Download className="w-4 h-4"/>Export CSV</Button>
              <Button onClick={toggleBigScreen} className={bigScreen ? "bg-gray-900 text-white" : ""}>
                {bigScreen ? <><MonitorCog className="w-4 h-4"/>Big‑screen On</> : <><Monitor className="w-4 h-4"/>Big‑screen Off</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Person</label>
                <select
                  value={selectedPersonId}
                  onChange={(e) => setSelectedPersonId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Day</label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                  className="w-full rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {days.map((d, i) => (
                    <option key={i} value={i}>{d.toLocaleDateString(undefined, { weekday: "long" })}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Start time</label>
                <select
                  value={selectedStart}
                  onChange={(e) => setSelectedStart(parseInt(e.target.value))}
                  className="w-full rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{HOUR_LABEL(h)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={assignFourHours}>
                  Assign 4 hours
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Add person</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Name (e.g., Jamie)"
                    value={newPerson}
                    onChange={(e) => setNewPerson(e.target.value)}
                  />
                  <Button onClick={handleAddPerson}><Plus className="w-4 h-4"/>Add</Button>
                </div>
              </div>
              <div className="hidden sm:block" />
            </div>
          </CardContent>
        </Card>

        {/* Grid Board */}
        <Card>
          <CardContent>
            <div className={`grid ${bigScreen ? "text-xl" : "text-base"}`}>
              <div className="grid grid-cols-8 gap-2 items-stretch">
                <div className="font-semibold text-gray-500 uppercase tracking-wide text-sm">People</div>
                {days.map((d, i) => (
                  <div key={i} className="text-center font-semibold text-gray-600">
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                    <div className="text-xs text-gray-400">{formatDate(d)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-2">
                {people.map((p) => {
                  const entry = thisWeek[p.id];
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-8 gap-2 items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full grid place-items-center border ${personColor(p.id)}`} title={p.name}>
                          <span className="text-sm font-bold">{initials(p.name)}</span>
                        </div>
                        <div className="font-medium">{p.name}</div>
                      </div>
                      {days.map((_, dayIdx) => {
                        const isThis = entry && entry.dayIndex === dayIdx;
                        return (
                          <div key={dayIdx} className="min-h-[3.25rem]">
                            {isThis ? (
                              <div className={`h-full w-full border rounded-xl p-2 flex items-center justify-between ${personColor(p.id)} shadow-inner`}
                                   title={`${HOUR_LABEL(entry.startHour)}–${HOUR_LABEL(entry.startHour + 4)}`}>
                                <div className="font-semibold">{HOUR_LABEL(entry.startHour)}–{HOUR_LABEL(entry.startHour + 4)}</div>
                                <button
                                  className="text-xs underline"
                                  onClick={() => clearAssignment(p.id)}
                                >
                                  clear
                                </button>
                              </div>
                            ) : (
                              <div className="h-full w-full border border-dashed rounded-xl text-gray-300 grid place-items-center">
                                <span className="text-xs">—</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend / Notes */}
        <div className="text-sm text-gray-500">
          <p>Each person can be assigned exactly one 4‑hour block per week. Change the week to re‑assign. Use Export CSV to share or print. Toggle Big‑screen for larger text when displaying on a TV.</p>
        </div>
      </div>
    </div>
  );
}
