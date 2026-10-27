import { ExportDefinition } from './types.js';
import { formatValue } from './helpers.js';

/**
 * Builds an RFC-4180 compliant CSV string from an ExportDefinition.
 * Formats values based on column definitions and protects against formula injection.
 */
export const buildCSV = <T = any>(definition: ExportDefinition<T>): string => {
  const headers = definition.columns.map((col) => col.header);

  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    let str = String(val).trim();

    // Formula injection mitigation (OWASP compliance)
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }

    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const rows = definition.dataRows.map((row) => {
    return definition.columns.map((col) => {
      const rawValue = (row as any)[col.key];
      const formatted = col.format ? formatValue(rawValue, col.format) : formatValue(rawValue);
      return escapeCell(formatted);
    });
  });

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.join(','))
  ];

  // Optional summary at bottom
  if (definition.summary && definition.summary.length > 0) {
    lines.push('');
    lines.push(escapeCell('--- EXECUTIVE SUMMARY ---'));
    definition.summary.forEach((item) => {
      const val = item.format ? formatValue(item.value, item.format) : formatValue(item.value);
      lines.push(`${escapeCell(item.label)},${escapeCell(val)}`);
    });
  }

  return lines.join('\r\n');
};
