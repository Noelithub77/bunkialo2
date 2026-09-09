var CAMPUS_SSIDS = ["IIITKottayam", "IIITKottayam_5G"]
var CONNECTIVITY_CHECK_URL = "http://connectivitycheck.gstatic.com/generate_204"
var PORTAL_HOST = "auth.iiitkottayam.ac.in"
var LOGIN_URL = "https://auth.iiitkottayam.ac.in:1442/login?0330598d1f22608a"
var BASE_URL = "https://auth.iiitkottayam.ac.in:1442"
var LOGOUT_URL = BASE_URL + "/logout?0307020009020400"

function processError(raw) {
  var message = String(raw || "").trim().replace(/\s+/g, " ")
  if (message === "") return "none"
  return message.length > 320 ? message.slice(0, 320) + "..." : message
}

function hiddenField(html, name) {
  var pattern = new RegExp("name=[\\\"']" + name + "[\\\"'][^>]*value=[\\\"']([^\\\"']*)", "i")
  var match = String(html || "").match(pattern)
  if (match && match[1] !== undefined) return match[1]
  var reverse = new RegExp("value=[\\\"']([^\\\"']*)[\\\"'][^>]*name=[\\\"']" + name + "[\\\"']", "i")
  var reverseMatch = String(html || "").match(reverse)
  return reverseMatch && reverseMatch[1] !== undefined ? reverseMatch[1] : ""
}

function activeSsid(raw) {
  var rows = String(raw || "").split("\n")
  for (var index = 0; index < rows.length; index += 1) {
    var row = rows[index]
    if (row.indexOf("yes:") === 0) return row.slice(4).trim()
    var fields = row.split(":")
    if (fields.length >= 4 && fields[1] === "wifi" && fields[2] === "connected") {
      return fields.slice(3).join(":").trim()
    }
    if (fields.length >= 3 && fields[0] === "wifi" && fields[1] === "connected") {
      return fields.slice(2).join(":").trim()
    }
  }
  return ""
}

function activeInterface(raw) {
  var rows = String(raw || "").split("\n")
  for (var index = 0; index < rows.length; index += 1) {
    var fields = rows[index].split(":")
    if (fields.length >= 4 && fields[1] === "wifi" && fields[2] === "connected") {
      return fields[0].trim()
    }
  }
  return ""
}

function resolverAddress(raw) {
  var match = String(raw || "").match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)
  return match && match[0] ? match[0] : ""
}

function dhcpDnsServers(raw) {
  var values = String(raw || "").replace(/\|/g, "\n").split(/\r?\n/)
  var servers = []
  for (var index = 0; index < values.length; index += 1) {
    var value = values[index].trim()
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) continue
    if (servers.indexOf(value) >= 0) continue
    servers.push(value)
  }
  return servers
}

function cachedOnline(entry) {
  if (!entry || typeof entry !== "object") return false
  if (typeof entry.online === "boolean") return entry.online
  return entry.resolves === true
}

function isCampusSsid(ssid) {
  return CAMPUS_SSIDS.indexOf(String(ssid || "").trim()) >= 0
}

function formValue(value) {
  return encodeURIComponent(String(value || ""))
}

function formData(credentials, redirect, magic) {
  var values = []
  if (redirect) values.push("4Tredir=" + formValue(redirect))
  if (magic) values.push("magic=" + formValue(magic))
  values.push("username=" + formValue(credentials.username))
  values.push("password=" + formValue(credentials.password))
  return values.join("&")
}

function configValue(value) {
  return "\"" + String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, "\\\"") + "\""
}

function curlConfig(entries) {
  return Object.keys(entries).map(function(key) {
    return key + " = " + configValue(entries[key])
  }).join("\n") + "\n"
}
