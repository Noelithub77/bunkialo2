package expo.modules.attachmentpreview
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AttachmentPreviewModule : Module() {
  private fun storage() = LmsAttachmentStorage(requireNotNull(appContext.reactContext))
  override fun definition() = ModuleDefinition {
    Name("AttachmentPreview")
    AsyncFunction("getCachedPreview") { key: String -> storage().cachedPreview(key) }
    AsyncFunction("getPageCount") { uri: String -> storage().pageCount(uri) }
    AsyncFunction("renderPage") { uri: String, key: String, index: Int, width: Int -> storage().renderPage(uri, key, index, width) }
    AsyncFunction("getSavedDownload") { key: String -> storage().savedDownload(key) }
    AsyncFunction("saveDownload") { uri: String, key: String, name: String, mime: String -> storage().saveDownload(uri, key, name, mime) }
  }
}
