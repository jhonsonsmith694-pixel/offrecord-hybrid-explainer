// Unit tests for src/router.js — run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { routeFor } from "../src/router.js";

const short = "Short contract clause.";
const long = "x".repeat(5000);

test("auto: short text + Nano available -> on-device", () => {
  const r = routeFor({
    text: short,
    modePref: "auto",
    onDeviceAvailable: true,
    privateOnly: false,
    maxOnDeviceChars: 2000,
  });
  assert.equal(r.engine, "on-device");
  assert.equal(r.mode, "ONLY_ON_DEVICE");
});

test("auto: long text + Nano available -> cloud", () => {
  const r = routeFor({
    text: long,
    modePref: "auto",
    onDeviceAvailable: true,
    privateOnly: false,
    maxOnDeviceChars: 2000,
  });
  assert.equal(r.engine, "cloud");
  assert.equal(r.mode, "ONLY_IN_CLOUD");
});

test("auto: Nano unavailable -> cloud", () => {
  const r = routeFor({
    text: short,
    modePref: "auto",
    onDeviceAvailable: false,
    privateOnly: false,
    maxOnDeviceChars: 2000,
  });
  assert.equal(r.engine, "cloud");
});

test("on-device mode without Nano -> cloud with explanation", () => {
  const r = routeFor({
    text: short,
    modePref: "on-device",
    onDeviceAvailable: false,
    privateOnly: false,
    maxOnDeviceChars: 2000,
  });
  assert.equal(r.engine, "cloud");
  assert.match(r.reason, /not available/);
});

test("cloud mode always -> cloud", () => {
  const r = routeFor({
    text: short,
    modePref: "cloud",
    onDeviceAvailable: true,
    privateOnly: false,
    maxOnDeviceChars: 2000,
  });
  assert.equal(r.engine, "cloud");
  assert.equal(r.mode, "ONLY_IN_CLOUD");
});

test("private toggle + Nano available -> on-device", () => {
  const r = routeFor({
    text: long,
    modePref: "auto",
    onDeviceAvailable: true,
    privateOnly: true,
    maxOnDeviceChars: 2000,
  });
  assert.equal(r.engine, "on-device");
});

test("boundary: exactly maxOnDeviceChars -> on-device", () => {
  const r = routeFor({
    text: "x".repeat(2000),
    modePref: "auto",
    onDeviceAvailable: true,
    privateOnly: false,
    maxOnDeviceChars: 2000,
  });
  assert.equal(r.engine, "on-device");
});
