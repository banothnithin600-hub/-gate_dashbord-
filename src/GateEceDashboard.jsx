import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import {
  Flame, Target, TrendingUp, AlertTriangle, CheckCircle2, Trash2, Plus,
  Radio, Zap, ChevronDown, ChevronUp, RotateCcw,
} from "lucide-react";

const STORAGE_KEY = "gate_ece_dashboard_v1";
const EXAM_DATE = new Date("2027-02-01T00:00:00");

const DEFAULT_SUBJECTS = [
  { id: "maths", name: "Engineering Mathematics", priority: "high" },
  { id: "networks", name: "Network Theory", priority: "high" },
  { id: "signals", name: "Signals & Systems", priority: "high" },
  { id: "devices", name: "Electronic Devices", priority: "high" },
  { id: "analog", name: "Analog Circuits", priority: "high" },
  { id: "digital", name: "Digital Circuits", priority: "high" },
  { id: "control", name: "Control Systems", priority: "high" },
  { id: "comm", name: "Communications", priority: "high" },
  { id: "emft", name: "Electromagnetics", priority: "med" },
  { id: "aptitude", name: "General Aptitude", priority: "high" },
].map((s) => ({
  ...s,
  chaptersTotal: 10,
  chaptersDone: 0,
  notes: false,
  conceptQs: false,
  pyqs: false,
  rev1: false,
  rev2: false,
  mock: false,
}));

const COL_KEYS = ["notes", "conceptQs", "pyqs", "rev1", "rev2", "mock"];
const COL_LABELS = { notes: "Notes", conceptQs: "Concept Qs", pyqs: "PYQs", rev1: "Rev 1", rev2: "Rev 2", mock: "Mock" };

const INK = "#DCE3EA";
const MUTED = "#7C8896";
const TEAL = "#2DD4BF";
const AMBER = "#F0B429";
const CORAL = "#E5484D";
const GRID = "#212B35";
const PANEL = "#111820";

function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtDate(d) { return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

function subjectProgress(s) {
  const chapFrac = s.chaptersTotal > 0 ? Math.min(s.chaptersDone / s.chaptersTotal, 1) : 0;
  const colFrac = COL_KEYS.filter((k) => s[k]).length / COL_KEYS.length;
  return Math.round((chapFrac * 0.4 + colFrac * 0.6) * 100);
}

function Ring({ pct, size = 84, stroke = 8, color = TEAL, label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(pct, 100) / 100) * c;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={GRID} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
        <text
          x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
          transform={`rotate(90 ${size / 2} ${size / 2})`}
          fontFamily="ui-monospace, monospace" fontSize={18} fontWeight={600} fill={INK}
        >
          {Math.round(pct)}%
        </text>
      </svg>
      <div style={{ fontSize: 11, color: MUTED, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED }}>{sub}</div>}
    </div>
  );
}

function Metric({ label, value, unit, accent }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${GRID}`, borderRadius: 10, padding: "12px 14px", flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 22, fontWeight: 600, color: accent || INK }}>
        {value}{unit && <span style={{ fontSize: 13, color: MUTED, marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: INK }}>{title}</span>
      </div>
      {right}
    </div>
  );
}

function Trace() {
  return (
    <div style={{ display: "flex", alignItems: "center", margin: "28px 0", gap: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: TEAL, flexShrink: 0 }} />
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${TEAL}55, ${GRID})` }} />
    </div>
  );
}

const inputStyle = {
  background: "#0B1015", border: `1px solid ${GRID}`, borderRadius: 6, color: INK,
  padding: "6px 8px", fontSize: 12.5, fontFamily: "inherit", outline: "none",
};
const btnStyle = {
  background: "#152029", border: `1px solid ${GRID}`, borderRadius: 6, color: INK,
  padding: "6px 10px", fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
};
const btnPrimary = { ...btnStyle, background: "#0F3D38", border: `1px solid ${TEAL}66`, color: TEAL };

export default function GateEceDashboard() {
  const [loaded, setLoaded] = useState(false);
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
  const [logs, setLogs] = useState([]);
  const [mocks, setMocks] = useState([]);
  const [mistakes, setMistakes] = useState([]);
  const [openLogForm, setOpenLogForm] = useState(true);
  const [openMockForm, setOpenMockForm] = useState(false);
  const [openMistakeForm, setOpenMistakeForm] = useState(false);
  const [saveErr, setSaveErr] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.subjects) setSubjects(d.subjects);
        if (d.logs) setLogs(d.logs);
        if (d.mocks) setMocks(d.mocks);
        if (d.mistakes) setMistakes(d.mistakes);
      }
    } catch (e) {
      // no existing data yet, or it was corrupted — start fresh
    } finally {
      setLoaded(true);
    }
  }, []);

  const persist = useCallback((next) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaveErr(false);
    } catch (e) {
      setSaveErr(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persist({ subjects, logs, mocks, mistakes });
  }, [subjects, logs, mocks, mistakes, loaded, persist]);

  const updateSubject = (id, patch) => {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const overallPct = useMemo(() => {
    if (!subjects.length) return 0;
    return Math.round(subjects.reduce((a, s) => a + subjectProgress(s), 0) / subjects.length);
  }, [subjects]);

  const daysLeft = daysBetween(new Date(), EXAM_DATE);

  const totals = useMemo(() => {
    let hours = 0, questions = 0, correct = 0, wrong = 0, pyqs = 0, topics = 0;
    logs.forEach((l) => {
      hours += Number(l.hours) || 0;
      questions += Number(l.questions) || 0;
      correct += Number(l.correct) || 0;
      wrong += Number(l.wrong) || 0;
      pyqs += Number(l.pyqs) || 0;
      topics += Number(l.topics) || 0;
    });
    const accuracy = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;
    return { hours, questions, correct, wrong, pyqs, topics, accuracy };
  }, [logs]);

  const streak = useMemo(() => {
    const dateSet = new Set(logs.map((l) => l.date));
    let s = 0;
    let cur = new Date();
    while (dateSet.has(fmtDate(cur))) {
      s += 1;
      cur.setDate(cur.getDate() - 1);
    }
    return s;
  }, [logs]);

  const weeklyHours = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - 6);
    const sum = logs
      .filter((l) => new Date(l.date) >= cutoff)
      .reduce((a, l) => a + (Number(l.hours) || 0), 0);
    return Math.round((sum / 7) * 10) / 10;
  }, [logs]);

  const chartData = useMemo(() => {
    const byDate = {};
    logs.forEach((l) => {
      if (!byDate[l.date]) byDate[l.date] = { date: l.date, correct: 0, wrong: 0, hours: 0 };
      byDate[l.date].correct += Number(l.correct) || 0;
      byDate[l.date].wrong += Number(l.wrong) || 0;
      byDate[l.date].hours += Number(l.hours) || 0;
    });
    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date.slice(5),
        accuracy: d.correct + d.wrong > 0 ? Math.round((d.correct / (d.correct + d.wrong)) * 100) : null,
        hours: Math.round(d.hours * 10) / 10,
      }));
  }, [logs]);

  const subjectAccuracy = useMemo(() => {
    const map = {};
    logs.forEach((l) => {
      if (!l.subject) return;
      if (!map[l.subject]) map[l.subject] = { correct: 0, wrong: 0 };
      map[l.subject].correct += Number(l.correct) || 0;
      map[l.subject].wrong += Number(l.wrong) || 0;
    });
    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        acc: v.correct + v.wrong > 0 ? Math.round((v.correct / (v.correct + v.wrong)) * 100) : null,
        n: v.correct + v.wrong,
      }))
      .filter((r) => r.acc !== null && r.n >= 5)
      .sort((a, b) => a.acc - b.acc);
  }, [logs]);

  const weak = subjectAccuracy.filter((s) => s.acc < 70).slice(0, 4);
  const strong = subjectAccuracy.filter((s) => s.acc >= 85).slice(-4).reverse();

  // ---- forms ----
  const [logForm, setLogForm] = useState({
    date: fmtDate(new Date()), subject: subjects[0]?.name || "", hours: "", topics: "",
    questions: "", correct: "", wrong: "", pyqs: "",
  });
  const addLog = () => {
    if (!logForm.date || (!logForm.hours && !logForm.questions && !logForm.pyqs)) return;
    setLogs((p) => [...p, { id: uid(), ...logForm }]);
    setLogForm((f) => ({ ...f, hours: "", topics: "", questions: "", correct: "", wrong: "", pyqs: "" }));
  };

  const [mockForm, setMockForm] = useState({ name: "", date: fmtDate(new Date()), total: "", correct: "", timeMin: "", weakArea: "" });
  const addMock = () => {
    if (!mockForm.name || !mockForm.total) return;
    setMocks((p) => [...p, { id: uid(), ...mockForm }]);
    setMockForm({ name: "", date: fmtDate(new Date()), total: "", correct: "", timeMin: "", weakArea: "" });
  };

  const [mistakeForm, setMistakeForm] = useState({ subject: subjects[0]?.name || "", question: "", type: "Concept", concept: "", revised: false });
  const addMistake = () => {
    if (!mistakeForm.question) return;
    setMistakes((p) => [...p, { id: uid(), ...mistakeForm }]);
    setMistakeForm((f) => ({ ...f, question: "", concept: "" }));
  };

  const resetAll = () => {
    if (!window.confirm("Clear all dashboard data? This cannot be undone.")) return;
    setSubjects(DEFAULT_SUBJECTS);
    setLogs([]); setMocks([]); setMistakes([]);
  };

  if (!loaded) {
    return <div style={{ padding: 40, color: MUTED, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>Loading dashboard…</div>;
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#0B0F14", color: INK, padding: "20px 18px 40px", borderRadius: 14, maxWidth: 980, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 4 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Radio size={18} color={TEAL} />
            <span style={{ fontSize: 12, letterSpacing: 2, color: TEAL, textTransform: "uppercase", fontWeight: 600 }}>GATE ECE 2027</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Preparation dashboard</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 26, fontWeight: 600, color: daysLeft < 30 ? CORAL : TEAL }}>{daysLeft}</div>
            <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase" }}>days to exam</div>
          </div>
          <button style={btnStyle} onClick={resetAll} title="Reset all data"><RotateCcw size={13} />Reset</button>
        </div>
      </div>
      {saveErr && <div style={{ fontSize: 12, color: CORAL, marginTop: 6 }}>Couldn't save — your last change may not persist.</div>}

      <Trace />

      {/* Overview rings + metrics */}
      <SectionHeader icon={<Target size={15} color={TEAL} />} title="Overall progress" />
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <Ring pct={overallPct} label="Syllabus" color={TEAL} />
        <Ring pct={Math.min((totals.pyqs / 1200) * 100, 100)} label="PYQs" sub={`${totals.pyqs}/1200`} color={AMBER} />
        <Ring pct={totals.accuracy} label="Accuracy" sub={`${totals.correct}/${totals.correct + totals.wrong}`} color={totals.accuracy >= 75 ? TEAL : totals.accuracy >= 55 ? AMBER : CORAL} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, flex: 1, minWidth: 260 }}>
          <Metric label="Streak" value={streak} unit="days" accent={streak > 0 ? TEAL : MUTED} />
          <Metric label="This week" value={weeklyHours} unit="hrs/day" />
          <Metric label="Topics done" value={totals.topics} />
          <Metric label="Questions" value={totals.questions} />
        </div>
      </div>

      <Trace />

      {/* Growth chart */}
      <SectionHeader icon={<TrendingUp size={15} color={TEAL} />} title="Growth — accuracy over time" />
      <div style={{ background: PANEL, border: `1px solid ${GRID}`, borderRadius: 10, padding: "14px 10px 6px", marginBottom: 4 }}>
        {chartData.length === 0 ? (
          <div style={{ color: MUTED, fontSize: 12.5, padding: "20px 10px" }}>Log a few days to see your accuracy trend here.</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: "#0B1015", border: `1px solid ${GRID}`, fontSize: 12, borderRadius: 6 }} labelStyle={{ color: INK }} />
              <Line type="monotone" dataKey="accuracy" stroke={TEAL} strokeWidth={2} dot={{ r: 3, fill: TEAL }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <Trace />

      {/* Subject table */}
      <SectionHeader icon={<Zap size={15} color={TEAL} />} title="Subject tracker" />
      <div style={{ overflowX: "auto", border: `1px solid ${GRID}`, borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
          <thead>
            <tr style={{ background: PANEL }}>
              <th style={thStyle}>Subject</th>
              <th style={thStyle}>Chapters</th>
              <th style={thStyle}>Progress</th>
              {COL_KEYS.map((k) => <th key={k} style={{ ...thStyle, textAlign: "center" }}>{COL_LABELS[k]}</th>)}
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => {
              const pct = subjectProgress(s);
              return (
                <tr key={s.id} style={{ borderTop: `1px solid ${GRID}` }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", marginRight: 7, background: s.priority === "high" ? CORAL : AMBER }} />
                    {s.name}
                  </td>
                  <td style={tdStyle}>
                    <input type="number" min={0} style={{ ...inputStyle, width: 40 }} value={s.chaptersDone}
                      onChange={(e) => updateSubject(s.id, { chaptersDone: Math.max(0, Number(e.target.value)) })} />
                    <span style={{ color: MUTED, margin: "0 3px" }}>/</span>
                    <input type="number" min={1} style={{ ...inputStyle, width: 40 }} value={s.chaptersTotal}
                      onChange={(e) => updateSubject(s.id, { chaptersTotal: Math.max(1, Number(e.target.value)) })} />
                  </td>
                  <td style={{ ...tdStyle, minWidth: 110 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: GRID, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 70 ? TEAL : pct >= 35 ? AMBER : CORAL, transition: "width .3s" }} />
                      </div>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: MUTED, width: 30 }}>{pct}%</span>
                    </div>
                  </td>
                  {COL_KEYS.map((k) => (
                    <td key={k} style={{ ...tdStyle, textAlign: "center" }}>
                      <input type="checkbox" checked={s[k]} onChange={(e) => updateSubject(s.id, { [k]: e.target.checked })}
                        style={{ width: 15, height: 15, accentColor: TEAL, cursor: "pointer" }} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Trace />

      {/* Weak / strong */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 260, background: PANEL, border: `1px solid ${GRID}`, borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <AlertTriangle size={14} color={CORAL} />
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Weak areas</span>
          </div>
          {weak.length === 0 ? <div style={{ fontSize: 12, color: MUTED }}>Not enough data yet — log 5+ questions per subject.</div> :
            weak.map((w) => (
              <div key={w.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}>
                <span>{w.name}</span><span style={{ fontFamily: "ui-monospace, monospace", color: CORAL }}>{w.acc}%</span>
              </div>
            ))}
        </div>
        <div style={{ flex: 1, minWidth: 260, background: PANEL, border: `1px solid ${GRID}`, borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <CheckCircle2 size={14} color={TEAL} />
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Strong areas</span>
          </div>
          {strong.length === 0 ? <div style={{ fontSize: 12, color: MUTED }}>Not enough data yet.</div> :
            strong.map((w) => (
              <div key={w.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}>
                <span>{w.name}</span><span style={{ fontFamily: "ui-monospace, monospace", color: TEAL }}>{w.acc}%</span>
              </div>
            ))}
        </div>
      </div>

      <Trace />

      {/* Daily log */}
      <SectionHeader
        icon={<Flame size={15} color={TEAL} />}
        title="Daily tracker"
        right={<button style={btnStyle} onClick={() => setOpenLogForm((v) => !v)}>{openLogForm ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Add entry</button>}
      />
      {openLogForm && (
        <div style={{ background: PANEL, border: `1px solid ${GRID}`, borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <Field label="Date"><input type="date" style={inputStyle} value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} /></Field>
          <Field label="Subject">
            <select style={inputStyle} value={logForm.subject} onChange={(e) => setLogForm({ ...logForm, subject: e.target.value })}>
              {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Hours"><input type="number" step="0.5" style={{ ...inputStyle, width: 60 }} value={logForm.hours} onChange={(e) => setLogForm({ ...logForm, hours: e.target.value })} /></Field>
          <Field label="Topics"><input type="number" style={{ ...inputStyle, width: 55 }} value={logForm.topics} onChange={(e) => setLogForm({ ...logForm, topics: e.target.value })} /></Field>
          <Field label="Questions"><input type="number" style={{ ...inputStyle, width: 65 }} value={logForm.questions} onChange={(e) => setLogForm({ ...logForm, questions: e.target.value })} /></Field>
          <Field label="Correct"><input type="number" style={{ ...inputStyle, width: 60 }} value={logForm.correct} onChange={(e) => setLogForm({ ...logForm, correct: e.target.value })} /></Field>
          <Field label="Wrong"><input type="number" style={{ ...inputStyle, width: 55 }} value={logForm.wrong} onChange={(e) => setLogForm({ ...logForm, wrong: e.target.value })} /></Field>
          <Field label="PYQs"><input type="number" style={{ ...inputStyle, width: 55 }} value={logForm.pyqs} onChange={(e) => setLogForm({ ...logForm, pyqs: e.target.value })} /></Field>
          <button style={btnPrimary} onClick={addLog}><Plus size={13} />Save</button>
        </div>
      )}
      <EntryTable
        rows={logs.slice().reverse()}
        empty="No entries yet — log today's study to start your streak."
        cols={[
          { k: "date", h: "Date" }, { k: "subject", h: "Subject" }, { k: "hours", h: "Hrs" },
          { k: "topics", h: "Topics" }, { k: "questions", h: "Qs" }, { k: "correct", h: "✓" }, { k: "wrong", h: "✗" }, { k: "pyqs", h: "PYQ" },
        ]}
        onDelete={(id) => setLogs((p) => p.filter((l) => l.id !== id))}
      />

      <Trace />

      {/* Mock tests */}
      <SectionHeader
        icon={<Target size={15} color={TEAL} />}
        title="Mock test dashboard"
        right={<button style={btnStyle} onClick={() => setOpenMockForm((v) => !v)}>{openMockForm ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Add mock</button>}
      />
      {openMockForm && (
        <div style={{ background: PANEL, border: `1px solid ${GRID}`, borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <Field label="Name"><input style={{ ...inputStyle, width: 100 }} value={mockForm.name} onChange={(e) => setMockForm({ ...mockForm, name: e.target.value })} placeholder="Mock 1" /></Field>
          <Field label="Date"><input type="date" style={inputStyle} value={mockForm.date} onChange={(e) => setMockForm({ ...mockForm, date: e.target.value })} /></Field>
          <Field label="Total Qs"><input type="number" style={{ ...inputStyle, width: 60 }} value={mockForm.total} onChange={(e) => setMockForm({ ...mockForm, total: e.target.value })} /></Field>
          <Field label="Correct"><input type="number" style={{ ...inputStyle, width: 60 }} value={mockForm.correct} onChange={(e) => setMockForm({ ...mockForm, correct: e.target.value })} /></Field>
          <Field label="Time (min)"><input type="number" style={{ ...inputStyle, width: 70 }} value={mockForm.timeMin} onChange={(e) => setMockForm({ ...mockForm, timeMin: e.target.value })} /></Field>
          <Field label="Weak area"><input style={{ ...inputStyle, width: 110 }} value={mockForm.weakArea} onChange={(e) => setMockForm({ ...mockForm, weakArea: e.target.value })} /></Field>
          <button style={btnPrimary} onClick={addMock}><Plus size={13} />Save</button>
        </div>
      )}
      {mocks.length > 0 && (
        <div style={{ background: PANEL, border: `1px solid ${GRID}`, borderRadius: 10, padding: "10px 4px", marginBottom: 8 }}>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={mocks.map((m) => ({ name: m.name, score: Math.round((Number(m.correct) / Number(m.total)) * 100) || 0 }))} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: "#0B1015", border: `1px solid ${GRID}`, fontSize: 12, borderRadius: 6 }} />
              <Bar dataKey="score" fill={AMBER} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <EntryTable
        rows={mocks.slice().reverse()}
        empty="No mock tests logged yet."
        cols={[
          { k: "name", h: "Mock" }, { k: "date", h: "Date" }, { k: "total", h: "Total" }, { k: "correct", h: "Correct" },
          { k: "timeMin", h: "Time" }, { k: "weakArea", h: "Weak area" },
        ]}
        onDelete={(id) => setMocks((p) => p.filter((m) => m.id !== id))}
      />

      <Trace />

      {/* Mistake book */}
      <SectionHeader
        icon={<AlertTriangle size={15} color={CORAL} />}
        title="Mistake book"
        right={<button style={btnStyle} onClick={() => setOpenMistakeForm((v) => !v)}>{openMistakeForm ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Add mistake</button>}
      />
      {openMistakeForm && (
        <div style={{ background: PANEL, border: `1px solid ${GRID}`, borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <Field label="Subject">
            <select style={inputStyle} value={mistakeForm.subject} onChange={(e) => setMistakeForm({ ...mistakeForm, subject: e.target.value })}>
              {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Question / topic"><input style={{ ...inputStyle, width: 160 }} value={mistakeForm.question} onChange={(e) => setMistakeForm({ ...mistakeForm, question: e.target.value })} /></Field>
          <Field label="Type">
            <select style={inputStyle} value={mistakeForm.type} onChange={(e) => setMistakeForm({ ...mistakeForm, type: e.target.value })}>
              {["Concept", "Formula", "Calculation", "Silly", "Time management"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Correct concept"><input style={{ ...inputStyle, width: 160 }} value={mistakeForm.concept} onChange={(e) => setMistakeForm({ ...mistakeForm, concept: e.target.value })} /></Field>
          <button style={btnPrimary} onClick={addMistake}><Plus size={13} />Save</button>
        </div>
      )}
      <div style={{ overflowX: "auto", border: `1px solid ${GRID}`, borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
          <thead>
            <tr style={{ background: PANEL }}>
              <th style={thStyle}>Subject</th><th style={thStyle}>Question / topic</th><th style={thStyle}>Type</th>
              <th style={thStyle}>Correct concept</th><th style={{ ...thStyle, textAlign: "center" }}>Revised</th><th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {mistakes.length === 0 && <tr><td colSpan={6} style={{ ...tdStyle, color: MUTED, textAlign: "center", padding: 18 }}>No mistakes logged yet.</td></tr>}
            {mistakes.slice().reverse().map((m) => (
              <tr key={m.id} style={{ borderTop: `1px solid ${GRID}` }}>
                <td style={tdStyle}>{m.subject}</td>
                <td style={tdStyle}>{m.question}</td>
                <td style={tdStyle}><span style={{ color: m.type === "Concept" ? CORAL : AMBER }}>{m.type}</span></td>
                <td style={tdStyle}>{m.concept}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <input type="checkbox" checked={m.revised} onChange={(e) => setMistakes((p) => p.map((x) => x.id === m.id ? { ...x, revised: e.target.checked } : x))} style={{ accentColor: TEAL, width: 15, height: 15, cursor: "pointer" }} />
                </td>
                <td style={tdStyle}><button style={{ ...btnStyle, padding: 5, border: "none", background: "none" }} onClick={() => setMistakes((p) => p.filter((x) => x.id !== m.id))}><Trash2 size={13} color={MUTED} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      {children}
    </div>
  );
}

function EntryTable({ rows, cols, onDelete, empty }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${GRID}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
        <thead>
          <tr style={{ background: PANEL }}>
            {cols.map((c) => <th key={c.k} style={thStyle}>{c.h}</th>)}
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length + 1} style={{ ...tdStyle, color: MUTED, textAlign: "center", padding: 18 }}>{empty}</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: `1px solid ${GRID}` }}>
              {cols.map((c) => <td key={c.k} style={tdStyle}>{r[c.k] || "—"}</td>)}
              <td style={tdStyle}><button style={{ padding: 5, border: "none", background: "none", cursor: "pointer" }} onClick={() => onDelete(r.id)}><Trash2 size={13} color={MUTED} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = { textAlign: "left", padding: "8px 10px", fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 };
const tdStyle = { padding: "7px 10px", color: INK };
