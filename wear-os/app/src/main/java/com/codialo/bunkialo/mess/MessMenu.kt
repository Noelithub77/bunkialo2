package com.codialo.bunkialo.mess

import android.content.Context
import com.codialo.bunkialo.R
import com.codialo.bunkialo.schedule.Pastel
import org.json.JSONArray
import java.io.InputStreamReader
import java.time.DayOfWeek
import java.time.LocalDateTime

enum class MealType(
    val label: String,
    val pastel: Pastel,
) {
    BREAKFAST("Breakfast", Pastel.MINT),
    LUNCH("Lunch", Pastel.BLUE),
    SNACKS("Snacks", Pastel.PEACH),
    DINNER("Dinner", Pastel.LILAC),
}

data class Meal(
    val type: MealType,
    val name: String,
    val items: List<String>,
    val startMinutes: Int,
    val endMinutes: Int,
) {
    val time: String
        get() = "${formatTime(startMinutes)}–${formatTime(endMinutes)}"

    fun isHappeningAt(minutes: Int): Boolean =
        minutes in startMinutes until endMinutes

    fun isHappeningAt(now: LocalDateTime): Boolean =
        isHappeningAt(now.hour * 60 + now.minute)
}

data class DayMenu(
    val dayOfWeek: DayOfWeek,
    val meals: List<Meal>,
)

class MessMenuRepository(private val context: Context) {
    private var cachedMenu: Map<DayOfWeek, DayMenu>? = null

    fun loadMenu(): Map<DayOfWeek, DayMenu> {
        cachedMenu?.let { return it }

        val menuMap = mutableMapOf<DayOfWeek, DayMenu>()
        try {
            val inputStream = context.resources.openRawResource(R.raw.mess_menu)
            val jsonString = InputStreamReader(inputStream).use { it.readText() }
            val rootArray = JSONArray(jsonString)

            for (i in 0 until rootArray.length()) {
                val dayObject = rootArray.optJSONObject(i) ?: continue
                val dayInt = dayObject.optInt("day", -1)
                
                // map JS day (0=Sun, 1=Mon...6=Sat) to DayOfWeek
                val dayOfWeek = when (dayInt) {
                    0 -> DayOfWeek.SUNDAY
                    1 -> DayOfWeek.MONDAY
                    2 -> DayOfWeek.TUESDAY
                    3 -> DayOfWeek.WEDNESDAY
                    4 -> DayOfWeek.THURSDAY
                    5 -> DayOfWeek.FRIDAY
                    6 -> DayOfWeek.SATURDAY
                    else -> continue
                }

                val mealsArray = dayObject.optJSONArray("meals") ?: continue
                val mealsList = mutableListOf<Meal>()

                for (j in 0 until mealsArray.length()) {
                    val mealObject = mealsArray.optJSONObject(j) ?: continue
                    val typeStr = mealObject.optString("type")
                    val type = when (typeStr) {
                        "breakfast" -> MealType.BREAKFAST
                        "lunch" -> MealType.LUNCH
                        "snacks" -> MealType.SNACKS
                        "dinner" -> MealType.DINNER
                        else -> continue
                    }

                    val name = mealObject.optString("name")
                    val itemsArray = mealObject.optJSONArray("items")
                    val items = mutableListOf<String>()
                    if (itemsArray != null) {
                        for (k in 0 until itemsArray.length()) {
                            items.add(itemsArray.optString(k))
                        }
                    }

                    val startTime = mealObject.optString("startTime")
                    val endTime = mealObject.optString("endTime")
                    
                    val startMinutes = parseMinutes(startTime) ?: continue
                    val endMinutes = parseMinutes(endTime) ?: continue

                    mealsList.add(
                        Meal(
                            type = type,
                            name = name,
                            items = items,
                            startMinutes = startMinutes,
                            endMinutes = endMinutes,
                        )
                    )
                }

                menuMap[dayOfWeek] = DayMenu(dayOfWeek, mealsList)
            }

            cachedMenu = menuMap
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return menuMap
    }

    private fun parseMinutes(value: String): Int? {
        val parts = value.split(":")
        if (parts.size != 2) return null
        val hour = parts[0].toIntOrNull() ?: return null
        val minute = parts[1].toIntOrNull() ?: return null
        if (hour !in 0..23 || minute !in 0..59) return null
        return hour * 60 + minute
    }
}

private fun formatTime(minutes: Int): String {
    val hour = minutes / 60
    val minute = minutes % 60
    val hour12 = when {
        hour == 0 -> 12
        hour > 12 -> hour - 12
        else -> hour
    }
    return "%d:%02d".format(hour12, minute)
}

fun currentOrNextMeal(
    now: LocalDateTime,
    menu: Map<DayOfWeek, DayMenu>
): Pair<Meal?, Meal?> {
    val todayMenu = menu[now.dayOfWeek] ?: return null to null
    val nowMinutes = now.hour * 60 + now.minute

    var current: Meal? = null
    var next: Meal? = null

    for (meal in todayMenu.meals) {
        if (meal.isHappeningAt(nowMinutes)) {
            current = meal
        } else if (meal.startMinutes > nowMinutes && next == null) {
            next = meal
        }
    }

    if (current == null && next == null) {
        val tomorrow = now.plusDays(1).dayOfWeek
        next = menu[tomorrow]?.meals?.firstOrNull()
    }

    return current to next
}
