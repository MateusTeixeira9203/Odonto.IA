/**
 * Lightweight CSV builder.
 * Output includes UTF-8 BOM for Excel compatibility in pt-BR locale.
 */

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function escapeField(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const UTF8_BOM = '﻿';
  const header  = columns.map(c => escapeField(c.header)).join(',');
  const dataRows = rows.map(row =>
    columns.map(c => {
      const val = c.value(row);
      if (val == null) return '';
      return escapeField(String(val));
    }).join(',')
  );
  return UTF8_BOM + [header, ...dataRows].join('\n');
}

/** Triggers a browser download from a CSV string */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
