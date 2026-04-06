
// Global shim for process required by some Node-compatible libraries (like AI SDK)
if (typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = {
    env: {
      NODE_ENV: 'production'
    },
    nextTick: (cb: Function) => setTimeout(cb, 0),
    version: 'v18.0.0', // Fake version for compatibility
    platform: 'linux'
  };
}

/**
 * Call this at the start of every Worker request to inject Cloudflare bindings
 * into process.env so packages that use process.env.SUPABASE_URL etc. work.
 */
export function injectEnv(env: Record<string, string | undefined>): void {
  const proc = (globalThis as any).process;
  if (proc && proc.env) {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string') {
        proc.env[key] = value;
      }
    }
  }
}
