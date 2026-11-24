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
  { name: 'Northbound', count: 128, wait: '38 s', queue: 'Moderate', color: '#146b55' },
  { name: 'Southbound', count: 104, wait: '29 s', queue: 'Light', color: '#246a92' },
  { name: 'Brudger', count: 86, wait: '42 s', queue: 'Moderate', color: '#d17a20' },
  { name: 'Estanislao', count: 72, wait: '21 s', queue: 'Light', color: '#725b8e' },
  { name: 'City Hall', count: 54, wait: '35 s', queue: 'Light', color: '#a5454f' },
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
  background: '#fffdf6',
  border: '1px solid #213c35',
  borderRadius: 0,
  boxShadow: '4px 4px 0 rgba(23, 48, 42, .12)',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 11,
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

function SectionHeading({ code, title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <span className="section-code">{code}</span>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function PageTitle({ eyebrow, title, description, badge }) {
  return (
    <div className="page-title">
      <div className="title-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {badge}
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
      <figcaption><span>FIG 01</span> Schematic geometry · illustrative only</figcaption>
    </figure>
  );
}

function Metric({ code, label, value, note, tone }) {
  return (
    <Card className="metric">
      <div className="metric-index">{code}</div>
      <p>{label}</p>
      <strong className={tone || ''}>{value}</strong>
      <small>{note}</small>
    </Card>
  );
}

function Chart({ dataKey, color, title, unit, code }) {
  return (
    <Card className="chart">
      <SectionHeading code={code} title={title} description="Example data · 15-minute windows" action={<Badge>Illustrative</Badge>} />
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
  const [source, setSource] = useState('example');
  const [snapshot, setSnapshot] = useState(null);
  const [sourceError, setSourceError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [settings, setSettings] = useState({
    profile: 'Balanced daytime', min: 10, max: 60, yellow: 10, allRed: 3, pedestrian: 30, mode: 'Automatic',
  });

  useEffect(() => {
    if (source !== 'sumo') return undefined;
    let alive = true;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const next = await loadSimulationSnapshot(controller.signal);
        if (alive) { setSnapshot(next); setSourceError(''); }
      } catch {
        if (alive) { setSnapshot(null); setSourceError('Local SUMO bridge unavailable — showing example data.'); }
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { alive = false; controller.abort(); clearInterval(id); };
  }, [source]);

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
      <time>Example</time>
    </div>
  );

  const overview = <>
    <PageTitle
      eyebrow="ANDAR INTERSECTION / NODE 01 / EXAMPLE SITE"
      title="Operator overview"
      description="Traffic condition and controller context for one local intersection."
      badge={<Badge tone={source === 'sumo' && snapshot ? 'ok' : 'warning'}>{source === 'sumo' && snapshot ? 'SUMO simulation · read-only' : 'Example data'}</Badge>}
    />
    {source === 'sumo' && <div className="source-banner"><b>DATA SOURCE /</b> {snapshot ? <>SUMO decision {snapshot.simulation.decisionStep} · {snapshot.sourceFile} · recorded simulation data, not controller confirmation.</> : sourceError}</div>}
    <div className="status-band">
      <span><b>Condition</b><Badge tone="warning">Moderate demand</Badge></span>
      <span><b>Active movement</b><strong>{phase} GREEN</strong></span>
      <span><b>Controller</b><Badge tone="ok">Available</Badge></span>
      <span><b>Health</b><strong>5 of 5 feeds</strong></span>
    </div>
    <div className="metric-grid">
      <Metric code="01" label="Observed vehicles" value={total} note="Example 08:00–08:15 window" />
      <Metric code="02" label="Average waiting time" value="33 s" note="Illustrative observation" tone="warning-text" />
      <Metric code="03" label="Queue status" value="Moderate" note="Northbound advisory" />
      <Metric code="04" label="Intersection utilization" value="71%" note="Example capacity estimate" />
    </div>
    <div className="overview-grid">
      <Card className="intersection-card">
        <SectionHeading code="MAP / 01" title="Intersection condition" description="Signal state is illustrative." action={<Badge tone="ok">Connected</Badge>} />
        <MiniIntersection phase={phase} />
        <div className="movement">
          <div><small>Active phase</small><strong>{phase} GREEN</strong></div>
          <div><small>Phase duration</small><strong>{snapshot?.controllerDecision?.greenSeconds || 35} s</strong></div>
          <div><small>Operating mode</small><strong>Adaptive research prototype</strong></div>
        </div>
      </Card>
      <Card className="alerts">
        <SectionHeading code="ATTN / 03" title="Recent attention" description="Prioritized operational context." action={<button className="text-button" onClick={() => setPage('activity')}>View all <Icon name="arrow" /></button>} />
        {log('warning', 'High observed volume — Northbound', '128 vehicles in the example 15-minute window. This is not a measured queue length.', '01')}
        {log('neutral', 'Camera feeds healthy', 'Five schematic feed placeholders are available in this frontend prototype.', '02')}
        {log('ok', 'Controller status available', 'No field-controller confirmation is connected.', '03')}
      </Card>
    </div>
    <Card>
      <SectionHeading code="APPROACH REGISTER / 05" title="Approach summary" description="Example observations by approach." action={<Badge>08:00–08:15</Badge>} />
      <div className="approach-table">
        {rows.map((row, index) => <div className="approach" key={row.name} style={{ '--approach': row.color }}>
          <span className="approach-number">0{index + 1}</span>
          <span className="dot" />
          <strong>{row.name}</strong>
          <span>{row.count} vehicles</span>
          <span>{row.wait} avg wait</span>
          <Badge tone={row.queue === 'Moderate' ? 'warning' : 'neutral'}>{row.queue} queue</Badge>
        </div>)}
      </div>
    </Card>
  </>;

  const analytics = <>
    <PageTitle eyebrow="TRAFFIC ANALYTICS / PLATE 02" title="Example performance trends" description="Historical-style visuals for presentation and workflow review. They are not MTMB field measurements." badge={<Badge>Example data</Badge>} />
    <div className="chart-grid">
      <Chart code="A / 01" dataKey="volume" color="#146b55" title="Traffic volume" unit="" />
      <Chart code="A / 02" dataKey="wait" color="#c36818" title="Waiting-time trend" unit="s" />
      <Chart code="A / 03" dataKey="queue" color="#a5454f" title="Queue-length trend" unit="" />
      <Chart code="A / 04" dataKey="throughput" color="#246a92" title="Throughput" unit="" />
    </div>
    <div className="two-col">
      <Card>
        <SectionHeading code="A / 05" title="Distribution by approach" description="Example observed share." />
        <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={rows} dataKey="count" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={1}>{rows.map((row) => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip contentStyle={chartTooltip} /></PieChart></ResponsiveContainer>
      </Card>
      <Card>
        <SectionHeading code="A / 06" title="Peak-period comparison" description="Illustrative throughput comparison." />
        <ResponsiveContainer width="100%" height={260}><BarChart data={trend}><CartesianGrid vertical={false} stroke="#d8d5c8" strokeDasharray="2 5" /><XAxis dataKey="time" tickLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} /><Bar dataKey="volume" fill="#146b55" /><Bar dataKey="throughput" fill="#9fb9ab" /></BarChart></ResponsiveContainer>
      </Card>
    </div>
  </>;

  const operations = <>
    <PageTitle eyebrow="SIGNAL OPERATIONS / PLATE 03" title="Adaptive signal controller" description="Research-prototype view of selected movements and recent simulated decisions." badge={<Badge>No field control</Badge>} />
    <div className="operations-grid">
      <Card className="operation-map">
        <SectionHeading code="LIVE SCHEMATIC / 01" title="Selected movement" />
        <MiniIntersection phase={phase} />
        <div className="operation-callout"><Badge tone="ok">Active</Badge><h2>{phase} GREEN</h2><p>{snapshot ? 'Recorded SUMO simulation decision' : 'Illustrative selected movement'}</p><strong>{snapshot?.controllerDecision?.greenSeconds || 35} seconds</strong></div>
      </Card>
      <Card>
        <SectionHeading code="SEQUENCE / 02" title="Signal sequence" description="Highlighted movement represents the current prototype state." />
        <ol className="sequence">{['Northbound', 'Southbound', 'Brudger', 'Estanislao', 'City Hall', 'Pedestrian'].map((name, index) => <li className={name === phase ? 'current' : ''} key={name}><span>{String(index + 1).padStart(2, '0')}</span><i />{name}{name === phase && <Badge tone="ok">Active</Badge>}</li>)}</ol>
      </Card>
      <Card>
        <SectionHeading code="DECISION LOG / 03" title="Recent decisions" />
        {log('simulated', 'Phase selected', `${phase} served for ${snapshot?.controllerDecision?.greenSeconds || 35} seconds.`, '01')}
        {log('proposed', 'Timing profile', 'Balanced daytime profile is shown as a frontend preview.', '02')}
        {log('neutral', 'Transition status', 'No physical transition acknowledgement is connected.', '03')}
      </Card>
    </div>
  </>;

  const maintenance = <>
    <PageTitle eyebrow="MAINTENANCE & CONFIGURATION / PLATE 04" title="Controller configuration preview" description="Interface demonstration for future authorized maintenance workflows." badge={<Badge tone="warning">Frontend demonstration</Badge>} />
    <div className="demo-notice"><b>PREVIEW BOUNDARY /</b> Frontend demonstration only. Configuration validation and traffic-controller activation are not connected.</div>
    <div className="maintenance-grid">
      <Card><SectionHeading code="M / 01" title="Timing profile" />
        <label>Approved profile<select value={settings.profile} onChange={(event) => set('profile', event.target.value)}><option>Balanced daytime</option><option>Weekday peak</option><option>Night operation</option></select></label>
        <label>Operating mode<select value={settings.mode} onChange={(event) => set('mode', event.target.value)}><option>Automatic</option><option>Manual preview</option></select></label>
        <label className="check"><input type="checkbox" /> Emergency override concept <small>Preview only</small></label>
      </Card>
      <Card><SectionHeading code="M / 02" title="Timing guardrails" />
        <div className="form-grid">{[['min', 'Minimum green (s)'], ['max', 'Maximum green (s)'], ['yellow', 'Yellow interval (s)'], ['allRed', 'All-red clearance (s)'], ['pedestrian', 'Pedestrian duration (s)']].map(([key, label]) => <label key={key}>{label}<input type="number" min="0" value={settings[key]} onChange={(event) => set(key, event.target.value)} /></label>)}</div>
        <label>Safety buffer<select><option>Standard — illustrative</option><option>Enhanced — illustrative</option></select></label>
      </Card>
      <Card><SectionHeading code="M / 03" title="Logging & component status" />
        <label className="check"><input type="checkbox" defaultChecked /> Record configuration previews</label>
        <label className="check"><input type="checkbox" defaultChecked /> Show data-source availability in log</label>
        <div className="component-status"><span>Dashboard frontend <Badge tone="ok">Available</Badge></span><span>Local SUMO bridge <Badge>Optional</Badge></span><span>Field controller <Badge tone="offline">Not connected</Badge></span></div>
        <button className="primary" onClick={() => setNotice('Demonstration only — the configuration preview was not sent or applied.')}>Save preview <Icon name="arrow" /></button>
        {notice && <p className="inline-notice" role="status">{notice}</p>}
      </Card>
    </div>
  </>;

  const activity = <>
    <PageTitle eyebrow="ACTIVITY & SYSTEM LOGS / PLATE 05" title="Operational record" description="All entries below are proposed, simulated, or frontend example events." badge={<Badge>Example data</Badge>} />
    <Card className="log-card">
      <SectionHeading code="EVENT REGISTER / 05" title="Recorded activity" description="Provenance is shown for every entry." />
      <div className="legend"><span>Evidence key</span><Badge tone="simulated">Simulated</Badge><Badge tone="proposed">Proposed</Badge><Badge>System</Badge><Badge tone="offline">Physical confirmation unavailable</Badge></div>
      {log('simulated', 'Signal decision recorded', `${phase} selected in the ${source === 'sumo' ? 'local SUMO' : 'example'} data context.`, '01')}
      {log('warning', 'Volume advisory raised', 'Northbound reached the illustrative advisory threshold. No field alarm was sent.', '02')}
      {log('proposed', 'Configuration preview available', 'Maintenance controls demonstrate a future authorized workflow only.', '03')}
      {log('neutral', 'Data source ready', source === 'sumo' && snapshot ? 'Local SUMO simulation data is read-only.' : 'Example dataset is active.', '04')}
      {log('offline', 'Physical controller confirmation', 'No controller, camera, sensor, or authentication service is connected.', '05')}
    </Card>
  </>;

  const pages = { overview, analytics, operations, maintenance, activity };
  const activePage = nav.findIndex(([id]) => id === page) + 1;

  return (
    <div className="app">
      <a className="skip" href="#content">Skip to content</a>
      <header>
        <button className="brand" onClick={() => setPage('overview')} aria-label="ANDAR overview">
          <span className="brand-mark"><i /><b>AN</b></span>
          <span className="brand-name"><b>ANDAR</b><small>Mobility systems research</small></span>
        </button>
        <div className="site-marker"><span>NODE</span><strong>01</strong><small>Example intersection</small></div>
        <div className="header-controls">
          <label><span>Data source</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="example">Example data</option><option value="sumo">Local SUMO simulation</option></select></label>
          <Badge tone={source === 'sumo' && snapshot ? 'ok' : 'neutral'}>{source === 'sumo' && snapshot ? 'Read-only connected' : 'Prototype'}</Badge>
          <button className="menu" onClick={() => setMobileNav(!mobileNav)} aria-expanded={mobileNav}><Icon name="menu" /> Menu</button>
        </div>
      </header>
      <div className="shell">
        <aside className={mobileNav ? 'open' : ''}>
          <div className="nav-heading"><span>Operator workspace</span><b>{String(activePage).padStart(2, '0')} / 05</b></div>
          <nav aria-label="Primary navigation">{nav.map(([id, label, icon], index) => <button className={page === id ? 'selected' : ''} onClick={() => { setPage(id); setMobileNav(false); }} key={id}><span className="nav-index">0{index + 1}</span><Icon name={icon} /><span>{label}</span><i /></button>)}</nav>
          <div className="side-note"><span className="coordinate">14.4081° N / 121.0415° E</span><Badge>Example data</Badge><p>Camera tiles and detections are schematic placeholders.</p></div>
        </aside>
        <main id="content" key={page}>{pages[page]}</main>
      </div>
    </div>
  );
}
