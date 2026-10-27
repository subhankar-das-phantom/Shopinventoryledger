import ExcelJS from 'exceljs';
import { ExportDefinition } from './types.js';

function getColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter || 'A';
}

/**
 * Builds a professionally formatted Excel workbook buffer from an ExportDefinition.
 * Generates an executive Data worksheet with AutoFilter, Freeze Panes, and zebra striping,
 * alongside a dedicated Executive Summary worksheet.
 */
export const buildWorkbook = async <T = any>(
  definition: ExportDefinition<T>
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = definition.metadata.generatedBy;
  workbook.created = new Date();
  workbook.modified = new Date();

  // === 1. Data Sheet ===
  const dataSheet = workbook.addWorksheet('Data', {
    properties: { tabColor: { argb: 'FF0284C7' } } // Electric Blue
  });

  const totalColumns = definition.columns.length;
  const lastColLetter = getColumnLetter(totalColumns);
  let headerRowsCount = 0;

  // Title / Shop Name Banner
  if (definition.metadata.shopName) {
    dataSheet.mergeCells(`A1:${lastColLetter}1`);
    const shopCell = dataSheet.getCell('A1');
    shopCell.value = `${definition.metadata.shopName} - ${definition.title}`;
    shopCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    shopCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Slate 900
    };
    shopCell.alignment = { vertical: 'middle', horizontal: 'center' };
    dataSheet.getRow(1).height = 34;
    headerRowsCount = 1;
  }

  // Column Headers
  const columnHeaderRowNum = headerRowsCount + 2;

  dataSheet.columns = definition.columns.map((col) => ({
    key: String(col.key),
    width: col.width || 18
  }));

  const headerRow = dataSheet.getRow(columnHeaderRowNum);
  definition.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
  });

  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate 800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 26;

  // Freeze pane below headers
  dataSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: columnHeaderRowNum }];

  // AutoFilter
  dataSheet.autoFilter = {
    from: `A${columnHeaderRowNum}`,
    to: `${lastColLetter}${columnHeaderRowNum}`
  };

  // Render Data Rows
  definition.dataRows.forEach((rowData, index) => {
    const rowValues: Record<string, any> = {};

    definition.columns.forEach((col) => {
      let val: any = (rowData as any)[col.key];

      if (col.format === 'percentage') {
        const numVal = Number(val);
        if (!isNaN(numVal)) val = numVal / 100;
      }

      if (col.format === 'datetime' || col.format === 'date') {
        if (val instanceof Date || (typeof val === 'string' && val)) {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            // IST offset (+5:30) for accurate Excel serial time display
            const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
            val = new Date(d.getTime() + IST_OFFSET_MS);
          }
        }
      }

      rowValues[String(col.key)] = val ?? '';
    });

    const row = dataSheet.addRow(rowValues);

    // Subtle zebra striping
    if (index % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' } // Slate 50
      };
    }

    // Number & date formats
    definition.columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);

      if (col.format === 'currency') cell.numFmt = '₹#,##0.00';
      if (col.format === 'integer') cell.numFmt = '#,##0';
      if (col.format === 'number') {
        const rawVal = (rowData as any)[col.key];
        const numVal = Number(rawVal);
        cell.numFmt = !isNaN(numVal) && Number.isInteger(numVal) ? '#,##0' : '#,##0.00';
      }
      if (col.format === 'percentage') cell.numFmt = '0.00%';
      if (col.format === 'date') cell.numFmt = 'dd mmm yyyy';
      if (col.format === 'datetime') cell.numFmt = 'dd mmm yyyy hh:mm AM/PM';

      if (col.align) {
        cell.alignment = { horizontal: col.align, vertical: 'middle' };
      } else if (col.format === 'currency' || col.format === 'number' || col.format === 'integer' || col.format === 'percentage') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { vertical: 'middle' };
      }
    });

    row.height = 20;
  });

  // Cell borders
  dataSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < columnHeaderRowNum) return;
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  // === 2. Summary Sheet ===
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF10B981' } } // Emerald
  });

  summarySheet.mergeCells('A1:B1');
  const sumTitleCell = summarySheet.getCell('A1');
  sumTitleCell.value = `📊 ${definition.title} - Executive Summary`;
  sumTitleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  sumTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }
  };
  sumTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(1).height = 32;

  let currentSumRow = 3;

  const writeSumRow = (label: string, value: string | number | Date, isHeader = false) => {
    const row = summarySheet.getRow(currentSumRow++);
    row.getCell(1).value = label;
    row.getCell(2).value = value;

    if (isHeader) {
      row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    } else {
      row.getCell(1).font = { color: { argb: 'FF475569' } };
      row.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' } };
    }
    row.height = 22;
    return row;
  };

  writeSumRow('Export Information', '', true);
  writeSumRow('Shop Name', definition.metadata.shopName || 'Shop Inventory Ledger');
  writeSumRow('Generated By', definition.metadata.generatedBy);

  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const genAt = definition.metadata.generatedAt instanceof Date
    ? new Date(definition.metadata.generatedAt.getTime() + IST_OFFSET_MS)
    : definition.metadata.generatedAt;
  const dateRow = writeSumRow('Generated At', genAt);
  dateRow.getCell(2).numFmt = 'dd mmm yyyy hh:mm AM/PM';

  if (definition.metadata.filters && Object.keys(definition.metadata.filters).length > 0) {
    currentSumRow++;
    writeSumRow('Applied Filters', '', true);
    Object.entries(definition.metadata.filters).forEach(([k, v]) => {
      writeSumRow(k, v);
    });
  }

  if (definition.summary && definition.summary.length > 0) {
    currentSumRow++;
    writeSumRow('Key Inventory Indicators', '', true);
    definition.summary.forEach((item) => {
      let val = item.value;
      if (item.format === 'percentage') {
        const numVal = Number(val);
        if (!isNaN(numVal)) val = numVal / 100;
      }

      const row = writeSumRow(item.label, val);
      const valCell = row.getCell(2);

      if (item.format === 'currency') valCell.numFmt = '₹#,##0.00';
      if (item.format === 'integer') valCell.numFmt = '#,##0';
      if (item.format === 'number') {
        const numVal = Number(val);
        valCell.numFmt = !isNaN(numVal) && Number.isInteger(numVal) ? '#,##0' : '#,##0.00';
      }
      if (item.format === 'percentage') valCell.numFmt = '0.00%';

      valCell.font = { bold: true, color: { argb: 'FF0284C7' }, size: 11 };
    });
  }

  summarySheet.columns = [
    { width: 32 },
    { width: 44 }
  ];

  return Buffer.from(await workbook.xlsx.writeBuffer());
};
