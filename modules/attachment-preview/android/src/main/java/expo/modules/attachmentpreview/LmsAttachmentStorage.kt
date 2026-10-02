package expo.modules.attachmentpreview

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import java.io.File
import java.util.UUID
import org.json.JSONObject
import kotlin.math.roundToInt

class LmsAttachmentStorage(private val context: Context) {
  private val preferences = context.getSharedPreferences("lms-downloads-v1", Context.MODE_PRIVATE)
  private fun validateKey(key: String) { require(key.matches(Regex("[a-zA-Z0-9_-]{1,100}"))) }
  private fun target(key: String): File {
    validateKey(key)
    return File(File(context.cacheDir, "lms-attachment-previews").apply { mkdirs() }, "$key.jpg")
  }
  private fun descriptor(uri: String): ParcelFileDescriptor {
    val source = Uri.parse(uri)
    require(source.scheme == "file" || source.scheme == "content") { "Local file required" }
    if (source.scheme == "file") {
      val file = File(requireNotNull(source.path)).canonicalFile
      require(file.path.startsWith(context.cacheDir.canonicalPath + "/") ||
        file.path.startsWith(context.filesDir.canonicalPath + "/")) { "App file required" }
      return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    }
    return requireNotNull(context.contentResolver.openFileDescriptor(source, "r"))
  }
  fun cachedPreview(key: String): Map<String, Any>? {
    val file = target(key)
    if (!file.isFile || file.length() == 0L) return null
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, options)
    if (options.outWidth <= 0 || options.outHeight <= 0) { file.delete(); return null }
    return mapOf("uri" to Uri.fromFile(file).toString(), "width" to options.outWidth,
      "height" to options.outHeight, "updatedAt" to file.lastModified().toDouble())
  }
  fun pageCount(uri: String): Int = PdfRenderer(descriptor(uri)).use { it.pageCount }
  fun renderPage(uri: String, key: String, index: Int, requestedWidth: Int): Map<String, Any>? {
    val output = target(key)
    descriptor(uri).use { fd ->
      PdfRenderer(fd).use { renderer ->
        require(index >= 0 && index < renderer.pageCount) { "Invalid PDF page" }
        renderer.openPage(index).use { page ->
          require(page.width > 0 && page.height > 0) { "Invalid PDF page" }
          val width = requestedWidth.coerceIn(128, 1600)
          val scale = minOf(width.toDouble() / page.width, 2400.0 / page.height)
          val bitmap = Bitmap.createBitmap((page.width * scale).roundToInt().coerceAtLeast(1),
            (page.height * scale).roundToInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
          val temporary = File(output.parentFile, "${UUID.randomUUID()}.jpg")
          try {
            bitmap.eraseColor(Color.WHITE)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            temporary.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.JPEG, 88, it)) }
            check(temporary.renameTo(output)) { "Preview cache write failed" }
          } finally { bitmap.recycle(); temporary.delete() }
        }
      }
    }
    return cachedPreview(key)
  }
  fun savedDownload(key: String): Map<String, Any>? {
    validateKey(key)
    val value = preferences.getString(key, null) ?: return null
    return try {
      val json = JSONObject(value)
      val uri = Uri.parse(json.getString("uri"))
      context.contentResolver.openFileDescriptor(uri, "r").use { requireNotNull(it) }
      mapOf("uri" to uri.toString(), "fileName" to json.getString("fileName"),
        "contentType" to json.getString("contentType"), "downloadedAt" to json.getDouble("downloadedAt"))
    } catch (_: Exception) { preferences.edit().remove(key).commit(); null }
  }
  fun saveDownload(uri: String, key: String, fileName: String, contentType: String): Map<String, Any> {
    savedDownload(key)?.let { return it }
    val name = fileName.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_").take(180).ifBlank { "LMS file" }
    val values = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, name)
      put(MediaStore.Downloads.MIME_TYPE, contentType)
      put(MediaStore.Downloads.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS)
      put(MediaStore.Downloads.IS_PENDING, 1)
    }
    val resolver = context.contentResolver
    val output = requireNotNull(resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values))
    try {
      ParcelFileDescriptor.AutoCloseInputStream(descriptor(uri)).use { input ->
        requireNotNull(resolver.openOutputStream(output, "w")).use { input.copyTo(it) }
      }
      resolver.update(output, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
      val now = System.currentTimeMillis().toDouble()
      val record = JSONObject().put("uri", output.toString()).put("fileName", name)
        .put("contentType", contentType).put("downloadedAt", now)
      check(preferences.edit().putString(key, record.toString()).commit())
      return mapOf("uri" to output.toString(), "fileName" to name, "contentType" to contentType, "downloadedAt" to now)
    } catch (error: Exception) { resolver.delete(output, null, null); throw error }
  }
}
