export function sleepHoursColor(hours: number, target: number): string {
  if (hours >= target) return "green";
  if (hours >= 7) return "yellow";
  return "red";
}

export function sleepQualityColor(quality: number, target: number): string {
  if (quality >= target) return "green";
  if (quality === 3) return "yellow";
  return "red";
}
