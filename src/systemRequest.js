

export const AUTH_BOOT_TIMEOUT_MS = 12000;

export function withAppTimeout(
  promise,
  timeoutMs,
  code = "SYSTEM_REQUEST_TIMEOUT"
) {
  let timer = null;

  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error(code);
      error.code = code;
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      window.clearTimeout(timer);
    }
  });
}
