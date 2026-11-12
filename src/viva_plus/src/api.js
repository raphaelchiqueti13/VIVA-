const API = import.meta.env.VITE_API_URL || "/api";
export function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
export function safeSet(key,value) { try { localStorage.setItem(key,value); } catch {} }
export function getToken() { return safeGet("viva_token"); }
export function setSession(token, user) {
  safeSet("viva_token", token);
  safeSet("viva_user", JSON.stringify(user));
}
export function clearSession() {
  try { localStorage.removeItem("viva_token"); localStorage.removeItem("viva_user"); } catch {}
}
export function getSavedUser() {
  try { return JSON.parse(safeGet("viva_user") || "null"); } catch { return null; }
}
export async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  let response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Verifique se o VIVA+ está iniciado (npm start) e tente novamente.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a solicitação.");
  return data;
}
