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
  property string currentInterface: ""
  property string portalAddress: ""
  property string portalAction: ""
  property var portalDnsServers: []
  property int portalDnsIndex: 0
  property string portalDnsServer: ""
  property var wifixSsidCache: ({})
  property bool wifixChecking: false
  property bool wifixDetectionForced: false
  property bool wifixAvailable: false
  property bool wifixConnected: false
  property string wifixMessage: ""
  property var portalCredentials: null
  property bool detectionTimedOut: false
  property string ssidError: ""

  function processError(raw) {
    var message = String(raw || "").trim().replace(/\s+/g, " ")
    if (message === "") return "none"
    return message.length > 320 ? message.slice(0, 320) + "..." : message
  }

  function portalCurlConfig(entries) {
    var config = Object.assign({}, entries)
    if (root.portalAddress !== "") {
      config.resolve = Wifix.PORTAL_HOST + ":1442:" + root.portalAddress
    }
    return Wifix.curlConfig(config)
  }

  signal changed()

  function readWifixCache(raw) {
    try {
      var parsed = JSON.parse(String(raw || ""))
      root.wifixSsidCache = parsed && typeof parsed === "object" ? parsed : ({})
      console.log("[WiFix] SSID cache loaded: " + Object.keys(root.wifixSsidCache).length + " entries")
    } catch (error) {
      root.wifixSsidCache = ({})
      console.log("[WiFix] SSID cache could not be parsed; starting empty")
    }
  }

  function saveWifixCache() {
    wifixCacheFile.setText(JSON.stringify(root.wifixSsidCache, null, 2) + "\n")
  }

  function applyAvailability(ssid, resolves) {
    root.currentSsid = String(ssid || "")
    root.wifixAvailable = resolves === true
    root.wifixConnected = false
    root.wifixChecking = false
    root.wifixMessage = root.wifixAvailable
      ? "Campus portal detected on this WiFi"
      : "Campus portal not detected on this WiFi"
    console.log("[WiFix] availability: ssid=" + root.currentSsid + " resolves=" + resolves)
    root.changed()
  }

  function applyCachedState(ssid, cached, validate) {
    var campus = Wifix.isCampusSsid(ssid)
    var resolves = cached && cached.resolves === true
    root.currentSsid = String(ssid || "")
    root.wifixAvailable = campus || resolves
    root.wifixConnected = Wifix.cachedOnline(cached)
    root.wifixChecking = validate === true
    root.wifixMessage = root.wifixChecking ? "Checking campus portal..." : root.wifixConnected
      ? "Internet connected · no captive portal"
      : root.wifixAvailable ? "Campus portal detected on this WiFi" : "Campus portal not detected on this WiFi"
    console.log("[WiFix] cache hit: ssid=" + root.currentSsid
      + " campus=" + campus + " resolves=" + resolves + " online=" + root.wifixConnected
      + " validate=" + (validate === true))
    root.changed()
    if (validate === true) root.checkInternet()
  }

  function finishDetection() {
    detectionTimeout.stop()
    root.detectionTimedOut = false
  }

  function detect(force) {
    if (root.wifixChecking || ssidProc.running || connectivityProc.running) return
    root.wifixDetectionForced = force === true
    root.detectionTimedOut = false
    root.wifixChecking = true
    root.wifixConnected = false
    root.wifixMessage = "Checking campus portal..."
    console.log("[WiFix] detection started: forced=" + root.wifixDetectionForced)
    detectionTimeout.restart()
    root.changed()
    ssidProc.running = true
  }

  function handleSsid(raw) {
    if (root.detectionTimedOut) return
    var ssid = Wifix.activeSsid(raw)
    if (!ssid) {
      console.log("[WiFix] no active WiFi SSID found")
      root.applyAvailability("", false)
      return
    }
    root.currentSsid = ssid
    root.currentInterface = Wifix.activeInterface(raw)
    console.log("[WiFix] active SSID: " + ssid
      + " interface=" + root.currentInterface
      + " campus=" + Wifix.isCampusSsid(ssid))
    if (!Wifix.isCampusSsid(ssid)) {
      console.log("[WiFix] non-campus SSID; WiFix will not inspect or change this network")
      root.applyAvailability(ssid, false)
      return
    }
    var cached = root.wifixSsidCache[ssid]
    if (cached && root.wifixDetectionForced !== true) {
      root.applyCachedState(ssid, cached, true)
      return
    }
    console.log("[WiFix] campus SSID requires a fresh connectivity check")
    root.checkInternet()
  }

  function checkInternet() {
    if (root.detectionTimedOut) return
    root.wifixChecking = true
    if (root.currentInterface === "") {
      console.log("[WiFix] connectivity probe skipped: active WiFi interface is unknown")
      root.handleInternetStatus("000")
      return
    }
    connectivityProc.command = ["curl", "-4", "-sS", "--interface", root.currentInterface,
      "--max-time", "10", "-o", "/dev/null", "-w", "%{http_code}", Wifix.CONNECTIVITY_CHECK_URL]
    console.log("[WiFix] connectivity probe started")
    connectivityProc.running = true
  }

  function handleInternetStatus(raw) {
    if (root.detectionTimedOut) return
    var status = String(raw || "").trim()
    root.wifixConnected = status === "204"
    root.wifixAvailable = true
    if (Wifix.isCampusSsid(root.currentSsid)) {
      var next = Object.assign({}, root.wifixSsidCache)
      next[root.currentSsid] = { resolves: true, online: root.wifixConnected, checkedAt: Date.now() }
      root.wifixSsidCache = next
      root.saveWifixCache()
    }
    root.finishDetection()
    root.wifixChecking = false
    root.wifixMessage = root.wifixConnected
      ? "Internet connected · no captive portal"
      : "Campus portal detected on this WiFi"
    console.log("[WiFix] connectivity probe finished: http=" + status
      + " online=" + root.wifixConnected + " ssid=" + root.currentSsid)
    root.changed()
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
    console.log("[WiFix] login started: credentials parsed, resolving portal on interface="
      + root.currentInterface)
    root.startPortalRequest("login")
    root.changed()
  }

  function startPortalRequest(action) {
    if (portalDnsServersProc.running || portalDnsProc.running || portalGetProc.running || postWifixProc.running || logoutProc.running) return
    if (root.currentInterface === "") {
      root.wifixMessage = "WiFix portal unavailable · no active WiFi interface"
      console.log("[WiFix] portal resolution skipped: active WiFi interface is unknown")
      root.changed()
      return
    }
    root.portalAction = action
    root.portalAddress = ""
    root.portalDnsServers = []
    root.portalDnsIndex = 0
    root.portalDnsServer = ""
    root.wifixChecking = true
    portalDnsServersProc.output = ""
    portalDnsServersProc.command = ["nmcli", "-g", "IP4.DNS", "dev", "show", root.currentInterface]
    console.log("[WiFix] DHCP DNS lookup started: interface=" + root.currentInterface
      + " host=" + Wifix.PORTAL_HOST + " action=" + action)
    portalDnsServersProc.running = true
  }

  function failPortalRequest(reason) {
    var action = root.portalAction
    root.wifixChecking = false
    root.wifixMessage = action === "logout"
      ? "WiFix logout failed · " + reason
      : "WiFix login failed · " + reason
    if (action === "logout") root.wifixConnected = true
    console.log("[WiFix] " + action + " portal request unavailable: " + reason)
    root.changed()
  }

  function handlePortalDnsServers(raw, exitCode) {
    if (exitCode !== 0) {
      root.failPortalRequest("DHCP DNS lookup failed")
      return
    }
    root.portalDnsServers = Wifix.dhcpDnsServers(raw)
    root.portalDnsIndex = 0
    console.log("[WiFix] DHCP DNS servers: count=" + root.portalDnsServers.length)
    root.queryNextPortalDns()
  }

  function queryNextPortalDns() {
    if (root.portalDnsIndex >= root.portalDnsServers.length) {
      root.failPortalRequest("portal DNS unavailable")
      return
    }
    root.portalDnsServer = root.portalDnsServers[root.portalDnsIndex]
    root.portalDnsIndex += 1
    portalDnsProc.output = ""
    portalDnsProc.resolved = false
    portalDnsProc.command = ["dig", "+short", "+time=2", "+tries=1",
      "@" + root.portalDnsServer, Wifix.PORTAL_HOST]
    console.log("[WiFix] portal DNS query started: server=" + root.portalDnsServer
      + " host=" + Wifix.PORTAL_HOST + " interface=" + root.currentInterface)
    portalDnsProc.running = true
  }

  function handlePortalAddress(raw) {
    if (portalDnsProc.resolved) return
    var address = Wifix.resolverAddress(raw)
    if (address === "") {
      root.queryNextPortalDns()
      return
    }
    portalDnsProc.resolved = true
    root.portalAddress = address
    console.log("[WiFix] portal DNS lookup resolved: host=" + Wifix.PORTAL_HOST
      + " address=" + address + " server=" + root.portalDnsServer
      + " interface=" + root.currentInterface)
    if (root.portalAction === "login") {
      portalGetProc.pageHandled = false
      portalGetProc.responseReceived = false
      console.log("[WiFix] login portal GET queued: resolved gateway=" + address)
      portalGetProc.stdinEnabled = true
      portalGetProc.running = true
    } else if (root.portalAction === "logout") {
      console.log("[WiFix] logout portal GET queued: resolved gateway=" + address)
      logoutProc.stdinEnabled = true
      logoutProc.running = true
    }
  }

  function readLmsCredentials() {
    try {
      var data = JSON.parse(String(root.pairingCode || ""))
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid JSON")
      var keys = Object.keys(data)
      if (keys.length !== 2 || !keys[0] || typeof data[keys[0]] !== "string" || !data[keys[0]])
        throw new Error("Missing LMS credentials")
      root.portalCredentials = { username: keys[0], password: data[keys[0]] }
      console.log("[WiFix] credentials JSON accepted for one LMS account")
      return true
    } catch (error) {
      root.wifixMessage = "Paste the two-credential JSON first"
      root.changed()
      return false
    }
  }

  function handlePortalPage(html) {
    var page = String(html || "")
    if (page.trim() === "") {
      console.log("[WiFix] portal HTML was empty; waiting for curl exit status")
      return
    }
    portalGetProc.pageHandled = true
    portalGetProc.responseReceived = true
    postWifixProc.redirect = Wifix.hiddenField(page, "4Tredir")
    postWifixProc.magic = Wifix.hiddenField(page, "magic")
    console.log("[WiFix] portal HTML received: bytes=" + page.length
      + " magic=" + (postWifixProc.magic !== "")
      + " redirect=" + (postWifixProc.redirect !== ""))
    if (postWifixProc.magic === "") {
      root.wifixChecking = false
      root.wifixMessage = "Campus portal detected · login form has no magic number"
      root.changed()
      return
    }
    postWifixProc.stdinEnabled = true
    postWifixProc.running = true
  }

  function handlePortalLogin(exitCode) {
    root.wifixConnected = false
    if (exitCode === 0) {
      root.wifixMessage = "Verifying campus WiFi login..."
      console.log("[WiFix] login POST returned success; verifying with connectivity probe")
      root.checkInternet()
      return
    }
    root.wifixChecking = false
    root.wifixMessage = "WiFix login failed"
    console.log("[WiFix] login POST finished: curl_exit=" + exitCode
      + " success=" + root.wifixConnected)
    root.changed()
  }

  function logout() {
    if (logoutProc.running || portalDnsServersProc.running || portalDnsProc.running) return
    console.log("[WiFix] logout started: portal request only; network interfaces will not be changed")
    root.startPortalRequest("logout")
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
    command: ["nmcli", "-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.handleSsid(text)
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.ssidError = root.processError(text)
    }
    onStarted: root.ssidError = ""
    onExited: function(exitCode) {
      if (exitCode !== 0) {
        console.log("[WiFix] SSID command failed: exit=" + exitCode
          + " stderr=" + root.ssidError)
        root.applyAvailability("", false)
      }
    }
  }

  Process {
    id: connectivityProc
    command: ["curl", "-sS", "--max-time", "10", "-o", "/dev/null", "-w", "%{http_code}", Wifix.CONNECTIVITY_CHECK_URL]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.handleInternetStatus(text)
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: connectivityProc.lastError = root.processError(text)
    }
    property string lastError: ""
    onStarted: connectivityProc.lastError = ""
    onExited: function(exitCode) {
      console.log("[WiFix] connectivity probe finished: curl_exit=" + exitCode
        + " stderr=" + connectivityProc.lastError)
      if (exitCode !== 0) root.handleInternetStatus("000")
    }
  }

  Process {
    id: portalDnsServersProc
    property string output: ""
    property string lastError: ""
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: portalDnsServersProc.output = String(text || "")
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: portalDnsServersProc.lastError = root.processError(text)
    }
    onStarted: {
      portalDnsServersProc.output = ""
      portalDnsServersProc.lastError = ""
    }
    onExited: function(exitCode) {
      console.log("[WiFix] DHCP DNS lookup finished: exit=" + exitCode
        + " servers=" + Wifix.dhcpDnsServers(portalDnsServersProc.output).length
        + " stderr=" + portalDnsServersProc.lastError)
      root.handlePortalDnsServers(portalDnsServersProc.output, exitCode)
    }
  }

  Process {
    id: portalDnsProc
    property bool resolved: false
    property string output: ""
    property string lastError: ""
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: portalDnsProc.output = String(text || "")
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: portalDnsProc.lastError = root.processError(text)
    }
    onStarted: portalDnsProc.lastError = ""
    onExited: function(exitCode) {
      console.log("[WiFix] portal DNS query finished: exit=" + exitCode
        + " resolved=" + portalDnsProc.resolved
        + " server=" + root.portalDnsServer
        + " stderr=" + portalDnsProc.lastError)
      if (!portalDnsProc.resolved) root.handlePortalAddress(portalDnsProc.output)
    }
  }

  Process {
    id: portalGetProc
    property bool pageHandled: false
    property bool responseReceived: false
    property string lastError: ""
    command: ["curl", "-k", "-sS", "--max-time", "20", "-w", "%{stderr}http=%{http_code} remote=%{remote_ip} effective=%{url_effective}\\n", "-K", "-"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.handlePortalPage(text)
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: portalGetProc.lastError = root.processError(text)
    }
    onStarted: {
      portalGetProc.lastError = ""
      console.log("[WiFix] portal GET started: " + Wifix.LOGIN_URL)
      portalGetProc.write(root.portalCurlConfig({
        url: Wifix.LOGIN_URL,
        "cookie-jar": root.cookiePath,
        cookie: root.cookiePath
      }))
      portalGetProc.stdinEnabled = false
    }
    onExited: function(exitCode) {
      console.log("[WiFix] portal GET finished: curl_exit=" + exitCode
        + " response=" + portalGetProc.responseReceived
        + " stderr=" + portalGetProc.lastError)
      if (!portalGetProc.responseReceived) {
        root.wifixChecking = false
        var result = exitCode === 0
          ? "Campus portal detected · login page was empty"
          : "Campus portal detected · login request failed (curl " + exitCode + ")"
        console.log("[WiFix] portal GET failed: curl_exit=" + exitCode)
        root.wifixMessage = result
        root.changed()
      }
    }
  }

  Process {
    id: postWifixProc
    property string redirect: ""
    property string magic: ""
    property string lastError: ""
    command: ["curl", "-k", "-sS", "--fail-with-body", "--max-time", "20", "-w", "%{stderr}http=%{http_code} remote=%{remote_ip} effective=%{url_effective}\\n", "-K", "-"]
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: postWifixProc.lastError = root.processError(text)
    }
    onStarted: {
      postWifixProc.lastError = ""
      console.log("[WiFix] login POST started: magic and credentials form fields filled")
      postWifixProc.write(root.portalCurlConfig({
        url: Wifix.BASE_URL + "/",
        request: "POST",
        header: "Content-Type: application/x-www-form-urlencoded",
        "cookie-jar": root.cookiePath,
        cookie: root.cookiePath,
        data: Wifix.formData(root.portalCredentials, postWifixProc.redirect, postWifixProc.magic)
      }))
      postWifixProc.stdinEnabled = false
    }
    onExited: function(exitCode) {
      console.log("[WiFix] login POST finished: curl_exit=" + exitCode
        + " stderr=" + postWifixProc.lastError)
      root.handlePortalLogin(exitCode)
    }
  }

  Process {
    id: logoutProc
    property string lastError: ""
    command: ["curl", "-k", "-sS", "--max-time", "20", "-w", "%{stderr}http=%{http_code} remote=%{remote_ip} effective=%{url_effective}\\n", "-K", "-"]
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: logoutProc.lastError = root.processError(text)
    }
    onStarted: {
      logoutProc.lastError = ""
      console.log("[WiFix] portal logout GET started: " + Wifix.LOGOUT_URL)
      logoutProc.write(root.portalCurlConfig({
        url: Wifix.LOGOUT_URL,
        "cookie-jar": root.cookiePath,
        cookie: root.cookiePath
      }))
      logoutProc.stdinEnabled = false
    }
    onExited: function(exitCode) {
      console.log("[WiFix] portal logout GET finished: curl_exit=" + exitCode
        + " stderr=" + logoutProc.lastError)
      if (exitCode === 0) {
        root.wifixConnected = false
        root.wifixMessage = "Verifying campus WiFi logout..."
        console.log("[WiFix] portal logout returned success; verifying with connectivity probe")
        root.checkInternet()
      } else {
        root.wifixChecking = false
        root.wifixConnected = true
        root.wifixMessage = "WiFix logout failed · WiFi kept up"
        console.log("[WiFix] portal logout failed: curl_exit=" + exitCode
          + " stderr=" + logoutProc.lastError
          + "; left WiFi and Tailscale untouched")
        root.changed()
      }
    }
  }

  Timer {
    id: detectionTimeout
    interval: 15000
    repeat: false
    onTriggered: {
      if (!root.wifixChecking) return
      root.detectionTimedOut = true
      if (ssidProc.running) ssidProc.running = false
      if (connectivityProc.running) connectivityProc.running = false
      root.wifixChecking = false
      root.wifixAvailable = Wifix.isCampusSsid(root.currentSsid)
      root.wifixConnected = false
      root.wifixMessage = "WiFix check timed out"
      console.log("[WiFix] detection timed out: ssid=" + root.currentSsid)
      root.changed()
    }
  }

  Component.onCompleted: Qt.callLater(function() {
    wifixCacheFile.reload()
    root.detect(false)
  })
}
