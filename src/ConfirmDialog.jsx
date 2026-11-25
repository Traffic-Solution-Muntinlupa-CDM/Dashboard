import { useState } from 'react';
import { confirmPassword } from './operatorSession';

/**
 * Shared reconfirmation for destructive actions (operator override, config
 * write). The password is re-entered, not reused from the session, and the
 * action only runs when it matches.
 */
export default function ConfirmDialog({ title, lines, confirmLabel, busy, error, onConfirm, onClose }) {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (!confirmPassword(password)) {
      setLocalError('Incorrect password.');
      return;
    }
    setLocalError('');
    onConfirm();
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <form className="modal" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit}>
        <h2>{title}</h2>
        {lines?.length > 0 && (
          <ol className="modal-lines">
            {lines.map((line) => <li key={line}>{line}</li>)}
          </ol>
        )}
        <label>
          Confirm with your operator password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            autoComplete="current-password"
          />
        </label>
        {(localError || error) && <p className="field-error" role="alert">{localError || error}</p>}
        <div className="action-row">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
          <button type="button" className="text-button" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
