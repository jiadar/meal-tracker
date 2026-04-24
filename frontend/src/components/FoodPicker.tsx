import { useMemo } from "react";
import { Select } from "@mantine/core";
import { useFoods, type Food } from "@/features/foods/api";

interface Props {
  value: string | null;
  onChange: (foodId: string | null, food: Food | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

export function FoodPicker({
  value,
  onChange,
  label = "Food",
  placeholder = "Search foods",
  disabled,
  error,
  required,
}: Props) {
  const { data, isLoading } = useFoods();

  const options = useMemo(() => {
    const foods = data ?? [];
    return [...foods]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => ({ value: f.id, label: f.name }));
  }, [data]);

  const byId = useMemo(() => {
    const m = new Map<string, Food>();
    for (const f of data ?? []) m.set(f.id, f);
    return m;
  }, [data]);

  return (
    <Select
      label={label}
      placeholder={isLoading ? "Loading foods…" : placeholder}
      data={options}
      value={value}
      onChange={(id) => onChange(id, id ? (byId.get(id) ?? null) : null)}
      searchable
      clearable
      disabled={disabled || isLoading}
      error={error}
      required={required}
      nothingFoundMessage="No matches"
      maxDropdownHeight={280}
    />
  );
}
