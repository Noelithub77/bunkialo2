package com.codialo.bunkialo.tile

import android.content.ComponentName
import android.content.Context
import androidx.wear.protolayout.ActionBuilders.launchAction
import androidx.wear.protolayout.ResourceBuilders.Resources
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.material3.Typography.BODY_LARGE
import androidx.wear.protolayout.material3.materialScope
import androidx.wear.protolayout.material3.primaryLayout
import androidx.wear.protolayout.material3.text
import androidx.wear.protolayout.modifiers.clickable
import androidx.wear.protolayout.types.layoutString
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.RequestBuilders.ResourcesRequest
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import androidx.wear.tiles.tooling.preview.Preview
import androidx.wear.tiles.tooling.preview.TilePreviewData
import androidx.wear.tooling.preview.devices.WearDevices
import com.codialo.bunkialo.presentation.MainActivity
import com.codialo.bunkialo.schedule.currentOrNextEvent
import com.codialo.bunkialo.schedule.WearTimetableRepository
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import java.time.LocalDateTime

private const val RESOURCES_VERSION = "1"
private const val FRESHNESS_INTERVAL_MILLIS = 60_000L

class MainTileService : TileService() {
    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest,
    ): ListenableFuture<TileBuilders.Tile> = Futures.immediateFuture(tile(requestParams, this))

    override fun onTileResourcesRequest(
        requestParams: ResourcesRequest,
    ): ListenableFuture<Resources> = Futures.immediateFuture(resources(requestParams))
}

private fun resources(@Suppress("UNUSED_PARAMETER") requestParams: ResourcesRequest): Resources = Resources.Builder()
    .setVersion(RESOURCES_VERSION)
    .build()

private fun tile(
    requestParams: RequestBuilders.TileRequest,
    context: Context,
): TileBuilders.Tile {
    val timetable = WearTimetableRepository(context).load().timetable
    val scheduledEvent = currentOrNextEvent(LocalDateTime.now(), timetable)
    val tileText = scheduledEvent?.let { scheduled ->
        val labSuffix = if (scheduled.event.isLab) "  L" else ""
        "${scheduled.event.title}$labSuffix  ${scheduled.event.time}"
    } ?: "—"

    return TileBuilders.Tile.Builder()
        .setResourcesVersion(RESOURCES_VERSION)
        .setFreshnessIntervalMillis(FRESHNESS_INTERVAL_MILLIS)
        .setTileTimeline(
            TimelineBuilders.Timeline.fromLayoutElement(
                materialScope(context, requestParams.deviceConfiguration) {
                    primaryLayout(
                        mainSlot = {
                            text(tileText.layoutString, typography = BODY_LARGE)
                        },
                        onClick = clickable(
                            action = launchAction(
                                ComponentName(context, MainActivity::class.java),
                            ),
                        ),
                    )
                },
            ),
        )
        .build()
}

@Preview(device = WearDevices.SMALL_ROUND)
@Preview(device = WearDevices.LARGE_ROUND)
fun tilePreview(context: Context) = TilePreviewData(::resources) {
    tile(it, context)
}
