import { ExportDefinition } from './types.js';

/**
 * Builds clean structured JSON string from an ExportDefinition.
 */
export const buildJSON = <T = any>(definition: ExportDefinition<T>): string => {
  return JSON.stringify(
    {
      reportTitle: definition.title,
      metadata: definition.metadata,
      summary: definition.summary || [],
      totalRows: definition.dataRows.length,
      columns: definition.columns.map((c) => ({ key: c.key, header: c.header })),
      data: definition.dataRows
    },
    null,
    2
  );
};
