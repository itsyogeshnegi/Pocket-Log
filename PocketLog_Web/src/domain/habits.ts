export type HabitDay = { localDate: string; state: "completed" | "rest" | "skipped" | "missed" };

export function currentStreak(days: HabitDay[], today: string) {
  const map = new Map(days.map((day) => [day.localDate, day.state]));
  const cursor = new Date(`${today}T00:00:00Z`); let streak = 0;
  while (true) {
    const key = cursor.toISOString().slice(0, 10); const state = map.get(key);
    if (state === "completed") streak += 1;
    else if (state !== "rest" && state !== "skipped") break;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

