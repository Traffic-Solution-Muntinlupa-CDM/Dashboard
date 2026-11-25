// Demo-only operator gate.
//
// The password is checked in the browser and compared again before a dangerous
// action. The controller is deliberately unauthenticated (see its README): this
// stops a stray click on a laptop left open, not a person. Do not treat it as
// security.
const KEY = 'andar.operator.session';
const PASSWORD = import.meta.env.VITE_OPERATOR_PASSWORD || 'andar-demo';

export function signedInPassword() {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function isSignedIn() {
  return Boolean(signedInPassword());
}

export function signIn(password) {
  if (password !== PASSWORD) return false;
  try {
    sessionStorage.setItem(KEY, password);
  } catch {
    // A blocked sessionStorage still lets the session work in memory below.
  }
  return true;
}

export function signOut() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Reconfirm: the same password must be re-entered for a dangerous action. */
export function confirmPassword(password) {
  return password === signedInPassword();
}
