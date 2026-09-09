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
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.Locale
import javax.net.ssl.HttpsURLConnection

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

    AsyncFunction("resolveOnWifi") {
      host: String -> resolveOnWifi(host)
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
    val resolvedAddresses = resolveOnDhcpDns(network, linkProperties, url.host)
    val resolvedHost = resolvedAddresses.firstOrNull() ?: url.host
    val resolvedUrl = if (resolvedHost == url.host) {
      url
    } else {
      URL(url.protocol, formatHostForUrl(resolvedHost), url.port, url.file)
    }
    val connection = network.openConnection(resolvedUrl) as? HttpURLConnection
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
      if (resolvedHost != url.host) {
        connection.setRequestProperty("Host", formatHostHeader(url))
      }
      if (connection is HttpsURLConnection && resolvedHost != url.host) {
        val defaultHostnameVerifier = HttpsURLConnection.getDefaultHostnameVerifier()
        connection.hostnameVerifier = javax.net.ssl.HostnameVerifier { _, session ->
          defaultHostnameVerifier.verify(url.host, session)
        }
      }

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
        "url" to url.toString(),
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

  private fun resolveOnWifi(host: String): Map<String, Any?> {
    val normalizedHost = host.trim()
    if (normalizedHost.isBlank()) {
      throw InvalidWifiRequestException("A DNS host is required.")
    }

    val network = findWifiNetwork()
    val linkProperties = getConnectivityManager().getLinkProperties(network)
    return mapOf(
      "interfaceName" to linkProperties?.interfaceName,
      "dnsServers" to (linkProperties?.dnsServers?.mapNotNull(InetAddress::getHostAddress) ?: emptyList()),
      "dhcpServer" to getDhcpServer(linkProperties),
      "resolvedAddresses" to resolveOnDhcpDns(network, linkProperties, normalizedHost),
    )
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

  private fun resolveOnDhcpDns(
    network: Network,
    linkProperties: LinkProperties?,
    host: String,
  ): List<String> {
    if (host.isBlank() || host.toCharArray().all { it.isDigit() || it == '.' }) return emptyList()

    val dnsServers = linkProperties?.dnsServers.orEmpty()
    if (dnsServers.isEmpty()) {
      throw IOException("Wi-Fi DHCP DNS servers are unavailable for $host")
    }

    val failures = mutableListOf<String>()
    DatagramSocket().use { socket ->
      network.bindSocket(socket)
      socket.soTimeout = 3000
      for (dnsServer in dnsServers) {
        val addresses = mutableListOf<String>()
        for (queryType in listOf(1, 28)) {
          val queryId = (System.nanoTime().toInt() and 0xffff)
          val query = buildDnsQuery(host, queryId, queryType)
          val responseBuffer = ByteArray(2048)
          try {
            socket.send(DatagramPacket(query, query.size, dnsServer, 53))
            val response = DatagramPacket(responseBuffer, responseBuffer.size)
            socket.receive(response)
            addresses += parseDnsResponse(response.data, response.length, queryId, queryType)
          } catch (error: SocketTimeoutException) {
            failures += "${dnsServer.hostAddress}: timeout"
            break
          } catch (error: IOException) {
            failures += "${dnsServer.hostAddress}: ${error.message ?: error.javaClass.simpleName}"
            break
          }
        }
        if (addresses.isNotEmpty()) return addresses.distinct()
      }
    }

    throw IOException(
      "Wi-Fi DHCP DNS lookup failed for $host${if (failures.isEmpty()) "" else ": ${failures.joinToString("; ")}"}",
    )
  }

  private fun buildDnsQuery(host: String, queryId: Int, queryType: Int): ByteArray {
    val normalizedHost = host.trim().trimEnd('.')
    val labels = normalizedHost.split('.')
    require(labels.isNotEmpty() && labels.all { it.isNotEmpty() && it.length <= 63 }) {
      "Invalid DNS host: $host"
    }

    val output = ByteArrayOutputStream()
    DataOutputStream(output).use { data ->
      data.writeShort(queryId)
      data.writeShort(0x0100)
      data.writeShort(1)
      data.writeShort(0)
      data.writeShort(0)
      data.writeShort(0)
      labels.forEach { label ->
        val bytes = label.toByteArray(StandardCharsets.UTF_8)
        data.writeByte(bytes.size)
        data.write(bytes)
      }
      data.writeByte(0)
      data.writeShort(queryType)
      data.writeShort(1)
    }
    return output.toByteArray()
  }

  private fun parseDnsResponse(
    response: ByteArray,
    length: Int,
    queryId: Int,
    queryType: Int,
  ): List<String> {
    if (length < 12 || readDnsShort(response, 0) != queryId) return emptyList()
    val flags = readDnsShort(response, 2)
    if (flags and 0x8000 == 0 || flags and 0x000f != 0) return emptyList()

    var offset = 12
    val questionCount = readDnsShort(response, 4)
    val answerCount = readDnsShort(response, 6)
    repeat(questionCount) {
      offset = skipDnsName(response, length, offset)
      if (offset + 4 > length) return emptyList()
      offset += 4
    }

    val addresses = mutableListOf<String>()
    repeat(answerCount) {
      offset = skipDnsName(response, length, offset)
      if (offset + 10 > length) return emptyList()
      val recordType = readDnsShort(response, offset)
      val recordClass = readDnsShort(response, offset + 2)
      val recordLength = readDnsShort(response, offset + 8)
      offset += 10
      if (offset + recordLength > length) return emptyList()
      if (recordClass == 1 && recordType == queryType && (recordType == 1 || recordType == 28)) {
        val addressBytes = response.copyOfRange(offset, offset + recordLength)
        InetAddress.getByAddress(addressBytes).hostAddress?.let(addresses::add)
      }
      offset += recordLength
    }
    return addresses
  }

  private fun readDnsShort(bytes: ByteArray, offset: Int): Int =
    ((bytes[offset].toInt() and 0xff) shl 8) or (bytes[offset + 1].toInt() and 0xff)

  private fun skipDnsName(bytes: ByteArray, length: Int, start: Int): Int {
    var offset = start
    while (offset < length) {
      val labelLength = bytes[offset].toInt() and 0xff
      if (labelLength == 0) return offset + 1
      if (labelLength and 0xc0 == 0xc0) {
        if (offset + 1 >= length) return length
        return offset + 2
      }
      offset += labelLength + 1
    }
    return length
  }

  private fun readHeaders(value: Any?): Map<String, String> {
    val rawHeaders = value as? Map<*, *> ?: return emptyMap()
    return rawHeaders.mapNotNull { (key, headerValue) ->
      val name = key as? String ?: return@mapNotNull null
      val text = headerValue as? String ?: return@mapNotNull null
      name to text
    }.toMap()
  }

  private fun formatHostForUrl(host: String): String =
    if (host.contains(":")) "[$host]" else host

  private fun formatHostHeader(url: URL): String {
    val host = formatHostForUrl(url.host)
    return if (url.port == -1 || url.port == url.defaultPort) host else "$host:${url.port}"
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
