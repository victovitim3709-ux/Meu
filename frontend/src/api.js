const BASE = (import.meta.env.VITE_API_URL || '') + '/api'

async function req(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
  return data
}

export const api = {
  // Auth
  login: (username, password) => req('POST', '/auth/login', { username, password }),
  logout: () => req('POST', '/auth/logout'),
  me: () => req('GET', '/auth/me'),

  // Users
  getUsers: () => req('GET', '/users'),
  createUser: (data) => req('POST', '/users', data),
  deleteUser: (username) => req('DELETE', `/users/${encodeURIComponent(username)}`),
  updatePassword: (username, password) => req('PATCH', `/users/${encodeURIComponent(username)}/password`, { password }),

  // Cadastros
  getCadastros: () => req('GET', '/cadastros'),
  createCadastro: (data) => req('POST', '/cadastros', data),
  updateCadastro: (id, data) => req('PATCH', `/cadastros/${id}`, data),
  deleteCadastro: (id) => req('DELETE', `/cadastros/${id}`),

  // Recibos
  getRecibos: () => req('GET', '/recibos'),
  createRecibo: (data) => req('POST', '/recibos', data),
  getReciboPdf: (id) => req('GET', `/recibos/${id}/pdf`),
  deleteRecibo: (id) => req('DELETE', `/recibos/${id}`),
}
