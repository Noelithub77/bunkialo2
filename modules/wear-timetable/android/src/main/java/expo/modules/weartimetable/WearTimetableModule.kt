package expo.modules.weartimetable

import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

private const val TIMETABLE_PATH = "/bunkialo/timetable"

private class WearDataLayerUnavailableException : CodedException(
  "WEAR_DATA_LAYER_UNAVAILABLE",
  "The Wear OS Data Layer is not available on this Android device.",
  null,
)

private class WearDataLayerSyncException(message: String, cause: Throwable? = null) : CodedException(
  "WEAR_DATA_LAYER_SYNC_FAILED",
  message,
  cause,
)

class WearTimetableModule : Module() {
  private val context
    get() = requireNotNull(appContext.reactContext) {
      "React application context is unavailable"
    }

  override fun definition() = ModuleDefinition {
    Name("WearTimetable")

    AsyncFunction("isAvailable") {
      isDataLayerAvailable()
    }

    AsyncFunction("sendTimetable") { payload: String ->
      sendTimetable(payload)
    }
  }

  private fun dataClient(): DataClient = try {
    Wearable.getDataClient(context)
  } catch (error: Exception) {
    throw WearDataLayerUnavailableException()
  }

  private fun isDataLayerAvailable(): Boolean = try {
    dataClient()
    true
  } catch (_: WearDataLayerUnavailableException) {
    false
  }

  private fun sendTimetable(payload: String) {
    if (!isDataLayerAvailable()) throw WearDataLayerUnavailableException()

    val request = PutDataMapRequest.create(TIMETABLE_PATH).apply {
      dataMap.putString("payload", payload)
      dataMap.putLong("updatedAt", System.currentTimeMillis())
    }.asPutDataRequest().setUrgent()

    try {
      Tasks.await(dataClient().putDataItem(request), 10, TimeUnit.SECONDS)
    } catch (error: Exception) {
      throw WearDataLayerSyncException(
        error.message ?: "The timetable could not be sent to the watch.",
        error,
      )
    }
  }
}
