import { useState } from "react";
import { apiGet } from "@/lib/apiClient";
import { buildExport } from "@/lib/export";
import { downloadJson } from "@/lib/exportDownload";
import { fetchAllFoods } from "@/features/foods/api";
import type { Day } from "@/features/days/api";

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function fetchAllDays(): Promise<Day[]> {
  const all: Day[] = [];
  let page = 1;
  for (;;) {
    const resp = await apiGet<Paginated<Day>>("/days/", { page });
    all.push(...resp.results);
    if (!resp.next) break;
    page += 1;
  }
  return all;
}

export function useExport() {
  const [exporting, setExporting] = useState(false);

  const fire = async () => {
    setExporting(true);
    try {
      const [foods, days] = await Promise.all([fetchAllFoods(), fetchAllDays()]);
      const data = buildExport(days, foods);
      downloadJson(data, "meal-tracker-data.json");
    } finally {
      setExporting(false);
    }
  };

  return { exporting, fire };
}
