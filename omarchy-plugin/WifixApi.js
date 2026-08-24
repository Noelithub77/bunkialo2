var AUTH_HOST = "auth.iiitkottayam.ac.in"
var LOGIN_URL = "https://auth.iiitkottayam.ac.in:1442/fgtauth?06654743c24164e4"
var BASE_URL = "https://auth.iiitkottayam.ac.in:1442"
var LOGOUT_URL = BASE_URL + "/logout?0307020009020400"

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
  }
  return ""
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
