import { ExportDefinition } from './types.js';
import { buildWorkbook } from './excel.js';
import { buildCSV } from './csv.js';
import { buildJSON } from './json.js';
import { buildPDF, streamPDF } from './pdf.js';
import { sanitizeFilename } from './helpers.js';

export * from './types.js';
export * from './helpers.js';
export * from './excel.js';
export * from './csv.js';
export * from './json.js';
export * from './pdf.js';

export interface ExportResult {
  buffer: Buffer | string;
  contentType: string;
  filename: string;
}

/**
 * Dispatcher: takes an ExportDefinition and desired format ('excel' | 'pdf' | 'csv' | 'json')
 * and returns the formatted payload, proper content-type, and full filename.
 */
export const generateExport = async <T = any>(
  definition: ExportDefinition<T>,
  format: string = 'excel'
): Promise<ExportResult> => {
  const normalizedFormat = format.toLowerCase().trim();
  const baseName = sanitizeFilename(definition.filename || 'export');

  if (normalizedFormat === 'excel' || normalizedFormat === 'xlsx') {
    const buffer = await buildWorkbook(definition);
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${baseName}.xlsx`
    };
  }

  if (normalizedFormat === 'pdf') {
    const buffer = await buildPDF(definition);
    return {
      buffer,
      contentType: 'application/pdf',
      filename: `${baseName}.pdf`
    };
  }

  if (normalizedFormat === 'json') {
    const jsonStr = buildJSON(definition);
    return {
      buffer: jsonStr,
      contentType: 'application/json; charset=utf-8',
      filename: `${baseName}.json`
    };
  }

  // Default to CSV
  const csvStr = buildCSV(definition);
  return {
    buffer: csvStr,
    contentType: 'text/csv; charset=utf-8',
    filename: `${baseName}.csv`
  };
};
