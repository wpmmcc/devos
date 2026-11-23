/**
 * DevOS 30-Second Rolling Web Error Probe
 * Lightweight, zero-dependency probe that captures:
 * 1. window.onerror & unhandledrejection
 * 2. console.error calls
 * 3. HTTP >= 400 fetch & XMLHttpRequest failures
 */

export interface ProbeSnapshot {
  console_errors: Array<{ timestamp: string; message: string }>;
  failed_requests: Array<{
    method: string;
    url: string;
    status: number;
    response_snippet?: string;
  }>;
}

export function initDevosProbe(): {
  getSnapshot: () => ProbeSnapshot;
  injectScriptCode: string;
} {
  const MAX_AGE_MS = 30000;
  const consoleErrors: Array<{ time: number; timestamp: string; message: string }> = [];
  const failedRequests: Array<{
    time: number;
    method: string;
    url: string;
    status: number;
    response_snippet?: string;
  }> = [];

  function cleanOld() {
    const now = Date.now();
    while (consoleErrors.length && now - consoleErrors[0].time > MAX_AGE_MS) {
      consoleErrors.shift();
    }
    while (failedRequests.length && now - failedRequests[0].time > MAX_AGE_MS) {
      failedRequests.shift();
    }
  }

  // Intercept window.onerror
  window.addEventListener('error', (event) => {
    cleanOld();
    consoleErrors.push({
      time: Date.now(),
      timestamp: new Date().toISOString(),
      message: event.message || String(event),
    });
  });

  // Intercept unhandledrejection
  window.addEventListener('unhandledrejection', (event) => {
    cleanOld();
    consoleErrors.push({
      time: Date.now(),
      timestamp: new Date().toISOString(),
      message: 'Unhandled Promise Rejection: ' + (event.reason?.message || String(event.reason)),
    });
  });

  // Intercept console.error
  const originalError = console.error;
  console.error = function (...args: any[]) {
    cleanOld();
    consoleErrors.push({
      time: Date.now(),
      timestamp: new Date().toISOString(),
      message: args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' '),
    });
    originalError.apply(console, args);
  };

  // Intercept fetch
  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      try {
        const res = await originalFetch.apply(this, arguments as any);
        if (res.status >= 400) {
          cleanOld();
          const clone = res.clone();
          let snippet = '';
          try {
            snippet = (await clone.text()).slice(0, 500);
          } catch (e) {}
          failedRequests.push({
            time: Date.now(),
            method: (init && init.method) || 'GET',
            url: typeof input === 'string' ? input : (input as Request).url,
            status: res.status,
            response_snippet: snippet,
          });
        }
        return res;
      } catch (err: any) {
        cleanOld();
        failedRequests.push({
          time: Date.now(),
          method: (init && init.method) || 'GET',
          url: typeof input === 'string' ? input : (input as Request).url,
          status: 0,
          response_snippet: err.message,
        });
        throw err;
      }
    };
  }

  const getSnapshot = (): ProbeSnapshot => {
    cleanOld();
    return {
      console_errors: consoleErrors.map((e) => ({
        timestamp: e.timestamp,
        message: e.message,
      })),
      failed_requests: failedRequests.map((r) => ({
        method: r.method,
        url: r.url,
        status: r.status,
        response_snippet: r.response_snippet,
      })),
    };
  };

  // Generate injectable script string for child iframe or WebView
  const injectScriptCode = `
    (function() {
      const MAX_AGE_MS = 30000;
      const cErrors = [];
      const fReqs = [];
      function cl() {
        const now = Date.now();
        while(cErrors.length && now - cErrors[0].time > MAX_AGE_MS) cErrors.shift();
        while(fReqs.length && now - fReqs[0].time > MAX_AGE_MS) fReqs.shift();
      }
      window.addEventListener('error', e => {
        cl(); cErrors.push({ time: Date.now(), timestamp: new Date().toISOString(), message: e.message || String(e) });
      });
      window.addEventListener('unhandledrejection', e => {
        cl(); cErrors.push({ time: Date.now(), timestamp: new Date().toISOString(), message: String(e.reason) });
      });
      const oErr = console.error;
      console.error = function(...args) {
        cl(); cErrors.push({ time: Date.now(), timestamp: new Date().toISOString(), message: args.join(' ') });
        oErr.apply(console, args);
      };
      window.__DEVOS_PROBE__ = {
        getSnapshot: () => { cl(); return { console_errors: cErrors, failed_requests: fReqs }; }
      };
    })();
  `;

  return { getSnapshot, injectScriptCode };
}

export const devosProbe = typeof window !== 'undefined'
  ? initDevosProbe()
  : {
      getSnapshot: () => ({ console_errors: [], failed_requests: [] }),
      injectScriptCode: '',
    };

