process.env.TZ = "America/New_York"

const assert = require("node:assert/strict")
const { test } = require("node:test")
const Sundown = require("../Sundown.js")

const NEW_YORK = { latitude: 40.7128, longitude: -74.006 }
const TROMSO = { latitude: 69.6492, longitude: 18.9553 }
const ID = "sddamico.sundown"

function assertWithinMinutes(actual, expectedIso, minutes) {
  const difference = Math.abs(actual - new Date(expectedIso)) / 60000
  assert.ok(difference <= minutes, `${actual.toISOString()} is ${difference.toFixed(1)} min from ${expectedIso}`)
}

function temperatureInNewYork(iso, nightTemperature = 4000, fadeMinutes = 60) {
  return Sundown.temperatureAt(new Date(iso), NEW_YORK.latitude, NEW_YORK.longitude, nightTemperature, fadeMinutes)
}

// Almanac times for New York City: 05:25 and 20:31 EDT at the June solstice,
// 07:17 and 16:32 EST at the December solstice.
test("sunrise and sunset match the almanac at the summer solstice", () => {
  const sun = Sundown.sunTimes(new Date("2026-06-21T12:00:00-04:00"), NEW_YORK.latitude, NEW_YORK.longitude)
  assertWithinMinutes(sun.sunrise, "2026-06-21T05:25:00-04:00", 3)
  assertWithinMinutes(sun.sunset, "2026-06-21T20:31:00-04:00", 3)
})

test("sunrise and sunset match the almanac at the winter solstice", () => {
  const sun = Sundown.sunTimes(new Date("2026-12-21T12:00:00-05:00"), NEW_YORK.latitude, NEW_YORK.longitude)
  assertWithinMinutes(sun.sunrise, "2026-12-21T07:17:00-05:00", 3)
  assertWithinMinutes(sun.sunset, "2026-12-21T16:32:00-05:00", 3)
})

test("late evening uses the sun times of its own local day, not the UTC day", () => {
  const sun = Sundown.sunTimes(new Date("2026-12-21T23:30:00-05:00"), NEW_YORK.latitude, NEW_YORK.longitude)
  assertWithinMinutes(sun.sunset, "2026-12-21T16:32:00-05:00", 3)
})

test("daylight is neutral and deep night is the night temperature", () => {
  assert.equal(temperatureInNewYork("2026-12-21T12:00:00-05:00"), 6500)
  assert.equal(temperatureInNewYork("2026-12-21T23:00:00-05:00"), 4000)
  assert.equal(temperatureInNewYork("2026-12-21T03:00:00-05:00"), 4000)
})

test("the screen warms across the fade after sunset", () => {
  const sunset = Sundown.sunTimes(new Date("2026-12-21T12:00:00-05:00"), NEW_YORK.latitude, NEW_YORK.longitude).sunset
  const after = (minutes) =>
    Sundown.temperatureAt(new Date(sunset.getTime() + minutes * 60000), NEW_YORK.latitude, NEW_YORK.longitude, 4000, 60)

  assert.equal(after(15), 5875)
  assert.equal(after(30), 5250)
  assert.equal(after(60), 4000)
  assert.equal(after(90), 4000)
})

test("the screen cools across the fade before sunrise", () => {
  const sunrise = Sundown.sunTimes(new Date("2026-12-21T12:00:00-05:00"), NEW_YORK.latitude, NEW_YORK.longitude).sunrise
  const before = (minutes) =>
    Sundown.temperatureAt(new Date(sunrise.getTime() - minutes * 60000), NEW_YORK.latitude, NEW_YORK.longitude, 4000, 60)

  assert.equal(before(90), 4000)
  assert.equal(before(45), 4625)
  assert.equal(before(15), 5875)
})

test("fade length and night temperature shape the ramp", () => {
  const sunset = Sundown.sunTimes(new Date("2026-12-21T12:00:00-05:00"), NEW_YORK.latitude, NEW_YORK.longitude).sunset
  const tenMinutesAfter = new Date(sunset.getTime() + 10 * 60000)

  assert.equal(Sundown.temperatureAt(tenMinutesAfter, NEW_YORK.latitude, NEW_YORK.longitude, 3000, 20), 4750)
})

test("polar night stays at the night temperature through midday", () => {
  const noon = new Date("2026-12-21T11:00:00Z")
  assert.equal(Sundown.temperatureAt(noon, TROMSO.latitude, TROMSO.longitude, 4000, 60), 4000)
})

test("midnight sun stays neutral through the night", () => {
  const midnight = new Date("2026-06-21T23:00:00Z")
  assert.equal(Sundown.temperatureAt(midnight, TROMSO.latitude, TROMSO.longitude, 4000, 60), 6500)
})

test("settings default when the plugin entry carries none", () => {
  const shellJson = JSON.stringify({ plugins: [{ id: ID }] })
  assert.deepEqual(Sundown.settingsFrom(shellJson, ID), { nightTemperature: 4000, fadeMinutes: 60 })
})

test("settings come from this plugin's entry only", () => {
  const shellJson = JSON.stringify({
    plugins: [{ id: "acme.other", nightTemperature: 2000, fadeMinutes: 5 }, { id: ID, nightTemperature: 3400, fadeMinutes: 90 }]
  })
  assert.deepEqual(Sundown.settingsFrom(shellJson, ID), { nightTemperature: 3400, fadeMinutes: 90 })
})

test("night temperature is held within what hyprsunset accepts and below daylight", () => {
  const settings = (nightTemperature) =>
    Sundown.settingsFrom(JSON.stringify({ plugins: [{ id: ID, nightTemperature }] }), ID).nightTemperature

  assert.equal(settings(200), 1000)
  assert.equal(settings(9000), 6500)
})

test("unusable settings fall back to the defaults", () => {
  const shellJson = JSON.stringify({ plugins: [{ id: ID, nightTemperature: "warm", fadeMinutes: 0 }] })
  assert.deepEqual(Sundown.settingsFrom(shellJson, ID), { nightTemperature: 4000, fadeMinutes: 60 })
  assert.deepEqual(Sundown.settingsFrom("not json", ID), { nightTemperature: 4000, fadeMinutes: 60 })
})

test("location needs coordinates, not just a name", () => {
  assert.deepEqual(
    Sundown.locationFrom(JSON.stringify({ name: "New York", latitude: 40.7128, longitude: -74.006 })),
    { latitude: 40.7128, longitude: -74.006 })
  assert.equal(Sundown.locationFrom(JSON.stringify({ name: "Malibu" })), null)
  assert.equal(Sundown.locationFrom(""), null)
})
