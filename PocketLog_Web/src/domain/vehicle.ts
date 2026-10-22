export type Fill = { odometerKm: number; litres: number; fullTank: boolean };
export type MileageResult = { distanceKm: number; litres: number; kmPerLitre: number; estimated: boolean } | null;

export function calculateMileage(entries: Fill[]): MileageResult {
  const sorted = [...entries].sort((a, b) => a.odometerKm - b.odometerKm);
  for (const item of sorted) if (item.odometerKm < 0 || item.litres <= 0 || !Number.isFinite(item.odometerKm + item.litres)) throw new Error("Invalid fill-up values");
  const fullIndexes = sorted.map((entry, index) => entry.fullTank ? index : -1).filter((index) => index >= 0);
  if (fullIndexes.length < 2) return null;
  const start = fullIndexes.at(-2)!; const end = fullIndexes.at(-1)!;
  const distanceKm = sorted[end].odometerKm - sorted[start].odometerKm;
  if (distanceKm <= 0) throw new Error("Odometer readings must increase");
  const litres = sorted.slice(start + 1, end + 1).reduce((sum, entry) => sum + entry.litres, 0);
  return { distanceKm, litres, kmPerLitre: Math.round((distanceKm / litres) * 100) / 100, estimated: sorted.slice(start + 1, end).some((entry) => !entry.fullTank) };
}

