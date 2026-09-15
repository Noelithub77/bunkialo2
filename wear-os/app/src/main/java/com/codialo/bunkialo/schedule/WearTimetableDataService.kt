package com.codialo.bunkialo.schedule

import android.content.ComponentName
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import com.codialo.bunkialo.complication.CourseComplicationService
import com.codialo.bunkialo.tile.MainTileService
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

private const val TIMETABLE_PATH = "/bunkialo/timetable"

class WearTimetableDataService : WearableListenerService() {
    override fun onDataChanged(dataEvents: DataEventBuffer) {
        dataEvents.use { events ->
            events.forEach { event ->
                if (event.type != DataEvent.TYPE_CHANGED) return@forEach
                if (event.dataItem.uri.path != TIMETABLE_PATH) return@forEach
                val payload = DataMapItem.fromDataItem(event.dataItem).dataMap
                    .getString("payload") ?: return@forEach
                WearTimetableRepository(this).savePayload(payload)
            }
        }

        TileService.getUpdater(this).requestUpdate(MainTileService::class.java)
        ComplicationDataSourceUpdateRequester.create(
            this,
            ComponentName(this, CourseComplicationService::class.java),
        ).requestUpdateAll()
    }
}
