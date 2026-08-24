import QtQuick
import Quickshell
import Quickshell.Io
import "WifixApi.js" as Wifix

Item {
  id: root

  property string cacheDir: ""
  property string pairingCode: ""
  readonly property string cachePath: root.cacheDir + "/wifix-ssid-cache.json"
  readonly property string cookiePath: root.cacheDir + "/wifix.cookies"

  property string currentSsid: ""
  property var wifixSsidCache: ({})
  property bool wifixChecking: false
  property bool wifixDetectionForced: false
  property bool wifixAvailable: false
  property bool wifixConnected: false
  property string wifixMessage: ""
  property var portalCredentials: null

  signal changed()

  function readWifixCache(raw) {
    try {
      var parsed = JSON.parse(String(raw || ""))
      root.wifixSsidCache = parsed && typeof parsed === "object" ? parsed : ({})
    } catch (error) {
      root.wifixSsidCache = ({})
    }
  }

  function saveWifixCache() {
    wifixCacheFile.setText(JSON.stringify(root.wifixSsidCache, null, 2) + "\n")
  }

  function applyAvailability(ssid, resolves) {
    root.currentSsid = String(ssid || "")
    root.wifixAvailable = resolves === true
    root.wifixChecking = false
    root.wifixMessage = root.wifixAvailable
      ? "Campus portal detected on this WiFi"
      : "Campus portal not detected on this WiFi"
    root.changed()
  }

  function detect(force) {
    if (root.wifixChecking || ssidProc.running || dnsProc.running) return
    root.wifixDetectionForced = force === true
    root.wifixChecking = true
    ssidProc.running = true
  }

  function handleSsid(raw) {
    var ssid = Wifix.activeSsid(raw)
    if (!ssid) {
      root.applyAvailability("", false)
      return
    }
    root.currentSsid = ssid
    var cached = root.wifixSsidCache[ssid]
    if (cached && root.wifixDetectionForced !== true) {
      root.applyAvailability(ssid, cached.resolves === true)
      return
    }
    dnsProc.running = true
  }

  function handleDns(exitCode) {
    var resolves = exitCode === 0
    var next = Object.assign({}, root.wifixSsidCache)
    next[root.currentSsid] = { resolves: resolves, checkedAt: Date.now() }
    root.wifixSsidCache = next
    root.saveWifixCache()
    root.applyAvailability(root.currentSsid, resolves)
  }

  function connect() {
    if (!root.wifixAvailable || !root.pairingCode) {
      root.wifixMessage = root.pairingCode
        ? "Campus portal is not available"
        : "Save the shared JSON in Settings first"
      root.changed()
      return
    }
    if (!root.readLmsCredentials()) return
    root.wifixMessage = "Opening campus portal..."
    portalGetProc.stdinEnabled = true
    portalGetProc.running = true
    root.changed()
  }

  function readLmsCredentials() {
    try {
      var data = JSON.parse(String(root.pairingCode || ""))
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid JSON")
      var keys = Object.keys(data)
      if (keys.length !== 2 || !keys[0] || typeof data[keys[0]] !== "string" || !data[keys[0]])
        throw new Error("Missing LMS credentials")
      root.portalCredentials = { username: keys[0], password: data[keys[0]] }
      return true
    } catch (error) {
      root.wifixMessage = "Paste the two-credential JSON first"
      root.changed()
      return false
    }
  }

  function handlePortalPage(html) {
    postWifixProc.redirect = Wifix.hiddenField(html, "4Tredir")
    postWifixProc.magic = Wifix.hiddenField(html, "magic")
    postWifixProc.stdinEnabled = true
    postWifixProc.running = true
  }

  function handlePortalLogin(exitCode) {
    root.wifixConnected = exitCode === 0
    root.wifixMessage = root.wifixConnected
      ? "Connected to campus WiFi" : "WiFix login failed"
    root.changed()
  }

  function logout() {
    logoutProc.stdinEnabled = true
    logoutProc.running = true
    root.wifixConnected = false
    root.wifixMessage = "Logging out..."
    root.changed()
  }

  FileView {
    id: wifixCacheFile
    path: root.cachePath
    printErrors: false
    onLoaded: root.readWifixCache(text())
  }

  Process {
    id: ssidProc
    command: ["nmcli", "-t", "-f", "active,ssid", "dev", "wifi"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.handleSsid(text)
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) root.applyAvailability("", false)
    }
  }

  Process {
    id: dnsProc
    command: ["getent", "ahosts", Wifix.AUTH_HOST]
    onExited: function(exitCode) { root.handleDns(exitCode) }
  }

  Process {
    id: portalGetProc
    command: ["curl", "-sS", "--max-time", "20", "-K", "-"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.handlePortalPage(text)
    }
    onStarted: {
      portalGetProc.write(Wifix.curlConfig({
        url: Wifix.LOGIN_URL,
        "cookie-jar": root.cookiePath,
        cookie: root.cookiePath
      }))
      portalGetProc.stdinEnabled = false
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) {
        root.wifixMessage = "Could not open campus portal"
        root.changed()
      }
    }
  }

  Process {
    id: postWifixProc
    property string redirect: ""
    property string magic: ""
    command: ["curl", "-sS", "--fail-with-body", "--max-time", "20", "-K", "-"]
    onStarted: {
      postWifixProc.write(Wifix.curlConfig({
        url: Wifix.BASE_URL + "/",
        request: "POST",
        header: "Content-Type: application/x-www-form-urlencoded",
        "cookie-jar": root.cookiePath,
        cookie: root.cookiePath,
        data: Wifix.formData(root.portalCredentials, postWifixProc.redirect, postWifixProc.magic)
      }))
      postWifixProc.stdinEnabled = false
    }
    onExited: function(exitCode) { root.handlePortalLogin(exitCode) }
  }

  Process {
    id: logoutProc
    command: ["curl", "-sS", "--max-time", "20", "-K", "-"]
    onStarted: {
      logoutProc.write(Wifix.curlConfig({
        url: Wifix.LOGOUT_URL,
        "cookie-jar": root.cookiePath,
        cookie: root.cookiePath
      }))
      logoutProc.stdinEnabled = false
    }
    onExited: function(exitCode) {
      root.wifixMessage = exitCode === 0 ? "Logged out of campus WiFi" : "WiFix logout failed"
      root.changed()
    }
  }

  Component.onCompleted: Qt.callLater(function() {
    wifixCacheFile.reload()
    root.detect(false)
  })
}
