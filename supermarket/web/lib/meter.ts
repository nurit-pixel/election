/** צבעי המד שבלוגו, מהזול ליקר: טורקיז, ירוק-ליים, צהוב, כתום, ורוד */
export const METER_COLORS = ["#14fbe1", "#a8f200", "#ffd400", "#fd6d01", "#fc0385"] as const;
export const METER_LABELS = ["הכי זול", "זול", "באמצע", "יקר", "הכי יקר"] as const;

/** המקום של מחיר על המד (0–4), בין הזול ליקר שבהשוואה */
export function meterLevel(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  const position = (value - min) / (max - min);
  return Math.min(METER_COLORS.length - 1, Math.max(0, Math.floor(position * METER_COLORS.length)));
}
