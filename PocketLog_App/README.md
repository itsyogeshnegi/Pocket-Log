# PocketLog Mobile

Expo SDK 58 mobile client for PocketLog. Records are written to SQLite before network synchronization, so transaction entry and the core modules remain useful offline.

## Setup

1. Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_BASE_URL`. A physical phone cannot reach a computer through `localhost`; use the computer's LAN address or a deployed HTTPS API.
2. Install with `npm install` and run `npm start`. Use `npm run android` for ordinary Expo development.
3. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run doctor` before release.

The app uses integer paise, INR, `en-IN`, and `Asia/Kolkata` defaults. SQLite contains transactions, module entities, an idempotent sync queue, conflict snapshots, and device-only encrypted card data. Sync attempts use bounded exponential backoff and never delete offline work after a network failure. Optimistic-version conflicts are preserved locally with both payloads and marked `conflict` instead of being overwritten.

## Security boundaries

- Access and refresh tokens are stored in SecureStore. Full card numbers are optional, AES-256-GCM encrypted, and kept only in SQLite; the key is stored in SecureStore with device authentication. Biometric enrollment changes can invalidate the key, so PocketLog does not promise recovery of a device-only card number.
- Card screens prevent screenshots where supported. Copy requires an explicit reveal action, marks clipboard content sensitive on Android, and clears it after 30 seconds only if PocketLog can verify it is unchanged.
- Never enter CVV/CVC, PIN, UPI PIN, OTP, bank password, or recovery codes.
- Document images are compressed once, measured from the produced file, and target 100 KB. Text-heavy scans stop at a 1200 px minimum dimension and report the actual size if readability takes priority. PDFs are not rasterized.
- “Sign out and erase this device” explicitly warns about queued work, attempts server-session revocation, and then removes SQLite records, encrypted PAN material, tokens, scheduled notifications, and PocketLog clipboard content. When offline, the UI clearly reports that remote revocation still needs another signed-in client.

## Android notification import

The default `development` and `production` profiles remove the notification listener service. Manual paste/import remains available on Android and iOS.

The `notification-import` EAS profile includes the local Kotlin Expo module:

```powershell
npx.cmd eas-cli@latest build --platform android --profile notification-import
```

The user must explicitly enable import, enter an exact app-package allowlist, and grant notification access in Android settings. The listener ignores non-allowlisted apps, stores only extracted transaction fields, and discards raw notification text. Hidden amounts and ambiguous directions are rejected. No SMS or call-log permissions are requested.

Before Play distribution, complete the financial-features declaration, update the privacy/data-safety disclosures, provide reviewer instructions, and obtain policy review for the listener build. Keep the default production profile until that review succeeds.

## Device verification

Test camera/gallery/PDF intake, compression size/readability, local reminders across timezone changes, biometric invalidation, screenshot blocking, clipboard clearing, offline restart and sync recovery, Android notification consent/revocation, and logout with queued changes on real devices. iOS native builds require EAS or macOS.

