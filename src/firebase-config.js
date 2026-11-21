// ---------------------------------------------------------------------------
// Firebase configuration for OffRecord.
//
// HOW TO FILL THIS IN (takes ~5 minutes in the Firebase console):
//   1. Create a Firebase project at https://console.firebase.google.com
//   2. Go to AI Services > AI Logic > Get started, choose the
//      "Gemini Developer API" provider (free tier), and register this web app.
//   3. Copy the web app's firebaseConfig object from the console and paste
//      it below, replacing the placeholder values.
//   4. App Check is enforced for AI Logic. For local development, run the
//      app, open DevTools > Console, copy the "AppCheck debug token" it
//      prints, and register it in the console under
//      Security > App Check > Apps > Manage debug tokens.
//
// The Firebase web apiKey is public by design (it identifies the project,
// it is not a secret). App Check is what protects the Gemini API from abuse.
// ---------------------------------------------------------------------------

export const firebaseConfig = {
  apiKey: "AIzaSyDXz4P9A15AYatFT3wh4yre4t_n_0DD7vc",
  authDomain: "studio-5334675680-2b32f.firebaseapp.com",
  projectId: "studio-5334675680-2b32f",
  storageBucket: "studio-5334675680-2b32f.firebasestorage.app",
  messagingSenderId: "978251268215",
  appId: "1:978251268215:web:ef523c047bbaa5ae944672",
  // Optional: reCAPTCHA v3 site key for App Check (from the Firebase
  // console, App Check > Apps > your web app). Leave the placeholder in
  // place for local development — the App Check debug provider is used
  // on localhost instead, and the debug token is shown in the app.
  appCheckSiteKey: "YOUR_RECAPTCHA_SITE_KEY",
};

/** True when a real Firebase config has been pasted in. */
export function isConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.apiKey !== "YOUR_API_KEY" &&
      firebaseConfig.projectId &&
      firebaseConfig.projectId !== "YOUR_PROJECT_ID"
  );
}
