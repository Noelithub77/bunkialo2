import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import "BunkialoApi.js" as Api
import "BunkialoCache.js" as Cache

Item {
  id: root

  readonly property string apiOrigin: "https://bunkialo.noelmcv7.workers.dev"
  readonly property string cacheDir: {
    var base = String(Quickshell.env("XDG_CACHE_HOME") || "")
    return (base || (String(Quickshell.env("HOME") || "") + "/.cache"))
      + "/bunkialo-omarchy"
  }
  readonly property string cachePath: root.cacheDir + "/snapshot.json"
  readonly property string lastGoodCachePath: root.cacheDir + "/snapshot-last-good.json"
  readonly property string settingsPath: root.cacheDir + "/settings.json"
  readonly property string secretService: "bunkialo-omarchy"
  readonly property string secretAccount: "desktop"

  property string token: ""
  property var snapshot: ({ generatedAt: 0, timetable: [], notifications: [] })
  property var messMenu: []
  property var classAlertKeys: ({})
  property int leadMinutes: 10
  property real lastRefreshAt: 0
  property real notificationSeenAt: 0
  property bool stale: false
  property bool loading: false
  property string errorMessage: ""
  property date now: new Date()
  property var cacheCandidates: ({})
  property bool timetableExpanded: false
  property bool menuExpanded: false
  property bool wifixMode: false

  readonly property bool paired: root.token.trim() !== ""
  readonly property bool hasData: root.snapshot.timetable.length > 0
    || root.snapshot.notifications.length > 0
  readonly property int unreadCount: root.snapshot.notifications.filter(function(row) {
    if (!row || row.unread !== true) return false
    var createdAt = Date.parse(String(row.createdAt || ""))
    return !isFinite(createdAt) || createdAt > root.notificationSeenAt
  }).length
  readonly property bool unread: root.unreadCount > 0
  readonly property var glance: Api.currentAndNext(root.snapshot.timetable, root.now)
  readonly property var mealGlance: Api.mealWindow(root.messMenu, root.now)

  signal dataChanged()

  property alias currentSsid: wifix.currentSsid
  property alias wifixChecking: wifix.wifixChecking
  property alias wifixAvailable: wifix.wifixAvailable
  property alias wifixConnected: wifix.wifixConnected
  property alias wifixMessage: wifix.wifixMessage

  WifixService {
    id: wifix
    cacheDir: root.cacheDir
    pairingCode: root.token
    onChanged: root.dataChanged()
  }

  function startWifixConnect() { wifix.connect() }
  function logoutWifix() { wifix.logout() }
  function detectWifix(force) { wifix.detect(force) }

  function toggleTimetable() {
    root.timetableExpanded = !root.timetableExpanded
    root.dataChanged()
  }

  function toggleMenu() {
    root.menuExpanded = !root.menuExpanded
    root.dataChanged()
  }

  function toggleExpanded() {
    var expand = !(root.timetableExpanded && root.menuExpanded)
    root.timetableExpanded = expand
    root.menuExpanded = expand
    root.dataChanged()
    return expand ? "expanded" : "collapsed"
  }

  function setError(message) {
    root.errorMessage = String(message || "Refresh failed")
    root.stale = root.hasData || root.lastRefreshAt > 0
    root.loading = false
    root.dataChanged()
  }

  function useCachedSnapshot(parsed) {
    root.snapshot = Api.parseSnapshot(JSON.stringify(parsed))
    root.lastRefreshAt = Number(parsed.generatedAt) || 0
    root.notificationSeenAt = Number(parsed.notificationSeenAt) || 0
    root.stale = false
    root.dataChanged()
  }

  function markInboxSeen() {
    root.notificationSeenAt = Date.now()
    root.persistSnapshot(root.snapshot)
    root.dataChanged()
  }

  function readCache(raw, source) {
    var parsed = Cache.parse(raw)
    if (!parsed) return
    var candidates = Object.assign({}, root.cacheCandidates)
    candidates[String(source || "primary")] = parsed
    root.cacheCandidates = candidates
    var newest = Object.keys(candidates).map(function(key) {
      return candidates[key]
    }).sort(function(left, right) {
      return (Number(right.generatedAt) || 0) - (Number(left.generatedAt) || 0)
    })[0]
    if (newest) root.useCachedSnapshot(newest)
  }

  function readSettings(raw) {
    try {
      var parsed = JSON.parse(String(raw || ""))
      var value = Number(parsed.leadMinutes)
      if (isFinite(value)) root.leadMinutes = Math.max(0, Math.min(60, Math.round(value)))
    } catch (error) {
      root.leadMinutes = 10
    }
  }

  function saveSettings() {
    mkdirProc.command = ["mkdir", "-p", root.cacheDir]
    mkdirProc.running = true
  }

  function saveSettingsFile() {
    settingsFile.setText(JSON.stringify({ leadMinutes: root.leadMinutes }, null, 2) + "\n")
  }

  function setLeadMinutes(value) {
    var next = Number(value)
    if (!isFinite(next)) return
    root.leadMinutes = Math.max(0, Math.min(60, Math.round(next)))
    root.saveSettings()
  }

  function loadToken() {
    tokenProc.running = true
  }

  function saveToken(value) {
    var next = String(value || "").trim()
    try {
      Api.parsePairingCode(next)
    } catch (error) {
      root.setError("Paste the shared credentials JSON from Bunkialo")
      return false
    }
    root.token = next
    storeTokenProc.stdinEnabled = true
    storeTokenProc.running = true
    return true
  }

  function clearToken() {
    clearTokenProc.running = true
    root.token = ""
    root.snapshot = ({ generatedAt: 0, timetable: [], notifications: [] })
    root.lastRefreshAt = 0
    root.notificationSeenAt = 0
    root.stale = false
    root.errorMessage = ""
    root.dataChanged()
  }

  function refresh() {
    root.detectWifix(true)
    if (!root.paired || fetchProc.running || cacheDirProc.running) return
    root.loading = true
    root.errorMessage = ""
    cacheDirProc.running = true
  }

  function startFetch() {
    if (!root.paired || fetchProc.running) return
    fetchProc.stdinEnabled = true
    fetchProc.command = ["curl", "-fsSL", "--max-time", "20", "-K", "-"]
    fetchProc.running = true
  }

  function applySnapshot(raw) {
    try {
      var next = Api.parseSnapshot(raw)
      if (next.timetable.length === 0 && root.snapshot.timetable.length > 0) {
        root.setError("Refresh returned no timetable · cached data kept")
        return
      }
      var previousIds = Cache.notificationIds(root.snapshot.notifications)
      root.snapshot = next
      root.lastRefreshAt = Date.now()
      root.stale = false
      root.errorMessage = ""
      root.loading = false
      next.notifications.forEach(function(row) {
        var id = String(row.id || "")
        if (id && previousIds[id] === true) return
        if (id && Object.keys(previousIds).length > 0)
          Quickshell.execDetached(["notify-send", "-a", "Bunkialo", String(row.title || "Bunkialo"), String(row.body || "")])
      })
      root.persistSnapshot(next)
      root.dataChanged()
    } catch (error) {
      root.setError("Bunkialo returned an invalid snapshot")
    }
  }

  function notifyClass(title, body, key) {
    if (root.classAlertKeys[key] === true) return
    var next = Object.assign({}, root.classAlertKeys)
    next[key] = true
    root.classAlertKeys = next
    Quickshell.execDetached(["notify-send", "-a", "Bunkialo", title, body])
    root.persistSnapshot({
      generatedAt: root.lastRefreshAt,
      timetable: root.snapshot.timetable,
      notifications: root.snapshot.notifications,
      alertKeys: Object.keys(next)
    })
  }

  function persistSnapshot(data) {
    var serialized = Cache.serialize(Object.assign({}, data, {
      notificationSeenAt: root.notificationSeenAt
    }))
    cacheFile.setText(serialized)
    lastGoodCacheFile.setText(serialized)
  }

  function checkClassAlerts() {
    if (!root.paired || root.snapshot.timetable.length === 0) return
    var current = Api.currentAndNext(root.snapshot.timetable, root.now)
    if (current.currentClass) {
      var started = current.currentClass.id + ":" + root.now.toDateString() + ":start"
      root.notifyClass("Class started", current.currentClass.courseName, started)
    }
    var upcoming = Api.upcomingSlots(root.snapshot.timetable, root.now)
    upcoming.forEach(function(item) {
      var minutesUntil = (item.start.getTime() - root.now.getTime()) / 60000
      if (minutesUntil >= 0 && minutesUntil <= root.leadMinutes) {
        var key = item.slot.id + ":" + item.start.toDateString() + ":lead"
        root.notifyClass("Class in " + Math.ceil(minutesUntil) + " minutes",
          item.slot.courseName + " · " + Api.formatTime(item.slot.startTime), key)
      }
    })
  }

  IpcHandler {
    target: "noel.bunkialo"

    function toggleExpanded(): string {
      return root.toggleExpanded()
    }

    function showWifix(): string {
      root.wifixMode = true
      root.detectWifix(false)
      root.dataChanged()
      return "wifix"
    }
  }

  FileView {
    id: cacheFile
    path: root.cachePath
    printErrors: false
    onLoaded: root.readCache(text(), "primary")
    onLoadFailed: root.loading = false
  }

  FileView {
    id: lastGoodCacheFile
    path: root.lastGoodCachePath
    printErrors: false
    onLoaded: root.readCache(text(), "last-good")
  }

  FileView {
    id: settingsFile
    path: root.settingsPath
    printErrors: false
    onLoaded: root.readSettings(text())
  }

  FileView {
    id: messFile
    path: Qt.resolvedUrl("data/mess-menu.json")
    printErrors: false
    onLoaded: root.messMenu = Api.parseMess(text())
  }

  Process {
    id: mkdirProc
    command: ["mkdir", "-p", root.cacheDir]
    onExited: function(exitCode) {
      if (exitCode === 0) root.saveSettingsFile()
    }
  }

  Process {
    id: cacheDirProc
    command: ["mkdir", "-p", root.cacheDir]
    onExited: function(exitCode) {
      if (exitCode === 0) root.startFetch()
      else root.setError("Could not create the Bunkialo cache directory")
    }
  }

  Process {
    id: tokenProc
    command: ["secret-tool", "lookup", "service", root.secretService, "account", root.secretAccount]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var saved = String(text || "").trim()
        try {
          Api.parsePairingCode(saved)
          root.token = saved
        } catch (error) {
          root.token = ""
          if (saved !== "") clearTokenProc.running = true
        }
        cacheFile.reload()
        settingsFile.reload()
        messFile.reload()
        if (root.token !== "") root.refresh()
      }
    }
  }

  Process {
    id: storeTokenProc
    command: ["secret-tool", "store", "--label", "Bunkialo credentials JSON", "service", root.secretService, "account", root.secretAccount]
    onStarted: {
      storeTokenProc.write(root.token + "\n")
      storeTokenProc.stdinEnabled = false
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) root.setError("Could not save the token to Secret Service")
      else root.refresh()
    }
  }

  Process {
    id: clearTokenProc
    command: ["secret-tool", "clear", "service", root.secretService, "account", root.secretAccount]
  }

  Process {
    id: fetchProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applySnapshot(text)
    }
    onStarted: {
      fetchProc.write("url = \"" + root.apiOrigin + "/api/desktop/snapshot\"\n"
        + "header = \"Authorization: Pairing " + root.token + "\"\n")
      fetchProc.stdinEnabled = false
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) root.setError("Refresh failed · cached data kept")
    }
  }

  Timer {
    interval: 30 * 1000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: {
      root.now = new Date()
      root.checkClassAlerts()
      root.dataChanged()
    }
  }

  Component.onCompleted: Qt.callLater(function() {
    root.loadToken()
  })
}
