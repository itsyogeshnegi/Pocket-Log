import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
type NativeImport={isAccessGranted():Promise<boolean>;openNotificationAccessSettings():Promise<void>;setConsent(enabled:boolean,packages:string[]):Promise<void>};
const nativeImport=Platform.OS==="android"?requireOptionalNativeModule<NativeImport>("PocketLogNotificationImport"):null;
export function notificationImportSupported(){return Platform.OS==="android"&&Boolean(nativeImport)}
export async function enableNotificationImport(packages:string[]){if(!nativeImport)throw new Error("Automatic notification import is unavailable in this build");await nativeImport.setConsent(true,packages);await nativeImport.openNotificationAccessSettings()}
export async function disableNotificationImport(){await nativeImport?.setConsent(false,[])}

