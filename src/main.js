// ---------------------------------------------------------------------------
// OffRecord — main app.
//
// Flow:
//   1. Initialise Firebase (config in firebase-config.js) + App Check.
//      On localhost a debug token is used; the token is printed to the
//      console and shown in the setup panel so it can be registered in the
//      Firebase console (Security > App Check > Manage debug tokens).
//   2. Fetch Remote Config (with in-code defaults, so the app works even
//      before any console values are set): maxOnDeviceChars, default mode.
//   3. Detect on-device availability via the Chrome Prompt API
//      (LanguageModel.availability()) and show the status.
//   4. On "Explain": route the request (see router.js), call
//      initializeDeviceModel() after the click when the on-device path is
//      used, then generateContent() through the Firebase AI Logic SDK.
//      If the on-device call fails in AUTO mode, fall back to the cloud
//      once and say so on the badge.
//   5. Render the structured JSON result and save it to local history
//      (localStorage — nothing is uploaded).
//
// Firebase AI Logic is imported AND called at runtime (getAI,
// getGenerativeModel, generateContent) — that is the point of the app.
// ---------------------------------------------------------------------------

import { initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
} from "firebase/app-check";
import { getRemoteConfig, fetchAndActivate, getValue } from "firebase/remote-config";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "firebase/ai";

import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { routeFor, ENGINE_ON_DEVICE, ENGINE_CLOUD } from "./router.js";
import {
  SYSTEM_PROMPT,
  EXPLAIN_INSTRUCTION,
  EXPLAIN_SCHEMA,
  SAMPLES,
} from "./prompts.js";

// --- Remote Config defaults (used when no console values are set) ---------
const RC_DEFAULTS = {
  max_on_device_chars: "2000",
  default_mode: "auto",
  system_prompt: SYSTEM_PROMPT,
};

// --- DOM ------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const inputEl = $("input-text");
const charCountEl = $("char-count");
const modeEl = $("mode");
const privateEl = $("private-toggle");
const explainBtn = $("explain-btn");
const statusEl = $("status");
const resultEl = $("result");
const historyEl = $("history-list");
const setupBanner = $("setup-banner");
const engineBadge = $("engine-badge");
const onDeviceStatusEl = $("ondevice-status");
const debugTokenEl = $("debug-token");

// --- State ----------------------------------------------------------------
let firebaseApp = null;
let ai = null;
let remoteConfig = null;
let onDeviceAvailability = "unknown"; // "available" | "downloading" | "downloadable" | "unavailable" | "unknown"
let onDeviceModel = null; // GenerativeModel with ONLY_ON_DEVICE
let cloudModel = null; // GenerativeModel with ONLY_IN_CLOUD
let rc = { ...RC_DEFAULTS };

// --- Helpers --------------------------------------------------------------
function setStatus(msg, kind = "") {
  statusEl.textContent = msg;
  statusEl.className = `status ${kind}`;
}

function showSetupBanner() {
  setupBanner.hidden = false;
  explainBtn.disabled = true;
  setStatus(
    "Firebase is not configured yet — paste your project's config into src/firebase-config.js (see README).",
    "warn"
  );
}

function updateCharCount() {
  const len = inputEl.value.length;
  charCountEl.textContent = `${len.toLocaleString()} characters`;
}

function systemPrompt() {
  return rc.system_prompt || SYSTEM_PROMPT;
}

function maxOnDeviceChars() {
  const n = parseInt(rc.max_on_device_chars, 10);
  return Number.isFinite(n) && n > 0 ? n : 2000;
}

// --- On-device availability ----------------------------------------------
async function detectOnDevice() {
  onDeviceStatusEl.textContent = "Checking…";
  try {
    if (typeof LanguageModel === "undefined") {
      onDeviceAvailability = "unavailable";
      onDeviceStatusEl.textContent =
        "Not available — this browser has no on-device model (needs Chrome on Desktop 139+ with the Prompt API flag). Cloud fallback will be used.";
      return;
    }
    const availability = await LanguageModel.availability();
    onDeviceAvailability = availability;
    if (availability === "available") {
      onDeviceStatusEl.textContent =
        "Available — Gemini Nano is ready on this device.";
    } else if (availability === "downloading" || availability === "downloadable") {
      onDeviceStatusEl.textContent =
        "Downloading — Gemini Nano is being downloaded. First on-device run may take a moment.";
    } else {
      onDeviceStatusEl.textContent =
        "Unavailable — Gemini Nano cannot run here. Cloud fallback will be used.";
    }
  } catch (err) {
    onDeviceAvailability = "unavailable";
    onDeviceStatusEl.textContent = `Unavailable (${err.message}). Cloud fallback will be used.`;
  }
}

// --- Firebase init --------------------------------------------------------
async function initFirebase() {
  if (!isConfigured()) {
    showSetupBanner();
    return false;
  }

  firebaseApp = initializeApp(firebaseConfig);

  // App Check: debug provider on localhost (the debug token is printed to
  // the console and shown in the setup panel); reCAPTCHA v3 in production.
  // The debug token must be registered in the Firebase console.
  // When self.FIREBASE_APPCHECK_DEBUG_TOKEN is true, the SDK uses the debug
  // provider instead of the configured one, so the placeholder site key
  // below is never actually used on localhost.
  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    new URLSearchParams(location.search).has("debugAppCheck");
  if (isLocal) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    const siteKey =
      firebaseConfig.appCheckSiteKey &&
      firebaseConfig.appCheckSiteKey !== "YOUR_RECAPTCHA_SITE_KEY"
        ? firebaseConfig.appCheckSiteKey
        : "debug";
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // App Check is best-effort here; AI Logic calls will surface real errors.
    console.warn("App Check init:", err.message);
  }
  // The SDK prints the debug token to the console; surface it in the UI too.
  setTimeout(() => {
    const token = self.FIREBASE_APPCHECK_DEBUG_TOKEN;
    if (typeof token === "string" && token.length > 10) {
      debugTokenEl.textContent = token;
      debugTokenEl.parentElement.hidden = false;
    }
  }, 1500);

  // Remote Config (defaults apply until console values are set).
  try {
    remoteConfig = getRemoteConfig(firebaseApp);
    remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
    remoteConfig.defaultConfig = RC_DEFAULTS;
    await fetchAndActivate(remoteConfig);
    rc = {
      max_on_device_chars: getValue(remoteConfig, "max_on_device_chars").asString() || RC_DEFAULTS.max_on_device_chars,
      default_mode: getValue(remoteConfig, "default_mode").asString() || RC_DEFAULTS.default_mode,
      system_prompt: getValue(remoteConfig, "system_prompt").asString() || RC_DEFAULTS.system_prompt,
    };
  } catch (err) {
    console.warn("Remote Config fetch failed, using defaults:", err.message);
    rc = { ...RC_DEFAULTS };
  }

  // Firebase AI Logic — Gemini Developer API backend.
  ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
  onDeviceModel = getGenerativeModel(ai, {
    model: "gemini-2.5-flash",
    mode: InferenceMode.ONLY_ON_DEVICE,
    systemInstruction: systemPrompt(),
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: EXPLAIN_SCHEMA,
    },
  });
  cloudModel = getGenerativeModel(ai, {
    model: "gemini-2.5-flash",
    mode: InferenceMode.ONLY_IN_CLOUD,
    systemInstruction: systemPrompt(),
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: EXPLAIN_SCHEMA,
    },
  });

  // Apply the Remote Config default mode to the selector.
  if (rc.default_mode && ["auto", "on-device", "cloud"].includes(rc.default_mode)) {
    modeEl.value = rc.default_mode;
  }
  return true;
}

// --- Model call -----------------------------------------------------------
async function explainWith(model, text) {
  const prompt = `${EXPLAIN_INSTRUCTION}${text}`;
  const result = await model.generateContent(prompt);
  return result.response.text();
}

function parseResult(raw) {
  try {
    const parsed = JSON.parse(raw);
    return {
      summary: parsed.summary || raw,
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      watchOut: Array.isArray(parsed.watchOut) ? parsed.watchOut : [],
      readingLevel: parsed.readingLevel || "—",
    };
  } catch {
    // The model returned plain text instead of JSON; show it as the summary.
    return { summary: raw, keyPoints: [], watchOut: [], readingLevel: "—" };
  }
}

// --- UI: result + history --------------------------------------------------
function renderResult(data, engine, reason, fallbackNote) {
  engineBadge.hidden = false;
  engineBadge.className = `badge ${engine === ENGINE_ON_DEVICE ? "badge-device" : "badge-cloud"}`;
  engineBadge.textContent =
    engine === ENGINE_ON_DEVICE ? "🔒 On-device · Gemini Nano" : "☁️ Cloud · Gemini";
  resultEl.hidden = false;
  $("result-reason").textContent = reason + (fallbackNote ? ` ${fallbackNote}` : "");
  $("result-summary").textContent = data.summary;
  $("result-level").textContent = `Reading level: ${data.readingLevel}`;
  const pointsEl = $("result-points");
  pointsEl.innerHTML = "";
  data.keyPoints.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    pointsEl.appendChild(li);
  });
  $("result-points-wrap").hidden = data.keyPoints.length === 0;
  const watchEl = $("result-watch");
  watchEl.innerHTML = "";
  data.watchOut.forEach((w) => {
    const li = document.createElement("li");
    li.textContent = w;
    watchEl.appendChild(li);
  });
  $("result-watch-wrap").hidden = data.watchOut.length === 0;
}

function saveHistory(entry) {
  try {
    const items = JSON.parse(localStorage.getItem("offrecord-history") || "[]");
    items.unshift(entry);
    localStorage.setItem("offrecord-history", JSON.stringify(items.slice(0, 20)));
  } catch {
    // History is best-effort; never break the main flow.
  }
  renderHistory();
}

function renderHistory() {
  let items = [];
  try {
    items = JSON.parse(localStorage.getItem("offrecord-history") || "[]");
  } catch {
    items = [];
  }
  historyEl.innerHTML = "";
  if (items.length === 0) {
    historyEl.innerHTML = `<li class="muted">Nothing yet — your past explanations stay on this device only.</li>`;
    return;
  }
  items.forEach((it) => {
    const li = document.createElement("li");
    const when = new Date(it.at).toLocaleString();
    li.innerHTML = `<button type="button" class="history-item" data-id="${it.id}"></button>`;
    const btn = li.querySelector("button");
    btn.textContent = `${it.engine === ENGINE_ON_DEVICE ? "🔒" : "☁️"} ${it.preview} — ${when}`;
    btn.addEventListener("click", () => {
      inputEl.value = it.text;
      updateCharCount();
      inputEl.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    historyEl.appendChild(li);
  });
}

// --- Main action -----------------------------------------------------------
async function onExplain() {
  const text = inputEl.value.trim();
  if (!text) {
    setStatus("Paste some text first — try one of the samples below.", "warn");
    return;
  }
  if (!firebaseApp) {
    setStatus("Firebase is not configured yet — see the setup banner above.", "warn");
    return;
  }

  explainBtn.disabled = true;
  explainBtn.textContent = "Explaining…";
  resultEl.hidden = true;
  engineBadge.hidden = true;

  const route = routeFor({
    text,
    modePref: modeEl.value,
    onDeviceAvailable: onDeviceAvailability === "available" || onDeviceAvailability === "downloading",
    privateOnly: privateEl.checked,
    maxOnDeviceChars: maxOnDeviceChars(),
  });

  try {
    let raw;
    let engine = route.engine;
    let reason = route.reason;
    let fallbackNote = "";

    if (route.engine === ENGINE_ON_DEVICE) {
      // initializeDeviceModel() must run on a user gesture, before the call.
      setStatus("Starting the on-device model…");
      onDeviceModel.initializeDeviceModel((progress) => {
        setStatus(`Downloading the on-device model… ${Math.round(progress * 100)}%`);
      });
      try {
        raw = await explainWith(onDeviceModel, text);
      } catch (err) {
        // On-device failed. In AUTO mode (and only when the user has not
        // asked for private-only processing), fall back to the cloud once
        // and say so on the badge. In "on-device only" mode, or with the
        // Private toggle on, a failure is a failure — never silently send
        // the text to the cloud against the user's choice.
        if (modeEl.value === "auto" && !privateEl.checked) {
          fallbackNote = "On-device failed, so the cloud stepped in.";
          engine = ENGINE_CLOUD;
          reason = "On-device was chosen but could not run here.";
          setStatus("On-device failed — falling back to the cloud…");
          raw = await explainWith(cloudModel, text);
        } else {
          throw err;
        }
      }
    } else {
      setStatus("Asking the cloud model…");
      raw = await explainWith(cloudModel, text);
    }

    const data = parseResult(raw);
    renderResult(data, engine, reason, fallbackNote);
    setStatus(`Done — explained with ${engine === ENGINE_ON_DEVICE ? "Gemini Nano on this device" : "Gemini in the cloud"}.`, "ok");
    saveHistory({
      id: Date.now(),
      at: new Date().toISOString(),
      engine,
      text,
      preview: text.slice(0, 60).replace(/\s+/g, " ") + (text.length > 60 ? "…" : ""),
    });
  } catch (err) {
    console.error(err);
    setStatus(`Something went wrong: ${err.message || err}`, "error");
  } finally {
    explainBtn.disabled = false;
    explainBtn.textContent = "Explain it";
  }
}

// --- Wiring ----------------------------------------------------------------
inputEl.addEventListener("input", updateCharCount);
explainBtn.addEventListener("click", onExplain);
$("copy-btn").addEventListener("click", async () => {
  const text = $("result-summary").textContent;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Summary copied to the clipboard.", "ok");
  } catch {
    setStatus("Could not copy — select the text manually.", "warn");
  }
});

// Sample buttons.
document.querySelectorAll("[data-sample]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const sample = SAMPLES.find((s) => s.id === btn.dataset.sample);
    if (sample) {
      inputEl.value = sample.text;
      updateCharCount();
      inputEl.focus();
    }
  });
});

// Boot.
updateCharCount();
renderHistory();
detectOnDevice();
initFirebase().then((ok) => {
  if (ok) setStatus("Ready. Paste dense text, pick a mode, and hit Explain.");
});
