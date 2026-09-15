package com.codialo.bunkialo.presentation

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.LocalOnBackPressedDispatcherOwner
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.painterResource
import androidx.wear.remote.interactions.RemoteActivityHelper
import androidx.wear.compose.foundation.lazy.TransformingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberTransformingLazyColumnState
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.CardDefaults
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.Text
import com.codialo.bunkialo.presentation.theme.BunkialoTheme
import com.codialo.bunkialo.R
import com.codialo.bunkialo.schedule.Pastel
import com.codialo.bunkialo.schedule.TimetableDay
import com.codialo.bunkialo.schedule.TimetableEvent
import com.codialo.bunkialo.schedule.WearTimetableData
import com.codialo.bunkialo.schedule.WearTimetableRepository
import com.codialo.bunkialo.schedule.WearTimetableSource
import com.codialo.bunkialo.schedule.breakLabelBetween
import com.codialo.bunkialo.schedule.events
import com.codialo.bunkialo.schedule.focusDay
import java.time.LocalDateTime
import kotlinx.coroutines.delay
import androidx.compose.ui.text.style.TextAlign
import java.util.concurrent.Executors

private val remoteActivityExecutor = Executors.newSingleThreadExecutor()

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { TimetableApp() }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_STEM_1 || keyCode == KeyEvent.KEYCODE_STEM_2) {
            moveTaskToBack(true)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}

@Composable
fun TimetableApp() {
    BunkialoTheme {
        val backDispatcher = LocalOnBackPressedDispatcherOwner.current?.onBackPressedDispatcher
        AppScaffold {
            val now = remember { mutableStateOf(LocalDateTime.now()) }
            val context = LocalContext.current
            val repository = remember { WearTimetableRepository(context) }
            val timetable = remember { mutableStateOf(repository.load()) }
            val initialDay = remember {
                TimetableDay.entries.indexOf(focusDay(now.value, timetable.value.timetable))
            }
            LaunchedEffect(Unit) {
                while (true) {
                    now.value = LocalDateTime.now()
                    timetable.value = repository.load()
                    delay(30_000)
                }
            }
            val middlePage = Int.MAX_VALUE / 2
            val firstPage = middlePage - (middlePage % TimetableDay.entries.size) + initialDay
            val pagerState = rememberPagerState(
                initialPage = firstPage,
                pageCount = { Int.MAX_VALUE },
            )
            Box(modifier = Modifier.fillMaxSize()) {
                HorizontalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxSize(),
                ) { page ->
                    DaySchedule(
                        day = TimetableDay.entries[page % TimetableDay.entries.size],
                        now = now.value,
                        timetable = timetable.value,
                        onReset = {
                            timetable.value = repository.resetToTemplate()
                        },
                    )
                }
                Box(
                    modifier = Modifier
                        .align(Alignment.CenterStart)
                        .fillMaxHeight()
                        .width(36.dp)
                        .edgeBackGesture {
                            backDispatcher?.onBackPressed()
                        },
                )
            }
        }
    }
}

private fun Modifier.edgeBackGesture(
    onBack: () -> Unit,
): Modifier = pointerInput(onBack) {
    val triggerDistance = 48.dp.toPx()

    awaitPointerEventScope {
        var tracking = false
        var startX = 0f
        var triggered = false

        while (true) {
            val event = awaitPointerEvent(PointerEventPass.Initial)
            val change = event.changes.firstOrNull() ?: break

            if (change.pressed && !change.previousPressed) {
                tracking = true
                startX = change.position.x
                triggered = false
            }

            if (tracking) {
                change.consume()
                if (!triggered && change.position.x - startX >= triggerDistance) {
                    triggered = true
                    onBack()
                }
            }

            if (!change.pressed && change.previousPressed) {
                tracking = false
            }
        }
    }
}

private fun openTimetableEditorOnPhone(context: Context) {
    val intent = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("bunkialo://timetable?wear=1"),
    ).addCategory(Intent.CATEGORY_BROWSABLE)

    RemoteActivityHelper(context, remoteActivityExecutor)
        .startRemoteActivity(intent, null)
}

@Composable
private fun DaySchedule(
    day: TimetableDay,
    now: LocalDateTime,
    timetable: WearTimetableData,
    onReset: () -> Unit,
) {
    val listState = rememberTransformingLazyColumnState()
    val context = LocalContext.current
    val events = day.events(timetable.timetable)
    val isToday = day.dayOfWeek == now.dayOfWeek
    val isNextDay = day == nextTimetableDay(now)
    val currentEventIndex = events.indexOfFirst { it.isHappeningAt(now) }
    val nextEventIndex = events.indexOfFirst {
        it.startMinutes > now.hour * 60 + now.minute
    }
    val focusedEventIndex = if (!isToday) 0 else {
        if (currentEventIndex >= 0) currentEventIndex else nextEventIndex
    }
    val breaksBeforeFocusedEvent = if (focusedEventIndex > 0) {
        (0 until focusedEventIndex).count { index ->
            breakLabelBetween(events[index], events[index + 1]) != null
        }
    } else {
        0
    }
    val centerOffset = with(androidx.compose.ui.platform.LocalDensity.current) {
        -8.dp.roundToPx()
    }

    LaunchedEffect(day, focusedEventIndex) {
        if (focusedEventIndex >= 0) {
            listState.scrollToItem(focusedEventIndex + breaksBeforeFocusedEvent + 1, centerOffset)
        }
    }

    ScreenScaffold(scrollState = listState) { contentPadding ->
        TransformingLazyColumn(
            state = listState,
            contentPadding = contentPadding,
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            item {
                ListHeader(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = day.shortName,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        if (timetable.source != WearTimetableSource.TEMPLATE) {
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clickable(onClick = onReset),
                                contentAlignment = Alignment.Center,
                            ) {
                                androidx.wear.compose.material3.Icon(
                                    painter = painterResource(R.drawable.ic_reset_24),
                                    contentDescription = "Reset timetable to template",
                                    tint = Color(0xFF8A8A8A),
                                    modifier = Modifier.size(12.dp),
                                )
                            }
                        }
                    }
                }
            }
            events.forEachIndexed { index, event ->
                if (index > 0) {
                    breakLabelBetween(events[index - 1], event)?.let { label ->
                        item {
                            BreakLabel(label)
                        }
                    }
                }
                item {
                    TimetableCard(
                        event = event,
                        highlight = when {
                            isToday && index == currentEventIndex -> EventHighlight.NOW
                            (!isToday && isNextDay) && index == focusedEventIndex -> EventHighlight.NEXT
                            isToday && index == focusedEventIndex -> EventHighlight.NEXT
                            else -> EventHighlight.NONE
                        },
                    )
                }
            }
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 2.dp, end = 8.dp),
                    contentAlignment = Alignment.CenterEnd,
                ) {
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .clickable { openTimetableEditorOnPhone(context) },
                        contentAlignment = Alignment.Center,
                    ) {
                        androidx.wear.compose.material3.Icon(
                            painter = painterResource(R.drawable.ic_edit_24),
                            contentDescription = "Edit timetable on phone",
                            tint = Color(0xFF8A8A8A),
                            modifier = Modifier.size(12.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BreakLabel(label: String) {
    Text(
        text = label,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 1.dp),
        color = Color(0xFF8A8A8A),
        textAlign = TextAlign.Center,
        style = MaterialTheme.typography.labelSmall,
    )
}

private fun nextTimetableDay(now: LocalDateTime): TimetableDay {
    val todayIndex = TimetableDay.entries.indexOfFirst { it.dayOfWeek == now.dayOfWeek }
    if (todayIndex == -1) {
        return TimetableDay.MONDAY
    }
    return TimetableDay.entries[(todayIndex + 1) % TimetableDay.entries.size]
}

private enum class EventHighlight {
    NOW,
    NEXT,
    NONE,
}

@Composable
private fun TimetableCard(event: TimetableEvent, highlight: EventHighlight) {
    val colors = pastelColors(event.course.pastel)
    val highlightBorder = when (highlight) {
        EventHighlight.NOW -> Color(0xFF83C98D)
        EventHighlight.NEXT -> Color(0xFFB49AEF)
        EventHighlight.NONE -> null
    }
    Card(
        onClick = {},
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = colors.background,
            contentColor = colors.content,
            titleColor = colors.content,
            subtitleColor = colors.content,
            timeColor = colors.content,
        ),
        border = highlightBorder?.let { BorderStroke(2.dp, it) },
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .width(5.dp)
                        .height(42.dp)
                        .background(colors.accent, RoundedCornerShape(50)),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = event.course.label,
                        color = Color.Black,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleLarge,
                    )
                    Text(
                        text = event.course.faculty,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 2,
                    )
                    Text(
                        text = event.time,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            }
            if (event.isLab) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 7.dp, end = 8.dp)
                        .size(23.dp)
                        .border(2.dp, Color.Black, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "L",
                        color = Color.Black,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
        }
    }
}

private data class PastelColors(
    val background: Color,
    val content: Color,
    val accent: Color,
)

private const val CARD_ALPHA = 0.88f

private fun pastelColor(color: Color): Color = color.copy(alpha = CARD_ALPHA)

private fun pastelColors(pastel: Pastel): PastelColors = when (pastel) {
    Pastel.ROSE -> PastelColors(pastelColor(Color(0xFFF6CDD5)), Color.Black, Color(0xFF9B4F65))
    Pastel.LAVENDER -> PastelColors(pastelColor(Color(0xFFE1D4FA)), Color.Black, Color(0xFF68439E))
    Pastel.MINT -> PastelColors(pastelColor(Color(0xFFD3EDD9)), Color.Black, Color(0xFF367653))
    Pastel.BLUE -> PastelColors(pastelColor(Color(0xFFD0E8F7)), Color.Black, Color(0xFF326B92))
    Pastel.PEACH -> PastelColors(pastelColor(Color(0xFFF8D9BF)), Color.Black, Color(0xFFA65A28))
    Pastel.YELLOW -> PastelColors(pastelColor(Color(0xFFF7E7AD)), Color.Black, Color(0xFF866B13))
    Pastel.LILAC -> PastelColors(pastelColor(Color(0xFFE6D4F4)), Color.Black, Color(0xFF7B469C))
    Pastel.AQUA -> PastelColors(pastelColor(Color(0xFFCDEBE4)), Color.Black, Color(0xFF2D7165))
}
