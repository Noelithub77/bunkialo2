package expo.modules.widgetrefresh

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar
import java.util.TimeZone

class WidgetRefreshModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WidgetRefresh")
    AsyncFunction("setSchedule") { boundaries: List<Int> ->
      val context = appContext.reactContext ?: return@AsyncFunction
      val valid = boundaries.filter { it in 0 until 10080 }.distinct().sorted()
      context.getSharedPreferences("widget-refresh", Context.MODE_PRIVATE)
        .edit().putString("boundaries", valid.joinToString(",")).apply()
      WidgetRefreshReceiver.schedule(context)
    }
  }
}

/** Refresh display-only snapshots at weekly class/meal boundaries without starting React. */
class WidgetRefreshReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val manager = AppWidgetManager.getInstance(context)
    for (name in listOf("BunkialoTimetable", "BunkialoMess")) {
      val provider = ComponentName(context.packageName, "${context.packageName}.${name}Provider")
      val ids = manager.getAppWidgetIds(provider)
      if (ids.isNotEmpty()) {
        context.sendBroadcast(Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
          component = provider
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        })
      }
    }
    schedule(context)
  }

  companion object {
    fun schedule(context: Context) {
      val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val pending = PendingIntent.getBroadcast(context, 581,
        Intent(context, WidgetRefreshReceiver::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val boundaries = context.getSharedPreferences("widget-refresh", Context.MODE_PRIVATE)
        .getString("boundaries", "")!!.split(",").mapNotNull { it.toIntOrNull() }
      if (boundaries.isEmpty()) { manager.cancel(pending); return }
      val now = System.currentTimeMillis()
      val today = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata")).apply {
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
      }
      val day = today.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY
      val next = boundaries.minOf { boundary ->
        val date = today.clone() as Calendar
        date.add(Calendar.DAY_OF_YEAR, (boundary / 1440 - day + 7) % 7)
        date.add(Calendar.MINUTE, boundary % 1440)
        if (date.timeInMillis <= now) date.add(Calendar.DAY_OF_YEAR, 7)
        date.timeInMillis
      }
      // Inexact alarms respect Doze and need no exact-alarm or battery exemption.
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pending)
    }
  }
}
