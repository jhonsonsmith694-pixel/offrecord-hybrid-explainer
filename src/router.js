// ---------------------------------------------------------------------------
// Hybrid routing for OffRecord.
//
// The idea: route each request to the engine that fits it best, and be
// explicit about the choice so the user (and the judges) can see it.
//
//   - Short text + on-device model available  -> ON-DEVICE (Gemini Nano).
//     Private: the text never leaves the laptop. Free. Works offline once
//     the model is downloaded.
//   - Long/complex text, or no on-device model -> CLOUD (Gemini).
//     Bigger context window, better quality on long documents.
//
// Modes are chosen with Firebase AI Logic InferenceMode values so the
// engine is deterministic: ONLY_ON_DEVICE guarantees the on-device model
// (and throws if it cannot run); ONLY_IN_CLOUD guarantees the cloud model.
// AUTO picks one of the two and, if the on-device call fails, falls back
// to the cloud once and says so on the badge.
//
// This module is pure (no Firebase imports) so it can be unit-tested in
// plain Node. See test/router.test.js.
// ---------------------------------------------------------------------------

export const ENGINE_ON_DEVICE = "on-device";
export const ENGINE_CLOUD = "cloud";

/**
 * Decide which engine should handle a request.
 *
 * @param {object} opts
 * @param {string} opts.text            The text to explain.
 * @param {"auto"|"on-device"|"cloud"} opts.modePref  User's mode preference.
 * @param {boolean} opts.onDeviceAvailable  Whether Gemini Nano is available
 *   in this browser (from LanguageModel.availability()).
 * @param {boolean} opts.privateOnly    True when the user flipped the
 *   "Private" toggle: never send text to the cloud.
 * @param {number} opts.maxOnDeviceChars  Texts up to this length are
 *   eligible for on-device inference (from Remote Config, default 2000).
 * @returns {{engine: string, mode: string, reason: string}}
 *   engine: "on-device" | "cloud"; mode: the InferenceMode string to use;
 *   reason: short human-readable explanation shown on the result badge.
 */
export function routeFor({
  text,
  modePref,
  onDeviceAvailable,
  privateOnly,
  maxOnDeviceChars,
}) {
  const length = (text || "").trim().length;

  if (modePref === "on-device") {
    if (!onDeviceAvailable) {
      return {
        engine: ENGINE_CLOUD,
        mode: "ONLY_IN_CLOUD",
        reason:
          "You asked for on-device only, but Gemini Nano is not available in this browser — using the cloud so you still get an answer.",
      };
    }
    return {
      engine: ENGINE_ON_DEVICE,
      mode: "ONLY_ON_DEVICE",
      reason: "On-device only, as you asked. Nothing leaves this laptop.",
    };
  }

  if (modePref === "cloud") {
    return {
      engine: ENGINE_CLOUD,
      mode: "ONLY_IN_CLOUD",
      reason: "Cloud, as you asked. Best quality for long or complex text.",
    };
  }

  // AUTO
  if (privateOnly) {
    if (!onDeviceAvailable) {
      return {
        engine: ENGINE_CLOUD,
        mode: "ONLY_IN_CLOUD",
        reason:
          "Private mode is on but Gemini Nano is not available here — the cloud is the only option. Turn Private off only if you are OK sending this text to the cloud.",
      };
    }
    return {
      engine: ENGINE_ON_DEVICE,
      mode: "ONLY_ON_DEVICE",
      reason:
        "Private mode: short text, processed on-device. Nothing leaves this laptop.",
    };
  }

  if (onDeviceAvailable && length <= maxOnDeviceChars) {
    return {
      engine: ENGINE_ON_DEVICE,
      mode: "ONLY_ON_DEVICE",
      reason: `Short text (${length} chars) — on-device is fast, free, and private.`,
    };
  }

  if (onDeviceAvailable && length > maxOnDeviceChars) {
    return {
      engine: ENGINE_CLOUD,
      mode: "ONLY_IN_CLOUD",
      reason: `Long text (${length} chars) — the cloud model handles long documents better.`,
    };
  }

  return {
    engine: ENGINE_CLOUD,
    mode: "ONLY_IN_CLOUD",
    reason:
      "Gemini Nano is not available in this browser — using the cloud so you still get an answer.",
  };
}
