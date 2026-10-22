package expo.modules.pocketlognotificationimport

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

class PocketLogNotificationImportModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PocketLogNotificationImport")
    AsyncFunction("isAccessGranted") {
      val context = requireNotNull(appContext.reactContext)
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: ""
      enabled.split(":").mapNotNull(ComponentName::unflattenFromString).any { it.packageName == context.packageName }
    }
    AsyncFunction("openNotificationAccessSettings") {
      val context = requireNotNull(appContext.reactContext)
      context.startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("setConsent") { enabled: Boolean, packages: List<String> ->
      val prefs = requireNotNull(appContext.reactContext).getSharedPreferences(PREFS, 0)
      prefs.edit().putBoolean("consent", enabled).putStringSet("allowlist", packages.toSet()).apply()
    }
    AsyncFunction("getPendingImports") {
      val prefs = requireNotNull(appContext.reactContext).getSharedPreferences(PREFS, 0)
      val array = JSONArray(prefs.getString("pending", "[]"))
      (0 until array.length()).map { index ->
        val item = array.getJSONObject(index)
        mapOf("id" to item.getString("id"), "sourcePackage" to item.getString("sourcePackage"), "sourceIdentifier" to item.getString("sourceIdentifier"), "amountPaise" to item.getLong("amountPaise"), "type" to item.getString("type"), "merchant" to item.optString("merchant"), "occurredAt" to item.getString("occurredAt"), "confidence" to item.getDouble("confidence"), "evidenceCodes" to listOf("amount", "direction", "authorized_source"), "fingerprint" to item.getString("fingerprint"))
      }
    }
    AsyncFunction("clearPendingImports") { ids: List<String> ->
      val prefs = requireNotNull(appContext.reactContext).getSharedPreferences(PREFS, 0)
      val array = JSONArray(prefs.getString("pending", "[]")); val kept = JSONArray()
      for (index in 0 until array.length()) if (!ids.contains(array.getJSONObject(index).getString("id"))) kept.put(array.getJSONObject(index))
      prefs.edit().putString("pending", kept.toString()).apply()
    }
  }
  companion object { const val PREFS = "pocketlog_notification_import" }
}
