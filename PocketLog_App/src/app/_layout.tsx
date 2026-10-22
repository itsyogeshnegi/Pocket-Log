import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { migrateDatabase } from "@/data/database";
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30_000,retry:2},mutations:{retry:0}}});
export default function RootLayout(){return <SQLiteProvider databaseName="pocketlog.db" onInit={migrateDatabase}><QueryClientProvider client={queryClient}><StatusBar style="auto"/><Stack screenOptions={{headerShown:false}}><Stack.Screen name="(tabs)"/><Stack.Screen name="transaction/new" options={{presentation:"modal"}}/><Stack.Screen name="settings"/><Stack.Screen name="cards"/><Stack.Screen name="imports"/></Stack></QueryClientProvider></SQLiteProvider>}

