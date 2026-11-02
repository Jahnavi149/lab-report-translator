import type { Flag, LabRow } from './types';
export interface CompareRow {
  test_name: string;
  old_value: number | null; new_value: number | null;
  old_unit: string; new_unit: string;
  old_flag: Flag | null; new_flag: Flag | null;
  direction: 'up' | 'down' | 'same' | 'new' | 'gone';
  flag_change: string;
  change_text: string;
}
export function compareReports(oldRows: LabRow[], newRows: LabRow[]): CompareRow[] {
  const oldMap = new Map(oldRows.map((r) => [r.test_name.toLowerCase(), r]));
  const newMap = new Map(newRows.map((r) => [r.test_name.toLowerCase(), r]));
  const names = [...new Set([...oldMap.keys(), ...newMap.keys()])];
  return names.map((key) => {
    const o = oldMap.get(key) ?? null;
    const n = newMap.get(key) ?? null;
    const test_name = n?.test_name ?? o?.test_name ?? key;
    let direction: CompareRow['direction'] = 'same';
    if (!o && n) direction = 'new';
    else if (o && !n) direction = 'gone';
    else if (o && n && n.value > o.value) direction = 'up';
    else if (o && n && n.value < o.value) direction = 'down';
    const flag_change = o && n && o.flag !== n.flag ? `${o.flag} → ${n.flag}` : 'No flag change';
    const change_text = !o && n ? `New in this report: ${n.value} ${n.unit}.`
      : o && !n ? `Not in the new report.`
      : o && n && n.value === o.value ? `Unchanged at ${n.value} ${n.unit}.`
      : o && n ? `Changed from ${o.value} ${o.unit} to ${n.value} ${n.unit} (${direction === 'up' ? 'higher' : 'lower'}).`
      : '';
    return { test_name, old_value: o?.value ?? null, new_value: n?.value ?? null, old_unit: o?.unit ?? '', new_unit: n?.unit ?? '', old_flag: o?.flag ?? null, new_flag: n?.flag ?? null, direction, flag_change, change_text };
  });
}
