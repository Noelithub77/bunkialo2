function parse(raw) {
  var text = String(raw || "").trim()
  if (!text) return null
  try {
    var value = JSON.parse(text)
    if (!value || !Array.isArray(value.timetable) || !Array.isArray(value.notifications)) return null
    return value
  } catch (error) {
    return null
  }
}

function serialize(data) {
  return JSON.stringify({
    generatedAt: Number(data.generatedAt) || Date.now(),
    timetable: Array.isArray(data.timetable) ? data.timetable : [],
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    alertKeys: Array.isArray(data.alertKeys) ? data.alertKeys : [],
    notificationSeenAt: Number(data.notificationSeenAt) || 0
  }, null, 2)
}

function notificationIds(rows) {
  var ids = {}
  ;(Array.isArray(rows) ? rows : []).forEach(function(row) {
    if (row && row.id !== undefined) ids[String(row.id)] = true
  })
  return ids
}
