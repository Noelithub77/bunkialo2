function text(value, fallback) {
  var result = String(value === undefined || value === null ? "" : value).trim()
  return result || (fallback || "")
}

function formatTime(value) {
  var parts = text(value, "00:00").split(":")
  var hours = Number(parts[0]) || 0
  var minutes = Number(parts[1]) || 0
  return (hours % 12 || 12) + ":" + String(minutes).padStart(2, "0")
    + (hours >= 12 ? " PM" : " AM")
}

function dayName(day) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][Number(day) || 0]
}

function dayShortName(day) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][Number(day) || 0]
}

function courseColor(courseId) {
  var colors = ["#F87171", "#FB923C", "#FBBF24", "#34D399", "#22D3EE", "#60A5FA", "#A78BFA", "#F472B6"]
  var value = String(courseId || "")
  var hash = 0
  for (var index = 0; index < value.length; index += 1)
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  return colors[hash % colors.length]
}

function mealColor(type) {
  return ({ breakfast: "#62df15", lunch: "#1be7a3", snacks: "#b16d07", dinner: "#6d20b0" })[String(type || "")] || "#FFAB00"
}

function minutes(value) {
  var parts = text(value, "00:00").split(":")
  return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0)
}

function slotDate(slot, now) {
  var result = new Date(now.getTime())
  var offset = (Number(slot.dayOfWeek) - now.getDay() + 7) % 7
  result.setDate(result.getDate() + offset)
  var parts = text(slot.startTime, "00:00").split(":")
  result.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0)
  if (result.getTime() < now.getTime() - 60000) result.setDate(result.getDate() + 7)
  return result
}

function sortSlots(slots) {
  return (Array.isArray(slots) ? slots : []).slice().sort(function(left, right) {
    return Number(left.dayOfWeek) - Number(right.dayOfWeek)
      || String(left.startTime).localeCompare(String(right.startTime))
      || String(left.courseName).localeCompare(String(right.courseName))
  })
}

function currentAndNext(slots, now) {
  var ordered = sortSlots(slots)
  var current = null
  var next = null
  var previous = null
  var day = now.getDay()
  var currentMinutes = now.getHours() * 60 + now.getMinutes()
  var today = ordered.filter(function(slot) {
    return Number(slot.dayOfWeek) === day
  })
  current = today.find(function(slot) {
    return currentMinutes >= minutes(slot.startTime) && currentMinutes < minutes(slot.endTime)
  }) || null
  next = today.find(function(slot) {
    return currentMinutes < minutes(slot.startTime)
  }) || null
  for (var offset = 1; !next && offset <= 7; offset += 1) {
    var targetDay = (day + offset) % 7
    next = ordered.find(function(slot) { return Number(slot.dayOfWeek) === targetDay }) || null
  }
  for (var previousOffset = 0; !previous && previousOffset <= 7; previousOffset += 1) {
    var previousDay = (day - previousOffset + 7) % 7
    var candidates = ordered.filter(function(slot) {
      return Number(slot.dayOfWeek) === previousDay
        && (previousOffset > 0 || minutes(slot.endTime) <= currentMinutes)
    })
    if (candidates.length > 0) previous = candidates[candidates.length - 1]
  }
  return { previousClass: previous, currentClass: current, nextClass: next }
}

function upcomingSlots(slots, now) {
  return sortSlots(slots).map(function(slot) {
    return { slot: slot, start: slotDate(slot, now) }
  }).sort(function(left, right) {
    return left.start.getTime() - right.start.getTime()
  })
}

function parseSnapshot(raw) {
  var data = JSON.parse(String(raw || ""))
  if (!data || !Array.isArray(data.timetable) || !Array.isArray(data.notifications))
    throw new Error("Invalid Bunkialo snapshot")
  var cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000
  return {
    generatedAt: Number(data.generatedAt) || Date.now(),
    timetable: data.timetable,
    notifications: data.notifications.filter(function(row) {
      var createdAt = Date.parse(String(row && row.createdAt || ""))
      return isFinite(createdAt) && createdAt >= cutoff
    })
  }
}

function parseMess(raw) {
  var data = JSON.parse(String(raw || ""))
  return Array.isArray(data) ? data : []
}

function formatUpdated(timestamp, now) {
  if (!timestamp) return "Not refreshed"
  var diff = Math.max(0, (now.getTime() - timestamp) / 60000)
  if (diff < 1) return "Just now"
  if (diff < 60) return Math.floor(diff) + "m ago"
  if (diff < 1440) return Math.floor(diff / 60) + "h ago"
  return Math.floor(diff / 1440) + "d ago"
}

function mealForDay(menu, day) {
  return (Array.isArray(menu) ? menu : []).find(function(item) {
    return Number(item.day) === Number(day)
  }) || { day: day, meals: [] }
}

function currentAndNextMeal(menu, now) {
  var today = mealForDay(menu, now.getDay())
  var currentMinutes = now.getHours() * 60 + now.getMinutes()
  var current = today.meals.find(function(meal) {
    return currentMinutes >= minutes(meal.startTime) && currentMinutes < minutes(meal.endTime)
  }) || null
  var next = today.meals.find(function(meal) {
    return currentMinutes < minutes(meal.startTime)
  }) || null
  for (var offset = 1; !next && offset <= 7; offset += 1)
    next = mealForDay(menu, (now.getDay() + offset) % 7).meals[0] || null
  return { current: current, next: next }
}

function mealWindow(menu, now) {
  var entries = []
  for (var offset = -7; offset <= 7; offset += 1) {
    var day = (now.getDay() + offset + 7) % 7
    var dayMenu = mealForDay(menu, day)
    dayMenu.meals.forEach(function(meal) {
      var start = new Date(now.getTime())
      var startParts = text(meal.startTime, "00:00").split(":")
      start.setDate(now.getDate() + offset)
      start.setHours(Number(startParts[0]) || 0, Number(startParts[1]) || 0, 0, 0)
      var end = new Date(now.getTime())
      var endParts = text(meal.endTime, "00:00").split(":")
      end.setDate(now.getDate() + offset)
      end.setHours(Number(endParts[0]) || 0, Number(endParts[1]) || 0, 0, 0)
      entries.push({ meal: meal, start: start, end: end })
    })
  }
  entries.sort(function(left, right) { return left.start.getTime() - right.start.getTime() })
  var activeIndex = -1
  for (var index = 0; index < entries.length; index += 1) {
    if (now >= entries[index].start && now < entries[index].end) {
      activeIndex = index
      break
    }
  }
  var centerIndex = activeIndex
  if (centerIndex < 0) {
    for (var nextIndex = 0; nextIndex < entries.length; nextIndex += 1) {
      if (entries[nextIndex].start >= now) {
        centerIndex = nextIndex
        break
      }
    }
  }
  if (centerIndex < 0 && entries.length > 0) centerIndex = entries.length - 1
  return {
    previous: centerIndex > 0 ? entries[centerIndex - 1].meal : null,
    center: centerIndex >= 0 ? entries[centerIndex].meal : null,
    next: centerIndex >= 0 && centerIndex + 1 < entries.length ? entries[centerIndex + 1].meal : null,
    centerIsCurrent: activeIndex >= 0 && activeIndex === centerIndex
  }
}

function groupByDay(slots) {
  var groups = []
  for (var day = 0; day < 7; day += 1) {
    groups.push({ day: day, name: dayName(day), shortName: dayShortName(day), slots: sortSlots(slots).filter(function(slot) {
      return Number(slot.dayOfWeek) === day
    }) })
  }
  return groups
}
