# OffRecord — Private Plain-Language Explainer

> **#BuildHybridAI 2026 — Best Web/Chrome entry.** Paste dense text (a contract
> clause, terms of service, a medicine leaflet, a policy) and get it explained
> in plain language. Short text runs **on-device with Gemini Nano** — private,
> free, and offline-capable. Long text falls back to **Gemini in the cloud**.
> Your text only leaves the laptop when the cloud engine is used.

## Why hybrid?

Most people either skip dense legal/medical text or paste it into a random
cloud AI — handing sensitive text to a server they don't control. OffRecord
routes each request to the engine that fits it:

| Text | Engine | Why |
| --- | --- | --- |
| Short (≤ 2,000 chars by default) | **On-device · Gemini Nano** | Private (never leaves the laptop), free, works offline once downloaded |
| Long / complex | **Cloud · Gemini** | Bigger context, better quality on long documents |
| Nano unavailable | **Cloud (automatic fallback)** | You always get an answer |

The user can also force **On-device only**, **Cloud only**, or flip the
**Private** toggle (never send text to the cloud). Every result carries a
badge showing which engine ran it and why. History is stored in
`localStorage` only — nothing is ever uploaded.

## How it works (Firebase AI Logic)

- **Firebase AI Logic — Hybrid Inference SDK** (`firebase/ai`): `getAI` with
  `GoogleAIBackend`, `getGenerativeModel` with `InferenceMode.ONLY_ON_DEVICE`
  and `InferenceMode.ONLY_IN_CLOUD`, `generateContent()` with structured
  JSON output (summary, key points, watch-out flags, reading level).
  `initializeDeviceModel()` runs on the user's click before on-device calls.
  See `src/main.js` and `src/router.js` — the SDK is imported **and called
  at runtime**.
- **Firebase App Check**: enforced for AI Logic. On localhost the debug
  provider is used (`self.FIREBASE_APPCHECK_DEBUG_TOKEN = true`); the debug
  token is printed to the console and shown in the app so it can be
  registered in the Firebase console.
- **Firebase Remote Config**: routing threshold (`max_on_device_chars`),
  default mode, and the system prompt — with in-code defaults, so the app
  works before any console values are set.

On-device inference uses Chrome's Prompt API (Gemini Nano 4, Chrome on
Desktop 139+, flag `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`).
On-device generation is single-turn text generation, which is exactly what
this app needs — one explanation per request.

## Setup (5 minutes)

1. Create a Firebase project at https://console.firebase.google.com
2. Go to **AI Services > AI Logic > Get started**, choose the
   **Gemini Developer API** provider (free tier), and register this web app.
3. Copy the web app's `firebaseConfig` into `src/firebase-config.js`.
4. (Local dev) Run the app, open DevTools > Console, copy the App Check
   debug token, and register it in the console under
   **Security > App Check > Apps > Manage debug tokens**.
5. Make sure Chrome has the Prompt API flag enabled (see above) if you want
   to try the on-device path.

## Run it

```bash
npm install
npm run dev      # local dev server (http://localhost:5173)
npm run build    # production build into dist/
npm test         # router unit tests (7 tests)
```

Deploy the `dist/` folder anywhere static: **GitHub Pages** (recommended —
set Pages to deploy from the `dist` folder via a workflow, or publish the
built output) or **Firebase Hosting** (`firebase deploy`, config in
`firebase.json`).

## Project structure

```
app/
  index.html            # single-page UI
  src/
    main.js             # Firebase init, App Check, Remote Config, UI wiring
    router.js           # hybrid routing logic (pure, unit-tested)
    prompts.js          # system prompt, JSON schema, sample texts
    firebase-config.js  # paste your Firebase project config here
    styles.css
  test/router.test.js   # 7 unit tests for the router
  verification/         # headless-Chrome UI checks + screenshots
```

## License

Apache-2.0 — see `LICENSE`.
