import { NumberInput, Table } from "@mantine/core";
import type { TargetField, TargetRowDef, TargetValues } from "./schema";

interface Props {
  row: TargetRowDef;
  values: TargetValues;
  onChange: (field: TargetField, value: number | "") => void;
}

export function TargetRow({ row, values, onChange }: Props) {
  const renderInput = (field: TargetField, label: string) => (
    <NumberInput
      value={values[field] ?? ""}
      onChange={(v) => onChange(field, typeof v === "number" ? v : "")}
      min={row.min ?? 0}
      max={row.max}
      step={row.step}
      decimalScale={row.decimalScale ?? 0}
      aria-label={label}
    />
  );

  return (
    <Table.Tr>
      <Table.Td>{row.label}</Table.Td>
      <Table.Td>{renderInput(row.low, `${row.label} low`)}</Table.Td>
      <Table.Td>
        {row.high ? renderInput(row.high, `${row.label} high`) : null}
      </Table.Td>
    </Table.Tr>
  );
}
