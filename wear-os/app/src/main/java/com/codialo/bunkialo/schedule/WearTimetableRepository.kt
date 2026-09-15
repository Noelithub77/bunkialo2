package com.codialo.bunkialo.schedule

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

enum class WearTimetableSource {
    TEMPLATE,
    ACCOUNT,
    MANUAL,
}

data class WearTimetableData(
    val source: WearTimetableSource,
    val timetable: Map<TimetableDay, List<TimetableEvent>>,
)

class WearTimetableRepository(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun load(): WearTimetableData {
        val payload = preferences.getString(PAYLOAD_KEY, null) ?: return templateData()
        return parsePayload(payload) ?: templateData()
    }

    fun savePayload(payload: String): WearTimetableData {
        val parsed = parsePayload(payload) ?: return load()
        preferences.edit().putString(PAYLOAD_KEY, payload).apply()
        return parsed
    }

    fun resetToTemplate(): WearTimetableData {
        preferences.edit().remove(PAYLOAD_KEY).apply()
        return templateData()
    }

    private fun parsePayload(payload: String): WearTimetableData? {
        return try {
            val root = JSONObject(payload)
            if (root.optInt("version") != 1) return null
            val source = when (root.optString("source")) {
                "account" -> WearTimetableSource.ACCOUNT
                "manual" -> WearTimetableSource.MANUAL
                "template" -> return templateData()
                else -> return null
            }
            val slots = root.optJSONArray("slots") ?: return null
            val timetable = parseSlots(slots)
            if (timetable.values.all(List<TimetableEvent>::isEmpty)) return null
            WearTimetableData(source, timetable)
        } catch (_: Exception) {
            null
        }
    }

    private fun parseSlots(slots: JSONArray): Map<TimetableDay, List<TimetableEvent>> {
        val byDay = TimetableDay.entries.associateWith { mutableListOf<TimetableEvent>() }
        for (index in 0 until slots.length()) {
            val slot = slots.optJSONObject(index) ?: continue
            val day = TimetableDay.entries.firstOrNull {
                it.dayOfWeek.value == slot.optInt("dayOfWeek", -1)
            } ?: continue
            val startMinutes = parseMinutes(slot.optString("startTime"))
            val endMinutes = parseMinutes(slot.optString("endTime"))
            if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) continue
            val courseName = slot.optString("courseName").ifBlank { "Class" }
            val courseId = slot.optString("courseId").ifBlank { courseName }
            byDay.getValue(day).add(
                TimetableEvent(
                    course = TimetableCourse(
                        id = courseId,
                        label = courseName,
                        faculty = "",
                        pastel = pastelFor(courseId),
                    ),
                    startMinutes = startMinutes,
                    endMinutes = endMinutes,
                    isLab = slot.optString("sessionType") == "lab",
                ),
            )
        }
        return byDay.mapValues { (_, events) ->
            events.sortedWith(compareBy(TimetableEvent::startMinutes, TimetableEvent::endMinutes))
        }
    }

    private fun parseMinutes(value: String): Int? {
        val parts = value.split(":")
        if (parts.size != 2) return null
        val hour = parts[0].toIntOrNull() ?: return null
        val minute = parts[1].toIntOrNull() ?: return null
        if (hour !in 0..23 || minute !in 0..59) return null
        return hour * 60 + minute
    }

    private fun pastelFor(courseId: String): Pastel =
        Pastel.entries[kotlin.math.abs(courseId.hashCode()) % Pastel.entries.size]

    private fun templateData() = WearTimetableData(WearTimetableSource.TEMPLATE, templateTimetable)

    private companion object {
        const val PREFERENCES_NAME = "bunkialo-wear-timetable"
        const val PAYLOAD_KEY = "payload"
    }
}
