let accessToken = null;

export function setAccessToken(token, { persist = false } = {}) {
  accessToken = token || null;
  if (persist) sessionStorage.setItem("accessToken", token || "");
  else sessionStorage.removeItem("accessToken");
  window.dispatchEvent(new Event("auth-changed"));
}
export function getAccessToken() {
  if (accessToken) return accessToken;
  const fromSession = sessionStorage.getItem("accessToken");
  if (fromSession) accessToken = fromSession;
  return accessToken;
}
export function clearAccessToken() {
  accessToken = null;
  sessionStorage.removeItem("accessToken");
  window.dispatchEvent(new Event("auth-changed"));
}
