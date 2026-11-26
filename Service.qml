import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import "Sundown.js" as Sundown

// Holds no countdown: every tick recomputes the temperature for the current
// instant, so suspend, clock changes and daylight saving correct themselves on
// the next tick.
Item {
  id: root

  // Injected by omarchy-shell's service loader.
  property var shell: null
  property var manifest: null

  readonly property string pluginId: "sddamico.sundown"
  readonly property string home: Quickshell.env("HOME")

  property var settings: Sundown.settingsFrom("", pluginId)
  property var location: null

  function pluginFile(name) {
    // Qt percent-encodes the URL, so a path with a space would not be found
    return decodeURIComponent(String(Qt.resolvedUrl(name)).replace(/^file:\/\//, ""))
  }

  function temperatureNow() {
    return Sundown.temperatureAt(new Date(), location.latitude, location.longitude,
      settings.nightTemperature, settings.fadeMinutes)
  }

  function evaluate() {
    if (!location || applyProcess.running) return
    applyProcess.command = [pluginFile("bin/sundown-apply"), String(temperatureNow())]
    applyProcess.running = true
  }

  onSettingsChanged: evaluate()
  onLocationChanged: evaluate()

  // The scoped plugin API only exposes the bar subtree of shell.json, so a
  // service without a bar widget reads its own plugins[] entry from the file.
  FileView {
    path: root.home + "/.config/omarchy/shell.json"
    watchChanges: true
    onFileChanged: reload()
    onLoaded: root.settings = Sundown.settingsFrom(text(), root.pluginId)
  }

  FileView {
    path: root.home + "/.local/state/omarchy/settings/weather.json"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.location = Sundown.locationFrom(text())
    onLoadFailed: {
      root.location = null
      console.warn("sundown: no location; set one with: omarchy weather location --set <name> <lat,lon>")
    }
  }

  Timer {
    interval: 60 * 1000
    running: true
    repeat: true
    onTriggered: root.evaluate()
  }

  Process {
    id: applyProcess
    stderr: StdioCollector {
      onStreamFinished: if (text.trim()) console.warn(text.trim())
    }
  }

  ShellIpc {
    target: "sundown"

    function status(): string {
      if (!root.location) return JSON.stringify({ location: null })

      var sun = Sundown.sunTimes(new Date(), root.location.latitude, root.location.longitude)
      return JSON.stringify({
        location: root.location,
        sunrise: sun.sunrise.toISOString(),
        sunset: sun.sunset.toISOString(),
        temperature: root.temperatureNow(),
        nightTemperature: root.settings.nightTemperature,
        fadeMinutes: root.settings.fadeMinutes
      })
    }
  }
}
