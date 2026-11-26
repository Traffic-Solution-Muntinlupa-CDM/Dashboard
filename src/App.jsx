import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  APPROACHES,
  PEDESTRIAN_PHASE,
  PHASES,
  describeSource,
  formatSeconds,
  queueBand,
  queueTone,
} from './controllerContract';
import { POLL_INTERVAL_MS } from './piBridge';
import { loadDashboardSnapshot, sourceMeta } from './dataSource';
import { CAMERA_LIST_REFRESH_MS, loadCameras } from './cameraBridge';
import { WEATHER_REFRESH_MS, loadWeather, weatherTone } from './weatherBridge';
import Badge from './Badge';
import CameraPanel from './CameraPanel';
import ConfirmDialog from './ConfirmDialog';
import Icon from './Icon';
import LoginPage from './LoginPage';
import OperatorPage from './OperatorPage';
import WeatherCard from './WeatherCard';
import { Card, PageTitle, SectionHeading } from './layout';
import { isSignedIn, signOut } from './operatorSession';
import { cancelOverride, loadOverride, loadSignals } from './operatorApi';
import {
  ConfigError,
  DISPATCH_MODES,
  PRESETS,
  buildConfigUpdate,
  configOverrides,
  formFromConfig,
  loadRuntimeConfig,
  saveRuntimeConfig,
} from './configApi';

// Illustrative values only where a page has no live source at all.

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
  ['control', 'Control room', 'bolt'],
  ['maintenance', 'Maintenance', 'tools'],
  ['activity', 'Activity & logs', 'log'],
];

const LOG_LABELS = {
  ok: 'Operational',
  warning: 'Advisory',
  neutral: 'System',
  offline: 'Unconfirmed',
  simulated: 'Simulated',
};

const chartTooltip = {  background: '#ffffff',
  border: '1px solid #9eb4c6',
  borderRadius: 4,
  boxShadow: '0 8px 24px rgba(16, 42, 67, .12)',
  fontFamily: 'Atkinson Hyperlegible, sans-serif',
  fontSize: 13,
};

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
  const [cameraInventory, setCameraInventory] = useState({ available: false, cameras: [] });
  const [weather, setWeather] = useState(null);
  const [linkError, setLinkError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem('andar.nav') === 'collapsed';
    } catch {
      return false;
    }
  });

  const toggleNav = () => {
    setNavCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem('andar.nav', next ? 'collapsed' : 'expanded');
      } catch {
        // private mode: the toggle still works for this session
      }
      return next;
    });
  };

  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [presetId, setPresetId] = useState('');
  const [configState, setConfigState] = useState({ status: 'idle', message: '' });
  const [pendingSave, setPendingSave] = useState(null);
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' });

  const [prefs, setPrefs] = useState({ recordChanges: true, showServiceStatus: true });
  const [changeLog, setChangeLog] = useState([]);
  const [signedIn, setSignedIn] = useState(() => isSignedIn());
  const [signals, setSignals] = useState({ available: false, heads: [], timing: {} });
  const [override, setOverride] = useState({ available: false, active: false });
  const [controlError, setControlError] = useState('');

  // -- telemetry poll -------------------------------------------------------
  useEffect(() => {
    if (!signedIn) return undefined;
    let alive = true;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const next = await loadDashboardSnapshot(controller.signal);
        if (!alive) return;
        setSnapshot(next);
        setLinkError('');
      } catch (error) {
        if (!alive || error.name === 'AbortError') return;
        setLinkError(error.message);
      }
    };
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(id);
    };
  }, [signedIn]);

  // Weather comes straight from Open-Meteo — the same provider and coordinates
  // the controller's cv.yaml uses — so it keeps working while the Pi is away.
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const next = await loadWeather(controller.signal);
        if (alive) setWeather(next);
      } catch {
        // Aborted on unmount; the next refresh recovers.
      }
    };
    load();
    const id = setInterval(load, WEATHER_REFRESH_MS);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(id);
    };
  }, []);

  // Each page replaces the one before it in the same scroll container; start at
  // the top instead of inheriting the previous page's position.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [page]);

  const refreshConfig = useCallback(async (signal) => {
    setConfigState({ status: 'loading', message: '' });
    try {
      const result = await loadRuntimeConfig(signal);
      if (!result.mounted) {
        setConfig(null);
        setForm(null);
        setConfigState({ status: 'unmounted', message: result.message });
        return;
      }
      setConfig(result.config);
      setForm(formFromConfig(result.config));
      setConfigState({ status: 'ready', message: '' });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setConfig(null);
      setForm(null);
      setConfigState({ status: 'error', message: error.message });
    }
  }, []);

  // -- derived view state ---------------------------------------------------
  const sourceKind = snapshot?.sourceKind ?? 'example';
  const source = sourceMeta(sourceKind);
  const live = Boolean(snapshot?.available) && sourceKind !== 'example';  const decision = snapshot?.controllerDecision ?? null;
  const connection = snapshot?.connection ?? { status: 'unreachable' };

  const controllerOnline = Boolean(connection.controller);

  // Camera inventory is optional and slow-moving: refresh it every 30 s and
  // only while the controller is reachable, so an offline dashboard does not
  // add failed requests to every poll.
  useEffect(() => {
    if (!controllerOnline) return undefined;

    let alive = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await loadCameras(controller.signal);
        if (alive) setCameraInventory(result);
      } catch {
        // Aborted on unmount; the next refresh recovers.
      }
    };

    load();
    const id = setInterval(load, CAMERA_LIST_REFRESH_MS);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(id);
    };
  }, [controllerOnline]);

  // -- operator control -----------------------------------------------------
  // Polled on every page (not just Control room) because the banner and the
  // header badge have to show an active takeover anywhere in the app.
  const refreshOverride = useCallback(async (signal) => {
    const next = await loadOverride(signal);
    setOverride(next);
    return next;
  }, []);

  useEffect(() => {
    if (!signedIn || !controllerOnline) return undefined;
    let alive = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const next = await loadOverride(controller.signal);
        if (alive) setOverride(next);
      } catch {
        // Aborted on unmount or the controller went away; keep the last state.
      }
    };
    load();
    const id = setInterval(load, 3000);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(id);
    };
  }, [signedIn, controllerOnline]);

  useEffect(() => {
    if (!signedIn || !controllerOnline) return undefined;
    let alive = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const next = await loadSignals(controller.signal);
        if (alive) setSignals(next);
      } catch {
        // Aborted on unmount; the next refresh recovers.
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(id);
    };
  }, [signedIn, controllerOnline]);

  const phase = decision?.phase ?? null;
  const greenSeconds = decision?.greenSeconds ?? null;
  const remainingSeconds = decision?.remainingSeconds ?? null;
  const phaseSource = decision ? describeSource(decision.source, decision.overrideReason) : 'No decision received yet';
  const pedestrian = snapshot?.pedestrian ?? { requestPresent: false, pressAgeSeconds: null };

  const rows = useMemo(() => APPROACHES.map((approach) => {
    const observed = snapshot?.approaches?.find((item) => item.name === approach.name);
    const count = observed?.observedVehicles ?? null;
    const wait = observed?.waitSeconds ?? null;
    return {
      ...approach,
      count,
      waitSeconds: wait,
      queue: count == null ? null : queueBand(count),
    };
  }), [snapshot]);

  const reporting = rows.filter((row) => row.count != null).length;
  const total = rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
  const averageCount = reporting ? total / reporting : 0;
  const demand = averageCount >= 12 ? 'High' : averageCount >= 6 ? 'Moderate' : 'Light';
  const waits = rows.map((row) => row.waitSeconds).filter((value) => value != null);
  const longestWait = waits.length ? Math.max(...waits) : null;
  const busiest = [...rows].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0];
  const overrides = useMemo(() => configOverrides(config), [config]);
  const updatedAt = snapshot?.generatedAt ? new Date(snapshot.generatedAt).toLocaleTimeString() : '—';

  const setField = (key, value) => setForm((current) => (current ? { ...current, [key]: value } : current));

  const applyPreset = (event) => {
    const id = event.target.value;
    setPresetId(id);
    const preset = PRESETS.find((item) => item.id === id);
    if (preset && form) setForm({ ...form, ...preset.values });
  };

  const previewSave = () => {
    setSaveState({ status: 'idle', message: '' });
    try {
      const { next, changes } = buildConfigUpdate(config, form);
      if (changes.length === 0) {
        setPendingSave(null);
        setSaveState({ status: 'notice', message: 'No changes to write — the form already matches the controller.' });
        return;
      }
      setPendingSave({ next, changes });
    } catch (error) {
      setPendingSave(null);
      setSaveState({ status: 'error', message: error.message });
    }
  };

  const confirmSave = async () => {
    setSaveState({ status: 'saving', message: 'Writing to the controller…' });
    try {
      // Re-read first: PUT replaces the whole file, so merging onto the freshest
      // copy is what keeps fields this form does not own from being clobbered.
      const fresh = await loadRuntimeConfig();
      if (!fresh.mounted) throw new ConfigError(fresh.message);
      const { next, changes } = buildConfigUpdate(fresh.config, form);
      await saveRuntimeConfig(next);

      setPendingSave(null);
      setConfig(fresh.config);
      const reloaded = await loadRuntimeConfig();
      if (reloaded.mounted) {
        setConfig(reloaded.config);
        setForm(formFromConfig(reloaded.config));
        setConfigState({ status: 'ready', message: '' });
      }
      setSaveState({
        status: 'ok',
        message: `Applied ${changes.length} change(s). The controller hot-applies them on its next decision.`,
      });
      if (prefs.recordChanges) {
        setChangeLog((current) => [
          { at: new Date().toLocaleTimeString(), summary: changes.map((change) => change.label).join(', ') },
          ...current,
        ].slice(0, 6));
      }
    } catch (error) {
      setSaveState({ status: 'error', message: error.message });
    }
  };

  const abortOverride = async () => {
    setControlError('');
    try {
      await cancelOverride();
      await refreshOverride();
    } catch (error) {
      setControlError(error.message);
    }
  };

  const handleSignOut = () => {
    signOut();
    setSignedIn(false);
    setSnapshot(null);
    setOverride({ available: false, active: false });
    setSignals({ available: false, heads: [], timing: {} });
  };

  const log = (type, title, description, index = '—', time = 'Recent') => (    <div className="log-row" key={`${index}-${title}`}>
      <span className="log-index">{index}</span>
      <Badge tone={type}>{LOG_LABELS[type] ?? type}</Badge>
      <div><strong>{title}</strong><p>{description}</p></div>
      <time>{time}</time>
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
          <div>
            <span>Current condition</span>
            <h2>{live ? `${demand} demand` : 'No live data'}</h2>
          </div>
        </div>
        <div className="situation-body">
          <CameraPanel
            key={phase ?? 'none'}
            phase={phase}
            cameras={cameraInventory.cameras}
            camerasKnown={cameraInventory.available}
          />
          <div className="phase-focus">
            <span className={`phase-light ${phase ? '' : 'idle'}`} />
            <p>Active movement</p>
            <strong>{phase ?? '—'}</strong>
            {phase && <h3>{phase === PEDESTRIAN_PHASE ? 'Walk' : 'Green'}</h3>}
            <div>
              <span>Phase duration</span>
              <b>{remainingSeconds != null && greenSeconds != null
                ? `${Math.round(remainingSeconds)} s left of ${Math.round(greenSeconds)} s`
                : formatSeconds(greenSeconds)}</b>
            </div>
            <div><span>Decision source</span><b>{phaseSource}</b></div>
          </div>
        </div>
        <div className="summary-metrics">
          <div><strong>{reporting ? total : '—'}</strong><span>Observed vehicles</span><p>{reporting} of 5 entering edges reporting</p></div>
          <div><strong>{longestWait != null ? <>{Math.round(longestWait)} <small>s</small></> : '—'}</strong><span>Longest unserved</span><p>Wait accrued on one approach</p></div>
          <div><strong>{greenSeconds != null ? <>{Math.round(remainingSeconds ?? greenSeconds)} <small>s</small></> : '—'}</strong><span>Phase remaining</span><p>{greenSeconds != null ? `of ${Math.round(greenSeconds)} s requested` : 'No decision yet'}</p></div>
        </div>
      </section>
      <div className="brief-column">
        <WeatherCard weather={weather} />
        <section className="operational-brief">
          <div className="brief-heading">
            <h2>Operational brief</h2>
            <button className="text-button" onClick={() => setPage('activity')}>View activity <Icon name="arrow" /></button>
          </div>
          <div className="priority-item">
            <h3>{busiest?.count ? 'Highest observed volume' : 'Awaiting demand'}</h3>
            <strong>{busiest && busiest.count != null ? `${busiest.name} · ${busiest.count} vehicles` : 'No live sample yet'}</strong>
            <p>Entering-edge vehicle count from the latest sensor sample.</p>
          </div>
          <div className="brief-status">
            <div>
              <span className={`status-dot ${connection.controller ? 'ok' : ''}`} />
              <span>
                <b>{live ? source.short : 'No controller link'}</b>
                <p>{connection.status === 'awaiting-decision'
                  ? 'Reachable, waiting for its first decision'
                  : live ? source.detail : 'Values appear once the controller answers.'}</p>
              </span>
            </div>
            <div>
              <span className={`status-dot ${pedestrian.requestPresent ? 'ok' : ''}`} />
              <span>
                <b>{pedestrian.requestPresent ? 'Pedestrian request active' : 'No pedestrian request'}</b>
                <p>{pedestrian.requestPresent ? `Waiting ${formatSeconds(pedestrian.pressAgeSeconds)}` : 'Button idle'}</p>
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
    <section className="approach-section">
      <div className="approach-heading">
        <div><h2>Approach conditions</h2><p>Latest sampled state per incoming movement</p></div>
      </div>
      <div className="approach-list">
        <div className="approach-list-head"><span>Approach</span><span>Vehicles</span><span>Unserved</span><span>Queue</span></div>
        {rows.map((row) => <div className="approach-row" key={row.name} style={{ '--approach': row.color }}>
          <span className="approach-name"><i /><strong>{row.name}</strong></span>
          <span>{row.count ?? '—'}</span>
          <span>{formatSeconds(row.waitSeconds)}</span>
          {row.queue ? <Badge tone={queueTone(row.queue)}>{row.queue}</Badge> : <span>—</span>}
        </div>)}
      </div>
    </section>
  </>;

  const analytics = <>
    <PageTitle
      title="Traffic performance"
      description="Volume, waiting time, queues, and throughput across the morning period. Historical series are example data."
    />
    <div className="chart-grid">
      <Chart dataKey="volume" color="#146b55" title="Traffic volume" />
      <Chart dataKey="wait" color="#c36818" title="Waiting-time trend" unit="s" />
      <Chart dataKey="queue" color="#a5454f" title="Queue-length trend" />
      <Chart dataKey="throughput" color="#246a92" title="Throughput" />
    </div>
    <div className="two-col">
      <Card>
        <SectionHeading code="A / 05" title="Distribution by approach" description={live ? 'Live counts from the latest sample.' : 'Example counts.'} />
        <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={rows} dataKey="count" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={1}>{rows.map((row) => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip contentStyle={chartTooltip} /></PieChart></ResponsiveContainer>
      </Card>
      <Card>
        <SectionHeading code="A / 06" title="Peak-period comparison" />
        <ResponsiveContainer width="100%" height={260}><BarChart data={trend}><CartesianGrid vertical={false} stroke="#d8d5c8" strokeDasharray="2 5" /><XAxis dataKey="time" tickLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip contentStyle={chartTooltip} /><Bar dataKey="volume" fill="#146b55" /><Bar dataKey="throughput" fill="#9fb9ab" /></BarChart></ResponsiveContainer>
      </Card>
    </div>
  </>;

  const operations = <>
    <PageTitle
      title="Signal operations"
      description="Current movement, phase duration, sequence, and the controller's latest decision."
    />
    <div className="operations-grid">
      <Card className="operation-map">
        <SectionHeading code="LIVE VIEW / 01" title="Selected movement" />
        <CameraPanel
          key={phase ?? 'none'}
          phase={phase}
          cameras={cameraInventory.cameras}
          camerasKnown={cameraInventory.available}
        />
        <div className="operation-callout">
          {connection.status === 'live' && <Badge tone="ok">Active</Badge>}
          <h2>{phase ? `${phase} ${phase === PEDESTRIAN_PHASE ? 'WALK' : 'GREEN'}` : 'No decision yet'}</h2>
          <p>Reported by the controller</p>
          <strong>{remainingSeconds != null ? `${Math.round(remainingSeconds)} s remaining` : formatSeconds(greenSeconds)}</strong>
        </div>
      </Card>
      <Card>
        <SectionHeading code="SEQUENCE / 02" title="Signal sequence" description="The active movement is highlighted." />
        <ol className="sequence">
          {PHASES.map((name, index) => (
            <li className={name === phase ? 'current' : ''} key={name}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <i />
              {name}
              {name === phase && <Badge tone="ok">Active</Badge>}
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <SectionHeading code="DECISION LOG / 03" title="Recent decisions" />
        {log('ok', 'Phase selected', `${phase} requested for ${formatSeconds(greenSeconds)}.`, '01')}
        {log(decision?.source === 'policy' ? 'neutral' : 'warning', 'Decision layer', phaseSource, '02')}
        {log(pedestrian.requestPresent ? 'warning' : 'neutral', 'Pedestrian request', pedestrian.requestPresent ? `Waiting ${formatSeconds(pedestrian.pressAgeSeconds)} for service.` : 'No request latched.', '03')}
        {log(connection.status === 'live' ? 'ok' : 'offline', 'Controller link', connection.status === 'live' ? `${source.short} · last poll ${updatedAt}.` : `${source.short} · ${connection.status}.`, '04')}
      </Card>
    </div>
  </>;

  const configError = configState.status === 'error' || saveState.status === 'error';
  const configBadge = !controllerOnline
    ? { tone: 'offline', label: 'Controller offline' }
    : configState.status === 'ready'
      ? { tone: 'ok', label: 'Runtime config loaded' }
      : configState.status === 'unmounted'
        ? { tone: 'warning', label: 'Not mounted' }
        : configState.status === 'loading'
          ? { tone: 'neutral', label: 'Reading config' }
          : configState.status === 'error'
            ? { tone: 'offline', label: 'Unavailable' }
            : { tone: 'neutral', label: 'Not loaded' };
  const maintenance = <>
    <PageTitle
      title="Controller configuration"
      description="Reads and writes the controller's live deploy_config.json. Changes hot-apply on the next decision."
      badge={<Badge tone={configBadge.tone}>{configBadge.label}</Badge>}
    />
    <div className="maintenance-grid">
      <Card>
        <SectionHeading code="M / 01" title="Timing profile" />
        {configState.status === 'loading' && <p className="field-note">Reading the controller's runtime config…</p>}
        {configState.status === 'unmounted' && <p className="field-note">{configState.message}</p>}
        {configState.status === 'error' && <p className="field-error">{configState.message}</p>}
        <label>
          Preset — fills the form only
          <select value={presetId} onChange={applyPreset} disabled={!form}>
            <option value="">Choose a preset…</option>
            {PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
        </label>
        <label>
          Dispatch mode
          <select value={form?.dispatchMode ?? ''} onChange={(event) => setField('dispatchMode', event.target.value)} disabled={!form}>
            {DISPATCH_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={form?.serveEmpty ?? false} onChange={(event) => setField('serveEmpty', event.target.checked)} disabled={!form} />
          Serve empty approaches <small>dispatch.serve_empty</small>
        </label>
        <div className="read-only-value"><span>Emergency override</span><b>Not available</b></div>
        <p className="field-note">The deployed controller exposes no emergency command path. Overrides come from the guard, pedestrian quota, and deadline layers only.</p>
        <div className="read-only-value"><span>Config file</span><b>{connection.runtimeConfig ? 'deploy_config.json' : 'Not mounted'}</b></div>
      </Card>

      <Card>
        <SectionHeading code="M / 02" title="Timing guardrails" description="Values are validated by the controller before anything is written." />
        <div className="form-grid">
          {[
            ['minGreen', 'Minimum green (s)'],
            ['maxGreen', 'Maximum green (s)'],
            ['yellow', 'Yellow interval (s)'],
            ['pedDuration', 'Pedestrian duration (s)'],
            ['guardSeconds', 'Guard threshold (s)'],
            ['deadlineSeconds', 'Deadline threshold (s)'],
            ['pedQuota', 'Pedestrian quota (s)'],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min="0"
                step="1"
                value={form?.[key] ?? ''}
                onChange={(event) => setField(key, event.target.value)}
                disabled={!form}
              />
            </label>
          ))}
        </div>
        <div className="read-only-value"><span>All-red clearance</span><b>Set by hardware.yaml</b></div>
        <p className="field-note">The signals container applies all-red clearance from hardware.yaml; the runtime JSON has no effect on it.</p>
        {overrides.length > 0 && (
          <p className="field-note">Per-movement overrides exist for {overrides.join(', ')}. The defaults above do not replace them.</p>
        )}
        {!controllerOnline && (
          <p className="field-error">The controller is unreachable. These are the last values that were loaded and they cannot be written.</p>
        )}
        <div className="action-row">
          <button className="primary" onClick={previewSave} disabled={!form || !controllerOnline || saveState.status === 'saving'}>
            Review changes <Icon name="arrow" />
          </button>
          <button className="text-button" onClick={() => { setSaveState({ status: 'idle', message: '' }); refreshConfig(); }} disabled={configState.status === 'loading'}>
            Reload from controller
          </button>
        </div>
        {saveState.message && (
          <p className={configError ? 'field-error' : 'inline-notice'} role="status">{saveState.message}</p>
        )}
        {pendingSave && (
          <ConfirmDialog
            title={`Confirm ${pendingSave.changes.length} change${pendingSave.changes.length === 1 ? '' : 's'}`}
            lines={[
              ...pendingSave.changes.map((change) => `${change.label}: ${String(change.from ?? '—')} → ${String(change.to ?? '—')}`),
              'PUT /config replaces the file atomically. Fields not listed are preserved and the new timing applies on the next decision.',
            ]}
            confirmLabel="Write configuration"
            busy={saveState.status === 'saving'}
            error={configError ? saveState.message : ''}
            onConfirm={confirmSave}
            onClose={() => setPendingSave(null)}
          />
        )}
      </Card>

      <Card>
        <SectionHeading code="M / 03" title="Logging & component status" />
        <label className="check">
          <input type="checkbox" checked={prefs.recordChanges} onChange={(event) => setPrefs({ ...prefs, recordChanges: event.target.checked })} />
          Record configuration changes
        </label>
        <label className="check">
          <input type="checkbox" checked={prefs.showServiceStatus} onChange={(event) => setPrefs({ ...prefs, showServiceStatus: event.target.checked })} />
          Show service status in activity log
        </label>
        <div className="component-status">
          <div><span>Dashboard</span><strong className="status-ok"><i />Available</strong></div>
          <div>
            <span>Controller REST</span>
            <strong className={connection.controller ? (connection.simulated ? 'status-auto' : 'status-ok') : 'status-unconfirmed'}>
              <i />{connection.controller ? (connection.simulated ? 'Simulator' : 'Connected') : 'Unreachable'}
            </strong>
          </div>
          <div>
            <span>Runtime config</span>
            <strong className={connection.runtimeConfig ? 'status-ok' : 'status-unconfirmed'}>
              <i />{connection.runtimeConfig ? 'Editable' : 'Not mounted'}
            </strong>
          </div>
          <div>
            <span>Data source</span>
            <strong className={live ? 'status-auto' : 'status-unconfirmed'}><i />{source.short}</strong>
          </div>
        </div>
        <p className="field-note">Save is disabled until the controller returns its runtime config; a controller started without the cv overlay has nowhere to write.</p>
      </Card>
    </div>
  </>;

  const activityRows = [
    log('ok', 'Signal state updated', `${phase} is the active movement at ${formatSeconds(greenSeconds)}.`, '01'),
    log(
      decision?.source === 'policy' ? 'neutral' : 'warning',
      'Controller decision layer',
      phaseSource,
      '02',
    ),
    log(
      pedestrian.requestPresent ? 'warning' : 'neutral',
      'Pedestrian request',
      pedestrian.requestPresent ? `Latch active for ${formatSeconds(pedestrian.pressAgeSeconds)}.` : 'No request latched.',
      '03',
    ),
    log(
      connection.runtimeConfig ? 'ok' : 'offline',
      'Runtime configuration',
      connection.runtimeConfig ? 'deploy_config.json is mounted and writable over PUT /config.' : 'No runtime config mounted; timing edits are unavailable.',
      '04',
    ),
  ];
  if (prefs.recordChanges) {
    changeLog.forEach((entry, index) => {
      activityRows.push(log('ok', 'Configuration written', `${entry.summary} at ${entry.at}.`, String(5 + index).padStart(2, '0')));
    });
  }
  if (prefs.showServiceStatus) {
    activityRows.push(log(live ? 'ok' : 'offline', 'Data source', `${source.detail} Last poll ${updatedAt}.`, String(activityRows.length + 1).padStart(2, '0')));
  }
  activityRows.push(log(
    weather?.available ? weatherTone(weather.scalar) : 'offline',
    'Weather',
    weather?.available
      ? `${weather.bucket} — Open-Meteo reports "${weather.condition}" · ${weather.temperatureC != null ? `${Math.round(weather.temperatureC)} °C` : 'temperature unavailable'}${weather.windKph != null ? ` · wind ${Math.round(weather.windKph)} km/h` : ''}. Same provider and coordinates the controller uses.`
      : weather ? `Unavailable: ${weather.message}` : 'Loading the intersection weather…',
    String(activityRows.length + 1).padStart(2, '0'),
  ));

  const activity = <>
    <PageTitle
      title="Activity and system logs"
      description="Recent controller, configuration, and data-source events for this session."
    />
    <Card className="log-card">
      <SectionHeading code="EVENT REGISTER / 05" title="Recent activity" description="Rows below are derived from the current session and its live link." />
      {activityRows}
    </Card>
  </>;

  const control = (
    <OperatorPage
      phase={phase}
      signals={signals}
      override={override}
      onStatusChange={refreshOverride}
      controllerOnline={controllerOnline}
    />
  );

  const pages = { overview, analytics, operations, control, maintenance, activity };

  if (!signedIn) {
    return <LoginPage onSignedIn={() => setSignedIn(true)} />;
  }

  return (
    <div className="app">
      <a className="skip" href="#content">Skip to content</a>
      <header>
        <button className="brand" onClick={() => setPage('overview')} aria-label="ANDAR overview">
          <span className="brand-name"><b>ANDAR</b></span>
        </button>
        <div className="city-name">Muntinlupa City</div>
        <div className="header-controls">
          <button className="header-signout" onClick={handleSignOut}>Sign out</button>
          <button className="menu" onClick={() => setMobileNav(!mobileNav)} aria-expanded={mobileNav}><Icon name="menu" /> Menu</button>
        </div>
      </header>
      <div className={`shell ${navCollapsed ? 'collapsed' : ''}`}>
        <aside className={mobileNav ? 'open' : ''}>
          <div className="nav-heading">
            <span>Workspace</span>
            <button
              type="button"
              className="nav-collapse"
              onClick={toggleNav}
              aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-expanded={!navCollapsed}
            >
              <Icon name={navCollapsed ? 'chevron-right' : 'chevron-left'} />
            </button>
          </div>
          <nav aria-label="Primary navigation">{nav.map(([id, label, icon]) => <button className={page === id ? 'selected' : ''} onClick={() => { setPage(id); setMobileNav(false); if (id === 'maintenance') refreshConfig(); }} key={id} data-label={label} aria-label={label}><Icon name={icon} /><span>{label}</span><i /></button>)}</nav>
        </aside>
        <main id="content" key={page}>
          {linkError && <p className="field-error" role="status">Controller poll failed: {linkError}</p>}
          {override.active && (
            <div className={`override-banner ${override.cancelling ? 'cancelling' : ''}`}>
              <div>
                <b>Operator override</b>
                <span>
                  {override.cancelling
                    ? ' — returning to policy'
                    : ` — ${PHASES[override.steps?.[override.index]?.phase] ?? '—'} green · step ends in ${Math.round(override.step_remaining ?? 0)} s · step ${(override.index ?? 0) + 1} of ${override.steps?.length ?? 0}${override.mode === 'loop' ? ' · rotating' : ''}`}
                </span>
              </div>
              <button className="text-button" onClick={abortOverride} disabled={override.cancelling}>
                Return to policy
              </button>
            </div>
          )}
          {controlError && <p className="field-error" role="alert">{controlError}</p>}
          {pages[page]}
        </main>
      </div>
    </div>
  );
}
