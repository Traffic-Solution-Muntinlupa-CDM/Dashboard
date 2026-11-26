import { useState } from 'react';
import { signIn } from './operatorSession';

export default function LoginPage({ onSignedIn }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (!password) {
      setError('Enter the operator password.');
      return;
    }
    if (!signIn(password)) {
      setError('Incorrect password.');
      return;
    }
    setError('');
    onSignedIn();
  };

  return (
    <div className="login-shell">
      <header className="login-header">
        <span className="brand-name"><b>ANDAR</b></span>
        <span className="login-city">Muntinlupa City</span>
      </header>
      <form className="login-card" onSubmit={submit}>
        <h1>Operator sign in</h1>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            autoComplete="current-password"
          />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="primary" type="submit">Sign in</button>
      </form>
    </div>
  );
}
