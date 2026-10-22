import { useCallback, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import * as Clipboard from "expo-clipboard";
import { Card, Empty, Screen, ui } from "@/components/screen";
import { NotificationImportConsent } from "@/components/notification-import-consent";
import { createEntity, listEntities, type LocalEntity } from "@/data/entities";
import { parseFinancialMessage } from "@/services/import-parser";
import { colors } from "@/constants/pocket-theme";

export default function Imports() {
  const db = useSQLiteContext();
  const [text, setText] = useState("");
  const [items, setItems] = useState<LocalEntity[]>([]);
  const load = useCallback(() => { listEntities(db, "import").then(setItems); }, [db]);
  useFocusEffect(load);
  async function paste() { setText(await Clipboard.getStringAsync()); }
  async function parse() {
    if (!text.trim()) return;
    const parsed = await parseFinancialMessage(text, new Date(), "manual-paste");
    await createEntity(db, "import", parsed.amountPaise ? `INR ${(parsed.amountPaise / 100).toFixed(2)} ${parsed.type ?? "transaction"}` : "Unsupported import", { ...parsed, status: parsed.unsupportedReason ? "unsupported" : "pending", rawRetained: false });
    setText(""); load();
    Alert.alert(parsed.unsupportedReason ? "Needs manual entry" : "Ready for review", parsed.unsupportedReason ?? "Check the amount and category before confirming.");
  }
  return <Screen title="Review imports" eyebrow="Nothing is finalized automatically"><NotificationImportConsent/><Card><Text style={ui.label}>Paste a payment message</Text><TextInput style={[ui.input,{minHeight:100,textAlignVertical:"top"}]} value={text} onChangeText={setText} multiline maxLength={1000} placeholder="Raw text is parsed locally and not retained."/><View style={{flexDirection:"row",gap:8}}><Pressable style={[ui.button,{flex:1}]} onPress={paste}><Text style={ui.buttonText}>Paste</Text></Pressable><Pressable style={[ui.button,{flex:1}]} onPress={parse}><Text style={ui.buttonText}>Parse</Text></Pressable></View></Card><Card>{items.length ? items.map(item=><View key={item.id} style={ui.row}><View><Text style={{fontWeight:"800",color:colors.ink}}>{item.title}</Text><Text style={ui.subtle}>{String(item.payload.status)} · confidence {Math.round(Number(item.payload.confidence ?? 0) * 100)}%</Text></View></View>) : <Empty>No imported transactions are waiting for review.</Empty>}</Card></Screen>;
}
