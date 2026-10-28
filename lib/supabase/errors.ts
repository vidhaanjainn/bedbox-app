// Turns whatever a Supabase call threw/returned into a sentence a person can
// act on. Supabase's own messages are often useless ("{}", "Load failed").

export type Described = { kind: 'network' | 'credentials' | 'permission' | 'server' | 'unknown'; message: string }

const NETWORK_RE = /failed to fetch|load failed|networkerror|network request failed|timed out|timeout|abort|^\{\}$|retryablefetch|fetch failed|err_/i

export function describeError(err: unknown): Described {
  const e = (err ?? {}) as { message?: string; name?: string; code?: string; status?: number }
  const raw = typeof err === 'string' ? err : e.message ?? ''
  const name = e.name ?? ''

  if (/invalid login credentials/i.test(raw)) {
    return { kind: 'credentials', message: 'Wrong email or password.' }
  }
  if (NETWORK_RE.test(raw) || NETWORK_RE.test(name) || (e.status === 0 && /AuthRetryableFetchError/.test(name))) {
    return { kind: 'network', message: "Can't reach the server. Check your internet connection and try again. If it keeps happening, open the connection check." }
  }
  if (e.code === '42501' || /row-level security|permission denied|jwt expired|not authorized/i.test(raw)) {
    return { kind: 'permission', message: 'Your login is not allowed to read this, or it has expired. Sign out and sign in again.' }
  }
  if ((e.status ?? 0) >= 500 || /server error|internal/i.test(raw)) {
    return { kind: 'server', message: 'The server had a problem. Try again in a minute.' }
  }
  return { kind: 'unknown', message: raw && raw !== '{}' ? raw : 'Something went wrong. Try again.' }
}
