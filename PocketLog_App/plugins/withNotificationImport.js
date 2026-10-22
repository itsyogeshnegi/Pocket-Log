const { withAndroidManifest } = require("expo/config-plugins");
module.exports = function withNotificationImport(config) {
  if (process.env.ENABLE_ANDROID_NOTIFICATION_IMPORT === "true") return config;
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    const application = manifest.application?.[0];
    if (application) {
      application.service = application.service || [];
      application.service.push({ $: { "android:name": "expo.modules.pocketlognotificationimport.PocketLogNotificationListenerService", "tools:node": "remove" } });
    }
    return result;
  });
};
