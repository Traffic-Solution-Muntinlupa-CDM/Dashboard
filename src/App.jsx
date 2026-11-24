import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { loadSimulationSnapshot } from './simulationBridge';

const approaches = [
  { name: 'Northbound', count: 128, wait: '38 s', queue: 'Moderate', color: '#075a9c' },
  { name: 'Southbound', count: 104, wait: '29 s', queue: 'Light', color: '#2879ad' },
  { name: 'Brudger', count: 86, wait: '42 s', queue: 'Moderate', color: '#4f8fba' },
  { name: 'Estanislao', count: 72, wait: '21 s', queue: 'Light', color: '#749fc6' },
  { name: 'City Hall', count: 54, wait: '35 s', queue: 'Light', color: '#345f87' },
];

const trend = [
  { time: '07:00', volume: 220, wait: 19, queue: 7, throughput: 196 },
  { time: '07:15', volume: 298, wait: 25, queue: 12, throughput: 255 },
  { time: '07:30', volume: 352, wait: 31, queue: 16, throughput: 297 },
  { time: '07:45', volume: 404, wait: 39, queue: 21, throughput: 348 },
  { time: '08:00', volume: 444, wait: 33, queue: 17, throughput: 401 },
  { time: '08:15', volume: 418, wait: 28, queue: 13, throughput: 390 },
];

const nav = [
  ['overview', 'Overview', 'overview'],
  ['analytics', 'Traffic analytics', 'chart'],
  ['operations', 'Signal operations', 'signal'],
  ['maintenance', 'Maintenance', 'tools'],
  ['activity', 'Activity & logs', 'log'],
];

const chartTooltip = {
  background: '#ffffff',
  border: '1px solid #9eb4c6',
  borderRadius: 4,
  boxShadow: '0 8px 24px rgba(16, 42, 67, .12)',
  fontFamily: 'Atkinson Hyperlegible, sans-serif',
  fontSize: 13,
};

function Icon({ name }) {
  const paths = {
    overview: <><path d="M4 5h7v6H4zM13 5h7v10h-7zM4 13h7v6H4zM13 17h7v2h-7z" /></>,
    chart: <><path d="M4 19V9m5 10V5m6 14v-7m5 7V3" /><path d="M3 19h18" /></>,
    signal: <><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3m0-14-3 3M8 16l-3 3" /></>,
    tools: <><path d="m14 6 4-4 4 4-4 4M18 2v8M4 21l7-7" /><path d="M13 13 8 8 3 9l-1-1 6-6 1 1-1 5 5 5" /></>,
    log: <><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5" /></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function Badge({ tone = 'neutral', children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Card({ children, className = '' }) {
  return <section className={`atlas-panel ${className}`}>{children}</section>;
}

function SectionHeading({ title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function PageTitle({ title, description }) {
  return (
    <div className="page-title">
      <div className="title-copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}

function MiniIntersection({ phase = 'Northbound' }) {
  const signals = ['Northbound', 'Southbound', 'Brudger', 'Estanislao', 'City Hall'];
  return (
    <figure className="intersection" aria-label={`Schematic intersection with ${phase} active`}>
      <div className="map-grid" />
      <div className="north-marker"><span>N</span><i /></div>
      <div className="road vertical"><span>NORTH / SOUTH</span></div>
      <div className="road horizontal"><span>BRUDGER — CITY HALL</span></div>
      <div className="center" />
      {signals.map((name, index) => (
        <span key={name} className={`light light-${index} ${name === phase ? 'active' : ''}`}>
          <i />
          <b>{name}</b>
        </span>
      ))}
    </figure>
  );
}

function Chart({ dataKey, color, title, unit }) {
  return (
    <Card className="chart">
      <SectionHeading title={title} />
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={trend}>
          <defs>
            <linearGradient id={`${dataKey}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity=".18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#d8d5c8" strokeDasharray="2 5" />
          <XAxis dataKey="time" tickLine={false} axisLine={{ stroke: '#8e998f' }} />
          <YAxis tickLine={false} axisLine={false} unit={unit} />
          <Tooltip contentStyle={chartTooltip} />
          <Area type="linear" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${dataKey}-fill)`} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default function App() {
  const [page, setPage] = useState('overview');
  const [snapshot, setSnapshot] = useState(null);
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [settings, setSettings] = useState({
    profile: 'Balanced daytime', min: 10, max: 60, yellow: 10, allRed: 3, pedestrian: 30, mode: 'Automatic',
  });

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const next = await loadSimulationSnapshot(controller.signal);
        if (alive) setSnapshot(next);
      } catch {
        if (alive) setSnapshot(null);
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { alive = false; controller.abort(); clearInterval(id); };
  }, []);

  const rows = useMemo(() => snapshot
    ? approaches.map((row) => ({ ...row, count: snapshot.approaches?.find((item) => item.name === row.name)?.observedVehicles ?? row.count }))
    : approaches, [snapshot]);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const phase = snapshot?.controllerDecision?.phase || 'Northbound';
  const set = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  const log = (type, title, description, index = '—') => (
    <div className="log-row">
      <span className="log-index">{index}</span>
      <Badge tone={type}>{type}</Badge>
      <div><strong>{title}</strong><p>{description}</p></div>
      <time>Recent</time>
    </div>
  );

  const overview = <>
    <div className="overview-title">
      <div>
        <h1>Intersection overview</h1>
        <p>Current traffic conditions and signal activity at the ANDAR intersection.</p>
      </div>
    </div>
    <div className="overview-stage">
      <section className="situation">
        <div className="situation-heading">
          <div><span>Current condition</span><h2>Moderate demand</h2></div>
          <Badge tone="ok">5 of 5 feeds available</Badge>
        </div>
        <div className="situation-body">
          <MiniIntersection phase={phase} />
          <div className="phase-focus">
            <span className="phase-light" />
            <p>Active movement</p>
            <strong>{phase}</strong>
            <h3>Green</h3>
            <div><span>Phase duration</span><b>{snapshot?.controllerDecision?.greenSeconds || 35} seconds</b></div>
            <div><span>Controller</span><b>Available</b></div>
          </div>
        </div>
        <div className="summary-metrics">
          <div><strong>{total}</strong><span>Observed vehicles</span><p>08:00–08:15 window</p></div>
          <div><strong>33 <small>s</small></strong><span>Average waiting time</span><p>Current interval</p></div>
          <div><strong>71<small>%</small></strong><span>Utilization</span><p>Capacity estimate</p></div>
        </div>
      </section>
      <section className="operational-brief">
        <div className="brief-heading">
          <h2>Operational brief</h2>
          <button className="text-button" onClick={() => setPage('activity')}>View activity <Icon name="arrow" /></button>
        </div>
        <div className="priority-item">
          <h3>High observed volume</h3>
          <strong>Northbound · 128 vehicles</strong>
          <p>Vehicle count for the current 15-minute interval.</p>
        </div>
        <div className="brief-status">
          <div><span className="status-dot ok" /><span><b>Dashboard services available</b><p>Traffic views are operating normally</p></span></div>
          <div><span className="status-dot neutral" /><span><b>Field controller unconfirmed</b><p>No physical acknowledgement connected</p></span></div>
        </div>
      </section>
    </div>
    <section className="approach-section">
      <div className="approach-heading"><div><h2>Approach conditions</h2><p>Observed traffic by incoming movement</p></div><Badge>08:00–08:15</Badge></div>
      <div className="approach-list">
        <div className="approach-list-head"><span>Approach</span><span>Vehicles</span><span>Average wait</span><span>Queue</span></div>
        {rows.map((row) => <div className="approach-row" key={row.name} style={{ '--approach': row.color }}>
          <span className="approach-name"><i /><strong>{row.name}</strong></span>
          <span>{row.count}</span>
          <span>{row.wait}</span>
          <Badge tone={row.queue === 'Moderate' ? 'warning' : 'neutral'}>{row.queue}</Badge>
        </div>)}
      </div>
    </section>
  </>;

  const analytics = <>
    <PageTitle title="Traffic performance" description="Volume, waiting time, queues, and throughput across the morning period." />
    <div className="chart-grid">
      <Chart code="A / 01" dataKey="volume" color="#146b55" title="Traffic volume" unit="" />
      <Chart code="A / 02" dataKey="wait" color="#c36818" title="Waiting-time trend" unit="s" />
      <Chart code="A / 03" dataKey="queue" color="#a5454f" title="Queue-length trend" unit="" />
      <Chart code="A / 04" dataKey="throughput" color="#246a92" title="Throughput" unit="" />
    </div>
    <div className="two-col">
      <Card>
        <SectionHeading code="A / 05" title="Distribution by approach" />
        <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={rows} dataKey="count" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={1}>{rows.map((row) => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip contentStyle={chartTooltip} /></PieChart></ResponsiveContainer>
      </Card>
      <Card>
        <SectionHeading code="A / 06" title="Peak-period comparison" />
        <ResponsiveContainer width="100%" height={260}><BarChart data={trend}><CartesianGrid vertical={false} stroke="#d8d5c8" strokeDasharray="2 5" /><XAxis dataKey="time" tickLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} /><Bar dataKey="volume" fill="#146b55" /><Bar dataKey="throughput" fill="#9fb9ab" /></BarChart></ResponsiveContainer>
      </Card>
    </div>
  </>;

  const operations = <>
    <PageTitle title="Signal operations" description="Current movement, phase duration, sequence, and recent controller activity." />
    <div className="operations-grid">
      <Card className="operation-map">
        <SectionHeading code="LIVE SCHEMATIC / 01" title="Selected movement" />
        <MiniIntersection phase={phase} />
        <div className="operation-callout"><Badge tone="ok">Active</Badge><h2>{phase} GREEN</h2><p>Current signal movement</p><strong>{snapshot?.controllerDecision?.greenSeconds || 35} seconds</strong></div>
      </Card>
      <Card>
        <SectionHeading code="SEQUENCE / 02" title="Signal sequence" description="The active movement is highlighted." />
        <ol className="sequence">{['Northbound', 'Southbound', 'Brudger', 'Estanislao', 'City Hall', 'Pedestrian'].map((name, index) => <li className={name === phase ? 'current' : ''} key={name}><span>{String(index + 1).padStart(2, '0')}</span><i />{name}{name === phase && <Badge tone="ok">Active</Badge>}</li>)}</ol>
      </Card>
      <Card>
        <SectionHeading code="DECISION LOG / 03" title="Recent decisions" />
        {log('ok', 'Phase selected', `${phase} served for ${snapshot?.controllerDecision?.greenSeconds || 35} seconds.`, '01')}
        {log('neutral', 'Timing profile', `${settings.profile} is selected.`, '02')}
        {log('offline', 'Transition confirmation', 'Physical controller acknowledgement is unavailable.', '03')}
      </Card>
    </div>
  </>;

  const maintenance = <>
    <PageTitle title="Controller configuration" description="Manage timing profiles, operating limits, and system logging." />
    <div className="maintenance-grid">
      <Card><SectionHeading code="M / 01" title="Timing profile" />
        <label>Approved profile<select value={settings.profile} onChange={(event) => set('profile', event.target.value)}><option>Balanced daytime</option><option>Weekday peak</option><option>Night operation</option></select></label>
        <label>Operating mode<select value={settings.mode} onChange={(event) => set('mode', event.target.value)}><option>Automatic</option><option>Manual</option></select></label>
        <label className="check"><input type="checkbox" /> Emergency override</label>
      </Card>
      <Card><SectionHeading code="M / 02" title="Timing guardrails" />
        <div className="form-grid">{[['min', 'Minimum green (s)'], ['max', 'Maximum green (s)'], ['yellow', 'Yellow interval (s)'], ['allRed', 'All-red clearance (s)'], ['pedestrian', 'Pedestrian duration (s)']].map(([key, label]) => <label key={key}>{label}<input type="number" min="0" value={settings[key]} onChange={(event) => set(key, event.target.value)} /></label>)}</div>
        <label>Safety buffer<select><option>Standard</option><option>Enhanced</option></select></label>
      </Card>
      <Card><SectionHeading code="M / 03" title="Logging & component status" />
        <label className="check"><input type="checkbox" defaultChecked /> Record configuration changes</label>
        <label className="check"><input type="checkbox" defaultChecked /> Show service status in activity log</label>
        <div className="component-status"><span>Dashboard <Badge tone="ok">Available</Badge></span><span>Traffic data service <Badge>Automatic</Badge></span><span>Field controller <Badge tone="offline">Unconfirmed</Badge></span></div>
        <button className="primary" onClick={() => setNotice('Settings updated for this session.')}>Save settings <Icon name="arrow" /></button>
        {notice && <p className="inline-notice" role="status">{notice}</p>}
      </Card>
    </div>
  </>;

  const activity = <>
    <PageTitle title="Activity and system logs" description="Recent traffic, controller, configuration, and service events." />
    <Card className="log-card">
      <SectionHeading code="EVENT REGISTER / 05" title="Recent activity" />
      <div className="legend"><Badge tone="ok">Operational</Badge><Badge tone="warning">Advisory</Badge><Badge>System</Badge><Badge tone="offline">Unconfirmed</Badge></div>
      {log('ok', 'Signal state updated', `${phase} is the active movement.`, '01')}
      {log('warning', 'Volume advisory raised', 'Northbound reached the volume advisory threshold.', '02')}
      {log('neutral', 'Configuration available', 'Controller timing values can be reviewed in Maintenance.', '03')}
      {log('ok', 'Dashboard available', 'Traffic operations workspace is online.', '04')}
      {log('offline', 'Physical controller confirmation', 'No controller, camera, sensor, or authentication service is connected.', '05')}
    </Card>
  </>;

  const pages = { overview, analytics, operations, maintenance, activity };
  return (
    <div className="app">
      <a className="skip" href="#content">Skip to content</a>
      <header>
        <button className="brand" onClick={() => setPage('overview')} aria-label="ANDAR overview">
          <span className="brand-name"><b>ANDAR</b></span>
        </button>
        <div className="city-name">Muntinlupa City</div>
        <div className="header-controls">
          <button className="menu" onClick={() => setMobileNav(!mobileNav)} aria-expanded={mobileNav}><Icon name="menu" /> Menu</button>
        </div>
      </header>
      <div className="shell">
        <aside className={mobileNav ? 'open' : ''}>
          <div className="nav-heading"><span>Workspace</span></div>
          <nav aria-label="Primary navigation">{nav.map(([id, label, icon]) => <button className={page === id ? 'selected' : ''} onClick={() => { setPage(id); setMobileNav(false); }} key={id}><Icon name={icon} /><span>{label}</span><i /></button>)}</nav>
        </aside>
        <main id="content" key={page}>{pages[page]}</main>
      </div>
    </div>
  );
}
