package com.codialo.attachmentchecks
import android.graphics.Color
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.provider.MediaStore
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.attachmentpreview.LmsAttachmentStorage
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID
@RunWith(AndroidJUnit4::class)
class AttachmentStorageTest {
 @Test fun renderAndPersistDownloads() {
  val context=InstrumentationRegistry.getInstrumentation().targetContext
  val key="test-${UUID.randomUUID()}"
  val pdf=File(context.cacheDir,"$key.pdf")
  PdfDocument().use { document ->
    listOf(Color.RED,Color.BLUE).forEachIndexed { index,color ->
      val page=document.startPage(PdfDocument.PageInfo.Builder(300,420,index+1).create())
      page.canvas.drawColor(color);document.finishPage(page)
    }
    pdf.outputStream().use { document.writeTo(it) }
  }
  val storage=LmsAttachmentStorage(context)
  try {
    assertEquals(2,storage.pageCount(Uri.fromFile(pdf).toString()))
    listOf(Color.RED,Color.BLUE).forEachIndexed { index,color ->
      val page=storage.renderPage(Uri.fromFile(pdf).toString(),"$key-p$index",index,600)!!
      val bitmap=BitmapFactory.decodeFile(Uri.parse(page["uri"] as String).path)
      assertEquals(600,bitmap.width);val actual=bitmap.getPixel(200,200);assertTrue(kotlin.math.abs(Color.red(actual)-Color.red(color))<3);assertTrue(kotlin.math.abs(Color.blue(actual)-Color.blue(color))<3);bitmap.recycle()
      assertNotNull(LmsAttachmentStorage(context).cachedPreview("$key-p$index"))
    }
    val saved=storage.saveDownload(Uri.fromFile(pdf).toString(),key,"fixture.pdf","application/pdf")
    val uri=Uri.parse(saved["uri"] as String)
    try {
      assertTrue(uri.toString().startsWith("content://media/"))
      context.contentResolver.query(uri,arrayOf(MediaStore.Downloads.RELATIVE_PATH),null,null,null)!!.use { cursor ->
        assertTrue(cursor.moveToFirst());assertEquals("Download/",cursor.getString(0))
      }
      pdf.delete()
      val restored=LmsAttachmentStorage(context).savedDownload(key)!!
      assertEquals(saved["uri"],restored["uri"])
      assertEquals(2,LmsAttachmentStorage(context).pageCount(restored["uri"] as String))
      // Reuse must not need the original file and must not create another Downloads row.
      assertEquals(saved["uri"],storage.saveDownload(Uri.fromFile(pdf).toString(),key,"fixture.pdf","application/pdf")["uri"])
    }finally {context.contentResolver.delete(uri,null,null)}
    assertNull(LmsAttachmentStorage(context).savedDownload(key))
  }finally {pdf.delete();File(context.cacheDir,"lms-attachment-previews/$key-p0.jpg").delete();File(context.cacheDir,"lms-attachment-previews/$key-p1.jpg").delete()}
 }
 @Test fun rejectNonLocalFilesAndBadCacheKeys() {
   val context=InstrumentationRegistry.getInstrumentation().targetContext
   val storage=LmsAttachmentStorage(context)
   assertThrows(IllegalArgumentException::class.java){storage.pageCount("https://example.org/file.pdf")}
   assertThrows(IllegalArgumentException::class.java){storage.cachedPreview("../../bad")}
 }
}
