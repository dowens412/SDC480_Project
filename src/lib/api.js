// Adds the signed authentication token to API requests automatically.
export function apiFetch(url, options = {}) {
  let token = null

  try {
    const saved = localStorage.getItem('townsideAuth')

    if (saved) {
      token = JSON.parse(saved)?.token || null
    }
  } catch {
    token = null
  }

  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(url, {
    ...options,
    headers
  })
}
