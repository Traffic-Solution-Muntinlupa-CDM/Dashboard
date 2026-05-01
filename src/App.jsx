import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer
} from "recharts";

const PHASE_COLORS = {
  NORTHBOUND: "#22c55e",
  SOUTHBOUND: "#22c55e",
  BRUDGER: "#f59e0b",
  ESTANISLAO: "#f59e0b",
  "CITY HALL": "#0ea5e9",
  PEDESTRIAN: "#818cf8",
};

const LOCATION_DATA = [
  { name: "Brudger", value: 52.1, color: "#0ea5e9" },
  { name: "Southbound", value: 22.6, color: "#f59e0b" },
  { name: "Northbound", value: 13.9, color: "#22c55e" },
  { name: "City Hall", value: 11.2, color: "#818cf8" },
];

const PHASES = ["NORTHBOUND", "SOUTHBOUND", "BRUDGER", "ESTANISLAO", "CITY HALL", "PEDESTRIAN"];

const BASE_CHART_DATA = [
  { month: "Jan", thisYear: 18400, lastYear: 14900 },
  { month: "Feb", thisYear: 21600, lastYear: 17200 },
  { month: "Mar", thisYear: 19800, lastYear: 16300 },
  { month: "Apr", thisYear: 25200, lastYear: 20800 },
  { month: "May", thisYear: 27900, lastYear: 21400 },
  { month: "Jun", thisYear: 24100, lastYear: 19700 },
  { month: "Jul", thisYear: 26300, lastYear: 18900 },
];

function IntersectionSVG({ currentPhase, phaseTimer, vehicles }) {
  const getVehiclePos = (v) => {
    const p = v.progress / 100;
    if (v.lane === "north") return { x: 94, y: 148 - p * 62, c: v.type === "jeepney" ? "#22c55e" : v.type === "bus" ? "#f59e0b" : "#0ea5e9", vert: true };
    if (v.lane === "south") return { x: 106, y: 52 + p * 62, c: "#818cf8", vert: true };
    if (v.lane === "east") return { x: 148 - p * 62, y: 94, c: "#0ea5e9", vert: false };
    return { x: 52 + p * 62, y: 106, c: "#f59e0b", vert: false };
  };

  const light = (ph) => (currentPhase === ph ? "#22c55e" : "#ef4444");

  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ maxWidth: 220, maxHeight: 220 }}>
      <rect width="200" height="200" fill="#060e1c" />
      <rect x="0" y="0" width="78" height="78" fill="#0a1628" rx="6" />
      <rect x="122" y="0" width="78" height="78" fill="#0a1628" rx="6" />
      <rect x="0" y="122" width="78" height="78" fill="#0a1628" rx="6" />
      <rect x="122" y="122" width="78" height="78" fill="#0a1628" rx="6" />
      <rect x="78" y="0" width="44" height="200" fill="#131e30" />
      <rect x="0" y="78" width="200" height="44" fill="#131e30" />
      <line x1="100" y1="0" x2="100" y2="74" stroke="#1e3050" strokeWidth="1" strokeDasharray="5,5" />
      <line x1="100" y1="126" x2="100" y2="200" stroke="#1e3050" strokeWidth="1" strokeDasharray="5,5" />
      <line x1="0" y1="100" x2="74" y2="100" stroke="#1e3050" strokeWidth="1" strokeDasharray="5,5" />
      <line x1="126" y1="100" x2="200" y2="100" stroke="#1e3050" strokeWidth="1" strokeDasharray="5,5" />
      <rect x="78" y="78" width="44" height="44" fill="#1a2a40" />
      {[0,1,2,3,4].map(i => <rect key={i} x={80+i*5} y="74" width="3" height="4" fill="#253040" rx="1" />)}
      {[0,1,2,3,4].map(i => <rect key={i} x={80+i*5} y="122" width="3" height="4" fill="#253040" rx="1" />)}
      <rect x="70" y="58" width="7" height="13" rx="2" fill={light("NORTHBOUND")} />
      <rect x="123" y="129" width="7" height="13" rx="2" fill={light("SOUTHBOUND")} />
      <rect x="129" y="70" width="13" height="7" rx="2" fill={light("BRUDGER")} />
      <rect x="58" y="123" width="13" height="7" rx="2" fill={light("ESTANISLAO")} />
      <circle cx="100" cy="100" r="4" fill={PHASE_COLORS[currentPhase] || "#fff"} opacity="0.85" />
      <text x="100" y="11" textAnchor="middle" fill="#4a6080" fontSize="8" fontFamily="monospace">N</text>
      <text x="100" y="196" textAnchor="middle" fill="#4a6080" fontSize="8" fontFamily="monospace">S</text>
      <text x="194" y="103" textAnchor="middle" fill="#4a6080" fontSize="8" fontFamily="monospace">E</text>
      <text x="7" y="103" textAnchor="middle" fill="#4a6080" fontSize="8" fontFamily="monospace">W</text>
      {vehicles.map(v => {
        const pos = getVehiclePos(v);
        return (
          <rect
            key={v.id}
            x={pos.x - (pos.vert ? 4 : 6)} y={pos.y - (pos.vert ? 7 : 4)}
            width={pos.vert ? 8 : 13} height={pos.vert ? 13 : 8}
            rx="2" fill={pos.c} opacity="0.92"
          />
        );
      })}
      <text x="100" y="194" textAnchor="middle" fill="#2a4060" fontSize="7" fontFamily="monospace">
        {phaseTimer}s remaining
      </text>
    </svg>
  );
}

function StatCard({ label, value, sub, trendUp, trendPct, accent = "#f1f5f9" }) {
  return (
    <div style={{ background: "#0d1a2e", border: "1px solid #1a2d45", borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, color: "#4a6080", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent, fontFamily: "'Courier New', monospace", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{sub}</div>}
      {trendPct !== undefined && (
        <div style={{ fontSize: 11, color: trendUp ? "#22c55e" : "#ef4444", marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
          <span>{trendUp ? "▲" : "▼"}</span>
          <span>{Math.abs(trendPct).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function PhaseBar({ phase, active, color }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
      background: active ? `${color}15` : "transparent",
      border: `1px solid ${active ? color + "40" : "#1a2d45"}`,
      borderRadius: 6, marginBottom: 5,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: active ? color : "#253040", flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: active ? color : "#4a6080", fontFamily: "monospace", flex: 1 }}>{phase}</span>
      {active && <span style={{ fontSize: 10, color: color, fontFamily: "monospace" }}>ACTIVE</span>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d1a2e", border: "1px solid #1a2d45", borderRadius: 6, padding: "8px 12px" }}>
      <p style={{ margin: "0 0 4px", color: "#94a3b8", fontSize: 11 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "2px 0", color: p.color, fontSize: 12, fontFamily: "monospace" }}>
          {p.name}: {Math.round(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function ANDARDashboard() {
  const [time, setTime] = useState(new Date());
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [phaseTimer, setPhaseTimer] = useState(35);
  const [totalVehicles, setTotalVehicles] = useState(71);
  const [laneA, setLaneA] = useState(32);
  const [laneB, setLaneB] = useState(39);
  const [dailyTotal, setDailyTotal] = useState(3298);
  const [capacity, setCapacity] = useState(64);
  const [waitTime, setWaitTime] = useState(34);
  const [storage, setStorage] = useState(27);
  const [chartData, setChartData] = useState(BASE_CHART_DATA);
  const [vehicles, setVehicles] = useState([
    { id: 1, lane: "north", progress: 15, type: "car" },
    { id: 2, lane: "south", progress: 55, type: "jeepney" },
    { id: 3, lane: "east", progress: 35, type: "car" },
    { id: 4, lane: "north", progress: 75, type: "bus" },
    { id: 5, lane: "west", progress: 20, type: "car" },
    { id: 6, lane: "south", progress: 10, type: "car" },
    { id: 7, lane: "west", progress: 70, type: "jeepney" },
  ]);
  const [alertMsg, setAlertMsg] = useState("System nominal — all sensors operational");
  const [alertType, setAlertType] = useState("ok");

  const currentPhase = PHASES[phaseIdx];

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setPhaseTimer(prev => {
        if (prev <= 1) {
          setPhaseIdx(i => (i + 1) % PHASES.length);
          return 10 + Math.floor(Math.random() * 50);
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const delta = (v, lo, hi, mag) => Math.max(lo, Math.min(hi, v + Math.floor((Math.random() - 0.5) * mag)));
      setTotalVehicles(v => delta(v, 40, 130, 6));
      setLaneA(v => delta(v, 8, 65, 4));
      setLaneB(v => delta(v, 8, 75, 4));
      setDailyTotal(v => v + Math.floor(Math.random() * 4));
      setCapacity(v => delta(v, 38, 97, 3));
      setWaitTime(v => delta(v, 5, 85, 4));
      setStorage(v => Math.min(79, v + (Math.random() < 0.3 ? 1 : 0)));
      const alerts = [
        ["System nominal — all sensors operational", "ok"],
        ["Queue pressure elevated on Southbound lane", "warn"],
        ["RL Agent switched to maximum-duration cycle", "info"],
        ["Daily vehicle count exceeds yesterday by 8.2%", "info"],
        ["Phase transition: BRUDGER → NORTHBOUND", "ok"],
      ];
      const pick = alerts[Math.floor(Math.random() * alerts.length)];
      setAlertMsg(pick[0]);
      setAlertType(pick[1]);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setVehicles(vs => vs.map(v => ({ ...v, progress: (v.progress + 1.5) % 100 })));
    }, 40);
    return () => clearInterval(t);
  }, []);

  const alertColor = alertType === "warn" ? "#f59e0b" : alertType === "info" ? "#0ea5e9" : "#22c55e";

  const laneAPct = Math.round(((laneA - 32) / 32) * 100);
  const laneBPct = Math.round(((laneB - 39) / 39) * 100);
  const capPct = Math.round(((capacity - 64) / 64) * 100);
  const waitPct = Math.round(((waitTime - 34) / 34) * 100);

  return (
    <div style={{ background: "#060e1c", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#f1f5f9" }}>

      {/* ── Header ── */}
      <div style={{ background: "#091220", borderBottom: "1px solid #1a2d45", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#0ea5e9", color: "#fff", padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em" }}>ADMIN</div>
          <div style={{ borderLeft: "1px solid #1a2d45", paddingLeft: 14 }}>
            <div style={{ fontSize: 10, color: "#4a6080", lineHeight: 1.4 }}>Real-Time Vehicle Categorization and Pedestrian Prioritization Using YOLO</div>
            <div style={{ fontSize: 10, color: "#4a6080", lineHeight: 1.4 }}>and Machine Learning for Adaptive Traffic Signal Control at Muntinlupa City Hall Road</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#4a6080" }}>Barangay Putatan, Muntinlupa City</div>
            <div style={{ fontSize: 14, color: "#0ea5e9", fontFamily: "monospace", letterSpacing: "0.05em" }}>
              {time.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["MUN", "CDM"].map(label => (
              <div key={label} style={{ width: 34, height: 34, borderRadius: "50%", background: "#0d1a2e", border: "1px solid #0ea5e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#0ea5e9", letterSpacing: "0.05em" }}>{label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Alert bar ── */}
      <div style={{ background: `${alertColor}10`, borderBottom: `1px solid ${alertColor}30`, padding: "6px 20px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: alertColor, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: alertColor, fontFamily: "monospace" }}>{alertMsg}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#4a6080" }}>
          {time.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {/* ── Main content ── */}
      <div style={{ padding: "14px 20px" }}>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "0.06em" }}>
                <span style={{ color: "#0ea5e9" }}>ANDAR</span>{" "}
                <span style={{ color: "#f1f5f9" }}>DASHBOARD</span>
              </h1>
              <span style={{ background: "#22c55e18", color: "#22c55e", fontSize: 10, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", border: "1px solid #22c55e30" }}>● LIVE</span>
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "#4a6080" }}>Adaptive Network for Dynamic and Automated Roadway Management · Edge-Based Computer Vision</p>
          </div>
          <select style={{ background: "#0d1a2e", border: "1px solid #1a2d45", color: "#94a3b8", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
            <option>Today</option>
            <option>This Week</option>
            <option>This Month</option>
          </select>
        </div>

        {/* ── Top row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 200px", gap: 14, marginBottom: 14 }}>

          {/* Intersection view */}
          <div style={{ background: "#091220", border: "1px solid #1a2d45", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #1a2d45", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em" }}>Intersection View</span>
              <span style={{ fontSize: 10, color: "#0ea5e9", fontFamily: "monospace" }}>CAM-01</span>
            </div>
            <div style={{ padding: 12, display: "flex", justifyContent: "center" }}>
              <IntersectionSVG currentPhase={currentPhase} phaseTimer={phaseTimer} vehicles={vehicles} />
            </div>
            <div style={{ padding: "8px 12px", borderTop: "1px solid #1a2d45", background: "#060e1c", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: "#4a6080" }}>PHASE:</span>
              <span style={{ background: `${PHASE_COLORS[currentPhase]}20`, color: PHASE_COLORS[currentPhase], padding: "2px 7px", borderRadius: 4, fontSize: 10, fontFamily: "monospace", fontWeight: 700, border: `1px solid ${PHASE_COLORS[currentPhase]}40` }}>
                {currentPhase}
              </span>
              <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}>{phaseTimer}s</span>
            </div>
          </div>

          {/* Center stats */}
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
              <StatCard label="Max Storage" value={`${storage}/80 GB`} sub="log capacity" accent="#f59e0b" />
              <StatCard label="Daily Vehicles" value={dailyTotal.toLocaleString()} sub="total since midnight" trendUp={true} trendPct={8.2} />
              <StatCard label="Avg Session" value="2m 34s" sub="avg time at intersection" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <StatCard label="Intersection Capacity" value={`${capacity}%`} sub="of max capacity" trendUp={capPct >= 0} trendPct={capPct} accent={capacity > 85 ? "#ef4444" : capacity > 70 ? "#f59e0b" : "#f1f5f9"} />
              <StatCard label="Lane Utilization" value="86%" sub="avg across lanes" trendUp={true} trendPct={3.4} />
              <StatCard label="Waiting Time" value={`${waitTime > 0 ? "+" : ""}${waitTime}%`} sub="vs. fixed-time baseline" trendUp={waitPct < 0} trendPct={Math.abs(waitPct)} accent={waitTime > 40 ? "#ef4444" : waitTime > 20 ? "#f59e0b" : "#22c55e"} />
            </div>
          </div>

          {/* Phase list */}
          <div style={{ background: "#091220", border: "1px solid #1a2d45", borderRadius: 10, padding: "12px 12px" }}>
            <div style={{ fontSize: 11, color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Signal Phases</div>
            {PHASES.map(ph => (
              <PhaseBar key={ph} phase={ph} active={ph === currentPhase} color={PHASE_COLORS[ph]} />
            ))}
            <div style={{ marginTop: 10, borderTop: "1px solid #1a2d45", paddingTop: 10 }}>
              <div style={{ fontSize: 10, color: "#4a6080", marginBottom: 4 }}>CONTROLLER MODE</div>
              <div style={{ background: "#0ea5e918", border: "1px solid #0ea5e930", borderRadius: 5, padding: "5px 8px", fontSize: 10, color: "#0ea5e9", fontFamily: "monospace", textAlign: "center" }}>
                RL-PPO ADAPTIVE
              </div>
            </div>
          </div>
        </div>

        {/* ── Lane counts ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
          {[
            { label: "TOTAL INTERSECTION", val: totalVehicles, pct: Math.round(((totalVehicles - 71) / 71) * 100), color: "#0ea5e9", borderColor: "#0ea5e9" },
            { label: "LANE A VEHICLES", val: laneA, pct: laneAPct, color: "#818cf8", borderColor: "#1a2d45" },
            { label: "LANE B VEHICLES", val: laneB, pct: laneBPct, color: "#f59e0b", borderColor: "#1a2d45" },
          ].map(({ label, val, pct, color, borderColor }) => (
            <div key={label} style={{ background: "#091220", border: `1px solid ${borderColor}`, borderRadius: 10, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: `${Math.min(100, val)}%`, height: 2, background: color, opacity: 0.6 }} />
              <div style={{ fontSize: 11, color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 38, fontWeight: 700, color, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>{val}</div>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 12, color: pct >= 0 ? "#22c55e" : "#ef4444" }}>
                  {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%
                </span>
                <span style={{ fontSize: 11, color: "#4a6080" }}>from baseline</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>

          {/* Area chart */}
          <div style={{ background: "#091220", border: "1px solid #1a2d45", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Total Vehicles</div>
                <div style={{ fontSize: 11, color: "#4a6080" }}>Monthly comparison · Average Time</div>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 20, height: 2, background: "#0ea5e9", display: "inline-block", borderRadius: 2 }} />
                  <span style={{ color: "#94a3b8" }}>This year</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 20, height: 0, display: "inline-block", borderTop: "2px dashed #2a4060" }} />
                  <span style={{ color: "#94a3b8" }}>Last year</span>
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#253040" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#253040" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2d45" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#4a6080", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#4a6080", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="thisYear" name="This Year" stroke="#0ea5e9" strokeWidth={2} fill="url(#g1)" dot={false} />
                <Area type="monotone" dataKey="lastYear" name="Last Year" stroke="#2a4060" strokeWidth={1.5} fill="url(#g2)" dot={false} strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart */}
          <div style={{ background: "#091220", border: "1px solid #1a2d45", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Traffic by Location</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <PieChart width={220} height={140}>
                <Pie data={LOCATION_DATA} cx={110} cy={70} innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {LOCATION_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0d1a2e", border: "1px solid #1a2d45", borderRadius: 6, color: "#f1f5f9", fontSize: 12 }} formatter={(v) => [`${v}%`, "Share"]} />
              </PieChart>
            </div>
            <div style={{ marginTop: 6 }}>
              {LOCATION_DATA.map((loc, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: i < LOCATION_DATA.length - 1 ? "1px solid #0d1a2e" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: loc.color, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{loc.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: loc.color, fontWeight: 700 }}>{loc.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #1a2d45" }}>
          <span style={{ fontSize: 10, color: "#2a4060" }}>ANDAR · YOLOv8-nano · PPO/MDP · SUMO Simulation · Raspberry Pi 4 Edge Deployment</span>
          <span style={{ fontSize: 10, color: "#2a4060" }}>Colegio de Muntinlupa · BS Computer Engineering · 2026</span>
        </div>
      </div>
    </div>
  );
}