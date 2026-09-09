package expo.modules.wifixnetwork

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.Locale

private class WifiNetworkUnavailableException : CodedException(
  "WIFI_NETWORK_UNAVAILABLE",
  "No active Wi-Fi network is available for the portal request.",
  null,
)

private class InvalidWifiRequestException(message: String) : CodedException(
  "INVALID_WIFI_REQUEST",
  message,
  null,
)

class WifixNetworkModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) {
      "React application context is unavailable"
    }

  override fun definition() = ModuleDefinition {
    Name("WifixNetwork")

    AsyncFunction("requestOnWifi") Coroutine { options: Map<String, Any?> ->
      requestOnWifi(options)
    }

    AsyncFunction("getWifiNetworkState") {
      getWifiNetworkState()
    }
  }

  private fun getWifiNetworkState(): Map<String, Any?> {
    val network = try {
      findWifiNetwork()
    } catch (_: WifiNetworkUnavailableException) {
      return mapOf(
        "available" to false,
        "validated" to false,
        "captivePortal" to false,
        "interfaceName" to null,
        "dnsServers" to emptyList<String>(),
        "dhcpServer" to null,
      )
    }
    val connectivityManager = getConnectivityManager()
    val capabilities = connectivityManager.getNetworkCapabilities(network)
      ?: return mapOf(
        "available" to false,
        "validated" to false,
        "captivePortal" to false,
        "interfaceName" to null,
        "dnsServers" to emptyList<String>(),
        "dhcpServer" to null,
      )
    val linkProperties = connectivityManager.getLinkProperties(network)
    return mapOf(
      "available" to true,
      "validated" to capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED),
      "captivePortal" to capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL),
      "interfaceName" to linkProperties?.interfaceName,
      "dnsServers" to (linkProperties?.dnsServers?.mapNotNull(InetAddress::getHostAddress) ?: emptyList()),
      "dhcpServer" to getDhcpServer(linkProperties),
    )
  }

  private fun requestOnWifi(options: Map<String, Any?>): Map<String, Any?> {
    val requestUrl = (options["url"] as? String)?.trim()
      ?: throw InvalidWifiRequestException("A request URL is required.")
    val url = try {
      URL(requestUrl)
    } catch (error: Exception) {
      throw InvalidWifiRequestException("Invalid request URL: ${error.message}")
    }
    if (url.protocol.lowercase(Locale.ROOT) !in setOf("http", "https")) {
      throw InvalidWifiRequestException("Only HTTP and HTTPS URLs are supported.")
    }

    val network = findWifiNetwork()
    val linkProperties = getConnectivityManager().getLinkProperties(network)
    val resolvedAddresses = resolveOnNetwork(network, url.host)
    val connection = network.openConnection(url) as? HttpURLConnection
      ?: throw InvalidWifiRequestException("The portal URL did not create an HTTP connection.")

    val method = ((options["method"] as? String) ?: "GET").uppercase(Locale.ROOT)
    val headers = readHeaders(options["headers"])
    val body = options["body"] as? String
    val timeoutMs = ((options["timeoutMs"] as? Number)?.toInt() ?: 8000).coerceIn(1000, 30000)

    try {
      connection.connectTimeout = timeoutMs
      connection.readTimeout = timeoutMs
      connection.requestMethod = method
      connection.instanceFollowRedirects = false
      connection.useCaches = false
      connection.doInput = true
      headers.forEach { (name, value) -> connection.setRequestProperty(name, value) }

      if (body != null) {
        connection.doOutput = true
        connection.outputStream.use { output ->
          output.write(body.toByteArray(StandardCharsets.UTF_8))
        }
      }

      val status = connection.responseCode
      val responseBody = readResponseBody(connection, status)
      val responseHeaders = readResponseHeaders(connection)
      val setCookies = responseHeaders.entries
        .filter { it.key.equals("set-cookie", ignoreCase = true) }
        .flatMap { it.value }

      return mapOf(
        "status" to status,
        "url" to connection.url.toString(),
        "headers" to responseHeaders,
        "setCookies" to setCookies,
        "body" to responseBody,
        "interfaceName" to linkProperties?.interfaceName,
        "dnsServers" to (linkProperties?.dnsServers?.mapNotNull(InetAddress::getHostAddress) ?: emptyList()),
        "dhcpServer" to getDhcpServer(linkProperties),
        "resolvedAddresses" to resolvedAddresses,
      )
    } catch (error: IOException) {
      throw IOException(
        "Wi-Fi request failed for ${url.host}: ${error.message ?: error.javaClass.simpleName}",
        error,
      )
    } finally {
      connection.disconnect()
    }
  }

  private fun getConnectivityManager(): ConnectivityManager =
    context.getSystemService(ConnectivityManager::class.java)
      ?: throw WifiNetworkUnavailableException()

  @Suppress("DEPRECATION")
  private fun findWifiNetwork(): Network {
    val connectivityManager = getConnectivityManager()
    val candidates = connectivityManager.allNetworks.mapNotNull { network ->
      val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return@mapNotNull null
      if (!capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return@mapNotNull null
      if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) return@mapNotNull null
      if (!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)) return@mapNotNull null
      if (!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_RESTRICTED)) return@mapNotNull null
      network to capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    return candidates.firstOrNull { it.second }?.first
      ?: candidates.firstOrNull()?.first
      ?: throw WifiNetworkUnavailableException()
  }

  private fun resolveOnNetwork(network: Network, host: String): List<String> {
    if (host.isBlank() || host.toCharArray().all { it.isDigit() || it == '.' }) return emptyList()
    return try {
      network.getAllByName(host).map(InetAddress::getHostAddress)
    } catch (error: IOException) {
      throw IOException(
        "Wi-Fi DNS lookup failed for $host: ${error.message ?: error.javaClass.simpleName}",
        error,
      )
    }
  }

  private fun readHeaders(value: Any?): Map<String, String> {
    val rawHeaders = value as? Map<*, *> ?: return emptyMap()
    return rawHeaders.mapNotNull { (key, headerValue) ->
      val name = key as? String ?: return@mapNotNull null
      val text = headerValue as? String ?: return@mapNotNull null
      name to text
    }.toMap()
  }

  private fun readResponseHeaders(connection: HttpURLConnection): Map<String, List<String>> =
    connection.headerFields
      .filterKeys { it != null }
      .mapKeys { (key, _) -> key ?: "" }
      .mapValues { (_, values) -> values.filterNotNull() }

  private fun readResponseBody(connection: HttpURLConnection, status: Int): String {
    val stream = if (status >= 400) connection.errorStream else connection.inputStream
    return stream?.bufferedReader(StandardCharsets.UTF_8).use { reader ->
      reader?.readText() ?: ""
    }
  }

  private fun getDhcpServer(linkProperties: LinkProperties?): String? {
    if (linkProperties == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
    return linkProperties.dhcpServerAddress?.hostAddress
  }
}
