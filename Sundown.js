var DAY_TEMPERATURE = 6500
var DEFAULT_NIGHT_TEMPERATURE = 4000
var DEFAULT_FADE_MINUTES = 60

// hyprsunset rejects anything colder
var MIN_TEMPERATURE = 1000

// Zenith for the sun's upper edge on the horizon, including atmospheric refraction
var SUN_ZENITH_DEGREES = 90.833

var MINUTE_MS = 60 * 1000
var DAY_MS = 24 * 60 * MINUTE_MS

function radians(degrees) {
  return degrees * Math.PI / 180
}

// Sunrise and sunset for the local calendar day `date` falls on, by the NOAA
// solar position equations. Inside the polar circles the sun can stay above or
// below the horizon all day, and the two times then mean nothing.
function sunTimes(date, latitude, longitude) {
  var year = date.getFullYear()
  var dayStartUtc = Date.UTC(year, date.getMonth(), date.getDate())
  var dayOfYear = Math.round((dayStartUtc - Date.UTC(year, 0, 1)) / DAY_MS) + 1
  var yearAngle = 2 * Math.PI / 365 * (dayOfYear - 1)

  var equationOfTimeMinutes = 229.18 * (
    0.000075
    + 0.001868 * Math.cos(yearAngle)
    - 0.032077 * Math.sin(yearAngle)
    - 0.014615 * Math.cos(2 * yearAngle)
    - 0.040849 * Math.sin(2 * yearAngle))
  var declination =
    0.006918
    - 0.399912 * Math.cos(yearAngle)
    + 0.070257 * Math.sin(yearAngle)
    - 0.006758 * Math.cos(2 * yearAngle)
    + 0.000907 * Math.sin(2 * yearAngle)
    - 0.002697 * Math.cos(3 * yearAngle)
    + 0.00148 * Math.sin(3 * yearAngle)

  var latitudeRadians = radians(latitude)
  var hourAngleCosine =
    Math.cos(radians(SUN_ZENITH_DEGREES)) / (Math.cos(latitudeRadians) * Math.cos(declination))
    - Math.tan(latitudeRadians) * Math.tan(declination)
  var hourAngleDegrees = Math.acos(Math.max(-1, Math.min(1, hourAngleCosine))) * 180 / Math.PI

  var solarNoonMinutes = 720 - 4 * longitude - equationOfTimeMinutes
  return {
    alwaysUp: hourAngleCosine < -1,
    neverUp: hourAngleCosine > 1,
    sunrise: new Date(dayStartUtc + (solarNoonMinutes - 4 * hourAngleDegrees) * MINUTE_MS),
    sunset: new Date(dayStartUtc + (solarNoonMinutes + 4 * hourAngleDegrees) * MINUTE_MS)
  }
}

// The screen cools to daylight over the fade before sunrise and warms to the
// night temperature over the fade after sunset.
function temperatureAt(now, latitude, longitude, nightTemperature, fadeMinutes) {
  var sun = sunTimes(now, latitude, longitude)
  if (sun.neverUp) return nightTemperature
  if (sun.alwaysUp || (now >= sun.sunrise && now <= sun.sunset)) return DAY_TEMPERATURE

  var minutesFromDaylight = (now < sun.sunrise ? sun.sunrise - now : now - sun.sunset) / MINUTE_MS
  var daylight = Math.max(0, 1 - minutesFromDaylight / fadeMinutes)
  return Math.round(nightTemperature + (DAY_TEMPERATURE - nightTemperature) * daylight)
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch (error) {
    return null
  }
}

// This plugin's entry in the plugins[] list of shell.json.
function settingsFrom(shellJsonText, pluginId) {
  var config = parseJson(shellJsonText)
  var entries = config && Array.isArray(config.plugins) ? config.plugins : []
  var entry = {}
  for (var i = 0; i < entries.length; i++)
    if (entries[i] && entries[i].id === pluginId) entry = entries[i]

  var nightTemperature = Number(entry.nightTemperature)
  var fadeMinutes = Number(entry.fadeMinutes)
  return {
    nightTemperature: isFinite(nightTemperature) && entry.nightTemperature !== undefined
      ? Math.max(MIN_TEMPERATURE, Math.min(DAY_TEMPERATURE, Math.round(nightTemperature)))
      : DEFAULT_NIGHT_TEMPERATURE,
    fadeMinutes: isFinite(fadeMinutes) && fadeMinutes >= 1 ? fadeMinutes : DEFAULT_FADE_MINUTES
  }
}

// The location `omarchy weather location --set <name> <lat,lon>` stores. A
// name without coordinates is enough for the weather panel but not for the sun.
function locationFrom(weatherJsonText) {
  var stored = parseJson(weatherJsonText)
  if (!stored || typeof stored.latitude !== "number" || typeof stored.longitude !== "number") return null
  return { latitude: stored.latitude, longitude: stored.longitude }
}

if (typeof module !== "undefined") {
  module.exports = {
    DAY_TEMPERATURE: DAY_TEMPERATURE,
    DEFAULT_NIGHT_TEMPERATURE: DEFAULT_NIGHT_TEMPERATURE,
    DEFAULT_FADE_MINUTES: DEFAULT_FADE_MINUTES,
    sunTimes: sunTimes,
    temperatureAt: temperatureAt,
    settingsFrom: settingsFrom,
    locationFrom: locationFrom
  }
}
