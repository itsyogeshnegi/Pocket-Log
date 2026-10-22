import { requireNativeModule } from "expo-modules-core";
type ImportedTransaction={id:string;sourcePackage:string;sourceIdentifier:string;amountPaise:number;type:"expense"|"income";merchant?:string;occurredAt:string;confidence:number;evidenceCodes:string[];fingerprint:string};
type NativeModule={isAccessGranted():Promise<boolean>;openNotificationAccessSettings():Promise<void>;setConsent(enabled:boolean,packages:string[]):Promise<void>;getPendingImports():Promise<ImportedTransaction[]>;clearPendingImports(ids:string[]):Promise<void>};
export default requireNativeModule<NativeModule>("PocketLogNotificationImport");
export type { ImportedTransaction };
