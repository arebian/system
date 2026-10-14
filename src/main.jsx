import React from "react";
import ReactDOM from "react-dom/client";

const rootElement = document.getElementById("root");
try {
  const initialTheme = localStorage.getItem("systemTheme") === "light" ? "light" : "dark";
  document.documentElement.style.colorScheme = initialTheme;
  document.body.style.backgroundColor = initialTheme === "light" ? "#fff8e7" : "#0c0e11";
} catch { /* The login screen still renders if browser storage is blocked. */ }

function showStartupFailure(error) {
  console.error("THE SYSTEM STARTUP FAILURE:", error);

  const message =
    error?.message ||
    String(error || "UNKNOWN STARTUP ERROR");

  rootElement.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;background:#070a0d;color:#eef4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;">
      <div style="width:min(620px,100%);border:1px solid rgba(255,255,255,.10);border-radius:20px;background:rgba(255,255,255,.035);padding:24px;box-shadow:0 28px 80px rgba(0,0,0,.42);">
        <div style="font-size:10px;letter-spacing:.18em;opacity:.55;margin-bottom:10px;">SYSTEM RECOVERY MODE</div>
        <h1 style="margin:0 0 12px;font-size:24px;letter-spacing:.04em;">STARTUP FAILURE DETECTED</h1>
        <p style="line-height:1.6;opacity:.76;margin:0 0 16px;">The interface stopped before loading. The exact error is shown below so the app never leaves you on a blank white screen.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,.28);border-radius:12px;padding:14px;font-size:12px;line-height:1.5;">${String(message).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre>
        <button id="system-reload-button" style="margin-top:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#eef4f2;border-radius:12px;padding:11px 16px;font-weight:700;cursor:pointer;">RELOAD SYSTEM</button>
      </div>
    </div>
  `;

  document
    .getElementById("system-reload-button")
    ?.addEventListener("click", () => window.location.reload());
}

window.addEventListener("error", (event) => {
  if (!rootElement.hasChildNodes()) {
    showStartupFailure(event.error || event.message);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (!rootElement.hasChildNodes()) {
    showStartupFailure(event.reason);
  }
});

async function bootSystem() {
  try {
    const { default: App } = await import("./App.jsx");

    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    showStartupFailure(error);
  }
}

void bootSystem();
