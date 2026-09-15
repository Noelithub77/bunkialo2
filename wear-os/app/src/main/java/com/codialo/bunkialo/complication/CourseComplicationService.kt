package com.codialo.bunkialo.complication

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationText
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.codialo.bunkialo.presentation.MainActivity
import com.codialo.bunkialo.schedule.Course
import com.codialo.bunkialo.schedule.complicationEvent
import com.codialo.bunkialo.schedule.WearTimetableRepository
import java.time.LocalDateTime

class CourseComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(
        request: ComplicationRequest,
    ): ShortTextComplicationData {
        val timetable = WearTimetableRepository(this).load().timetable
        val course = complicationLabel(complicationEvent(LocalDateTime.now(), timetable)?.event?.course)
        val text = PlainComplicationText.Builder(course).build()

        return ShortTextComplicationData.Builder(
            text = text,
            contentDescription = text,
        )
            .setTapAction(openAppIntent())
            .build()
    }

    override fun getPreviewData(type: ComplicationType): ShortTextComplicationData {
        val text = PlainComplicationText.Builder("DSP").build()
        return ShortTextComplicationData.Builder(
            text = text,
            contentDescription = text,
        )
            .setTapAction(openAppIntent())
            .build()
    }

    private fun openAppIntent(): PendingIntent = PendingIntent.getActivity(
        this,
        0,
        Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun complicationLabel(course: com.codialo.bunkialo.schedule.TimetableCourse?): String =
        course?.label.orEmpty()
}
