package expo.modules.pocketlognotificationimport

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

class PocketLogNotificationListenerService : NotificationListenerService() {
  private val amount = Regex("(?:INR|Rs\\.?|₹)\\s*([\\d,]+(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE)
  private val debit = Regex("\\b(debited|spent|paid|purchase|withdrawn)\\b", RegexOption.IGNORE_CASE)
  private val credit = Regex("\\b(credited|received|refund)\\b", RegexOption.IGNORE_CASE)
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val prefs = getSharedPreferences(PocketLogNotificationImportModule.PREFS, 0)
    if (!prefs.getBoolean("consent", false) || !prefs.getStringSet("allowlist", emptySet())!!.contains(sbn.packageName)) return
    val text = sbn.notification.extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.replace(Regex("\\s+"), " ")?.take(1000) ?: return
    val amountMatch = amount.find(text) ?: return
    val rupees = amountMatch.groupValues[1].replace(",", "").toBigDecimalOrNull() ?: return
    val isDebit = debit.containsMatchIn(text); val isCredit = credit.containsMatchIn(text)
    if (isDebit == isCredit) return
    val amountPaise = rupees.movePointRight(2).longValueExact()
    val sourceIdentifier = sbn.key.take(255)
    val fingerprintSource = "${sbn.packageName}|$amountPaise|${if (isDebit) "expense" else "income"}|${sbn.postTime / 60000}"
    val fingerprint = MessageDigest.getInstance("SHA-256").digest(fingerprintSource.toByteArray()).joinToString("") { "%02x".format(it) }
    val pending = JSONArray(prefs.getString("pending", "[]")); if ((0 until pending.length()).any { pending.getJSONObject(it).optString("fingerprint") == fingerprint }) return
    val item = JSONObject().put("id", UUID.randomUUID().toString()).put("sourcePackage", sbn.packageName).put("sourceIdentifier", sourceIdentifier).put("amountPaise", amountPaise).put("type", if (isDebit) "expense" else "income").put("occurredAt", Instant.ofEpochMilli(sbn.postTime).toString()).put("confidence", .85).put("fingerprint", fingerprint)
    pending.put(item); while (pending.length() > 100) pending.remove(0)
    prefs.edit().putString("pending", pending.toString()).apply()
  }
}
