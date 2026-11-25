import { useState } from 'react';
import Badge from './Badge';
import ConfirmDialog from './ConfirmDialog';
import Icon from './Icon';
import { Card, PageTitle, SectionHeading } from './layout';
import { PHASES } from './controllerContract';
import { cancelOverride, startOverride } from './operatorApi';

const DEFAULTS = { min: 15, max: 60, yellow: 10, allRed: 0 };

function clampGreen(seconds, min, max) {
  return Math.min(Math.max(seconds, min), max);
}

function requestSeconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 30;
  return Math.min(120, Math.max(5, Math.round(number)));
}

export default function OperatorPage({ phase, signals, override, onStatusChange }) {
  const [steps, setSteps] = useState([]);
  const [mode, setMode] = useState('once');
  const [maxMinutes, setMaxMinutes] = useState(10);
  const [reason, setReason] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);

  const timing = signals?.timing ?? {};
  const minGreen = Number(timing.min_green ?? DEFAULTS.min);
  const maxGreen = Number(timing.max_green ?? DEFAULTS.max);
  const yellow = Number(timing.yellow ?? DEFAULTS.yellow);
  const allRed = Number(timing.all_red ?? DEFAULTS.allRed);

  const headFor = (index) => signals?.heads?.find((head) => head.phase === index) ?? null;
  const running = Boolean(override?.active);
  const cancelling = Boolean(override?.cancelling);
  const canEdit = !running && Boolean(signals?.available);

  const addStep = (index) => {
    setSteps((current) => [...current, { phase: index, seconds: 30 }]);
  };

  const updateStep = (index, patch) => {
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const moveStep = (index, delta) => {
    setSteps((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeStep = (index) => {
    setSteps((current) => current.filter((_, i) => i !== index));
  };

  const previewLines = steps.flatMap((step, index) => {
    const name = PHASES[step.phase] ?? `phase ${step.phase}`;
    const green = clampGreen(requestSeconds(step.seconds), minGreen, maxGreen);
    const head = headFor(step.phase);
    const prefix = index === 0
      ? `Cut ${phase} green → yellow ${yellow} s${allRed > 0 ? ` → red ${allRed} s` : ''}. Then `
      : 'Then ';
    return [`${prefix}${name} green for ${green} s${head ? '' : ' — no head, lamps hold red'}.`];
  });

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = {
        steps: steps.map((step) => ({
          phase: step.phase,
          seconds: requestSeconds(step.seconds),
        })),
        mode,
      };
      if (mode === 'loop') {
        payload.max_duration_seconds = Math.max(60, Math.round(Number(maxMinutes) * 60) || 600);
      }
      if (reason.trim()) payload.reason = reason.trim();
      const result = await startOverride(payload);
      setWarnings(Array.isArray(result.warnings) ? result.warnings : []);
      setDialogOpen(false);
      await onStatusChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      await cancelOverride();
      await onStatusChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const badge = running
    ? { tone: 'warning', label: cancelling ? 'Returning to policy' : 'Operator in control' }
    : signals?.available
      ? { tone: 'ok', label: 'Policy in control' }
      : { tone: 'offline', label: 'Control unavailable' };

  return (
    <>
      <PageTitle
        title="Control room"
        description="Queue phases for the signal heads, run them once or rotate them, then hand control back to the policy."
        badge={<Badge tone={badge.tone}>{badge.label}</Badge>}
      />

      <div className="control-grid">
        <Card className="control-card">
          <SectionHeading
            code="C / 01"
            title="Override program"
            description="Phases without a configured head stay selectable but hold red."
          />

          {!signals?.available && (
            <p className="field-error">{signals?.message ?? 'Operator control is unavailable on this controller.'}</p>
          )}

          <div className="phase-picker">
            {PHASES.map((name, index) => {
              const head = headFor(index);
              return (
                <button
                  key={name}
                  type="button"
                  className={`phase-chip ${head ? '' : 'no-head'}`}
                  onClick={() => addStep(index)}
                  disabled={!canEdit}
                  title={head ? `Head: ${head.name} (${head.driver})` : 'No head configured — lamps hold red'}
                >
                  <b>{name}</b>
                  <small>{head ? head.name : 'no head'}</small>
                </button>
              );
            })}
          </div>

          {steps.length === 0 ? (
            <p className="field-note">No steps yet. Click a phase to add it to the program.</p>
          ) : (
            <ol className="step-list">
              {steps.map((step, index) => (
                <li className="step-row" key={`${step.phase}-${index}`}>
                  <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="step-phase">{PHASES[step.phase]}</span>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    step="1"
                    value={step.seconds}
                    onChange={(event) => updateStep(index, { seconds: event.target.value })}
                    disabled={!canEdit}
                    aria-label={`${PHASES[step.phase]} green seconds`}
                  />
                  <span className="step-unit">s</span>
                  <button type="button" className="step-action" onClick={() => moveStep(index, -1)} disabled={!canEdit || index === 0} aria-label="Move up">↑</button>
                  <button type="button" className="step-action" onClick={() => moveStep(index, 1)} disabled={!canEdit || index === steps.length - 1} aria-label="Move down">↓</button>
                  <button type="button" className="step-action" onClick={() => removeStep(index)} disabled={!canEdit} aria-label="Remove">✕</button>
                </li>
              ))}
            </ol>
          )}

          <div className="segmented" role="group" aria-label="Override mode">
            <button type="button" className={mode === 'once' ? 'selected' : ''} onClick={() => setMode('once')} disabled={!canEdit}>Run once</button>
            <button type="button" className={mode === 'loop' ? 'selected' : ''} onClick={() => setMode('loop')} disabled={!canEdit}>Rotate</button>
          </div>

          {mode === 'loop' && (
            <label>
              Rotation cap (minutes)
              <input
                type="number"
                min="1"
                max="60"
                value={maxMinutes}
                onChange={(event) => setMaxMinutes(event.target.value)}
                disabled={!canEdit}
              />
            </label>
          )}

          <label>
            Reason (optional)
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={!canEdit}
              placeholder="Demo takeover"
            />
          </label>

          <div className="action-row">
            <button
              className="primary"
              type="button"
              onClick={() => { setError(''); setDialogOpen(true); }}
              disabled={!canEdit || steps.length === 0 || busy}
            >
              Start override <Icon name="arrow" />
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => { setSteps([]); setWarnings([]); }}
              disabled={!canEdit || steps.length === 0}
            >
              Clear
            </button>
          </div>

          {warnings.length > 0 && (
            <ul className="control-warnings">
              {warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
          {error && !dialogOpen && <p className="field-error" role="alert">{error}</p>}
        </Card>

        <Card className="control-card">
          <SectionHeading code="C / 02" title="Live state" />
          {running ? (
            <>
              <div className="override-status">
                <div><span>Mode</span><b>{override.mode === 'loop' ? 'Rotate' : 'Run once'}</b></div>
                <div><span>Step</span><b>{override.index + 1} of {override.steps?.length ?? 0}</b></div>
                <div><span>Phase</span><b>{PHASES[override.steps?.[override.index]?.phase] ?? '—'}</b></div>
                <div><span>Step ends in</span><b>{Math.round(override.step_remaining ?? 0)} s</b></div>
              </div>

              <ol className="step-list compact">
                {(override.steps ?? []).map((step, index) => (
                  <li className={`step-row ${index === override.index ? 'current' : ''}`} key={`${step.phase}-${index}`}>
                    <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="step-phase">{PHASES[step.phase]}</span>
                    <span className="step-unit">{Math.round(step.seconds)} s</span>
                  </li>
                ))}
              </ol>

              <div className="action-row">
                <button className="primary" type="button" onClick={cancel} disabled={busy || cancelling}>
                  {cancelling ? 'Returning to policy…' : 'Return to policy'}
                </button>
              </div>
              {error && <p className="field-error" role="alert">{error}</p>}
            </>
          ) : (
            <div className="control-idle">
              <p>No operator program is running.</p>
              <p className="field-note">
                {signals?.available
                  ? `The policy is choosing phases. Green is clamped to ${minGreen}–${maxGreen} s by the signal heads.`
                  : 'The operator endpoints are unavailable, so the policy keeps control.'}
              </p>
            </div>
          )}
        </Card>
      </div>

      {dialogOpen && (
        <ConfirmDialog
          title="Take operator control"
          lines={previewLines}
          confirmLabel="Take control"
          busy={busy}
          error={error}
          onConfirm={submit}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
