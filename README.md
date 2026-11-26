# Sundown

An [Omarchy](https://omarchy.org) shell plugin that runs the night light on the sun's schedule. The screen warms gradually after sunset and cools back before sunrise, at the location you have set for Omarchy's weather.

hyprsunset's own profiles switch at fixed clock times with no transition. Sundown computes sunrise and sunset locally each minute and steps the temperature a little at a time, so the change is not noticeable.

## Install

```bash
omarchy plugin add https://github.com/sddamico/omarchy-sundown --enable
```

Sundown needs coordinates. It reads the same location as the weather panel, so set that once if you haven't:

```bash
omarchy weather location --set "New York" 40.7128,-74.0060
```

A location with only a name, or one left on IP auto-detect, has no coordinates and Sundown stays idle until it gets them.

It uses only what ships with Omarchy: hyprsunset, `hyprctl` and `uwsm-app`. It makes no network requests and writes no configuration; its one file is a runtime marker in `$XDG_RUNTIME_DIR`.

## Remove

```bash
omarchy plugin remove sddamico.sundown
```

The screen keeps the temperature it had at that moment. `omarchy toggle nightlight` switches it back.

## How it behaves

- From sunrise to sunset the screen is untouched
- Over the hour after sunset it warms from 6500K to 4000K
- Over the hour before sunrise it cools back to 6500K
- `omarchy toggle nightlight` and the bar indicator keep working. A manual toggle holds until the schedule next changes the temperature: the next minute during a fade, otherwise the start of the next fade
- Suspend, clock changes and daylight saving need no handling, because every minute is computed from the current time
- Inside the polar circles, a day without sunrise stays at the night temperature and a day without sunset stays neutral

## Settings

Optional keys on the plugin's entry in `~/.config/omarchy/shell.json`. Changes apply on save.

```json
"plugins": [
  { "id": "sddamico.sundown", "nightTemperature": 3500, "fadeMinutes": 90 }
]
```

| Key | Default | Meaning |
|---|---|---|
| `nightTemperature` | `4000` | Kelvin at full night, from 1000 to 6500 |
| `fadeMinutes` | `60` | Length of each fade |

## Status

```bash
omarchy-shell sundown status
```

prints today's sunrise and sunset in UTC, the temperature the schedule wants right now, and the settings in effect.

## Development

The sun math and settings parsing are plain JavaScript in `Sundown.js`:

```bash
node --test test/
omarchy plugin validate .
```

## License

MIT
