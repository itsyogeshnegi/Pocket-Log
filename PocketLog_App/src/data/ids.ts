import { getRandomBytes, randomUUID } from "expo-crypto";
export function createRecordId(){return Array.from(getRandomBytes(12),byte=>byte.toString(16).padStart(2,"0")).join("")}
export function createOperationId(){return randomUUID()}
