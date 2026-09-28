/**
 * excelReader.js — Reads user story IDs from the input Excel file
 *
 * Expected file: stories-input.xlsx (in the project root)
 * Expected format:
 *   Row 1  — Header row  (ignored)
 *   Row 2+ — Column A contains the ADO User Story work item ID (numeric)
 *
 * Example:
 *   | Story ID |
 *   | 51287    |
 *   | 51290    |
 *
 * If the file does not exist, this module creates a blank template so
 * the user knows exactly what format to fill in.
 */

const ExcelJS = require('exceljs');
const fs      = require('fs');
const path    = require('path');

const TEMPLATE_PATH = path.join(__dirname, '..', 'stories-input.xlsx');

/**
 * Creates a blank stories-input.xlsx template if one does not already exist.
 * Call this on first run so the user has a ready-made file to fill in.
 */
async function createInputTemplateIfMissing() {
  if (fs.existsSync(TEMPLATE_PATH)) return;

  const workbook = new ExcelJS.Workbook();
  const sheet    = workbook.addWorksheet('Stories');

  // Header row
  sheet.columns = [{ header: 'Story ID', key: 'storyId', width: 16 }];

  // Style the header so it is obvious
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };

  // Add two placeholder rows to show the expected format
  sheet.addRow({ storyId: 51287 });
  sheet.addRow({ storyId: 51290 });

  await workbook.xlsx.writeFile(TEMPLATE_PATH);
  console.log('\n  ✔ Created stories-input.xlsx — fill in your ADO story IDs (Column A) and re-run.\n');
  process.exit(0); // Stop here so the user fills in the file before continuing
}

/**
 * Safely extracts a plain scalar value from an ExcelJS cell value.
 *
 * ExcelJS can return cell values as objects in several cases:
 *   - Formula cell:  { formula: '...', result: 51287 }
 *   - Rich text:     { richText: [{ text: '51287' }, ...] }
 *   - Hyperlink:     { text: '51287', hyperlink: '...' }
 *
 * Passing any of these directly to the ADO URL produces "[object Object]",
 * causing a 404. This helper unwraps the actual value in each case.
 *
 * @param {*} raw - The raw cell.value from ExcelJS
 * @returns {string|number|null} - The extracted plain value, or null if unreadable
 */
function extractCellValue(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return raw;                              // Already a plain value

  if (raw.result    !== undefined) return raw.result;                   // Formula cell
  if (Array.isArray(raw.richText)) return raw.richText.map(r => r.text).join(''); // Rich text
  if (raw.text      !== undefined) return raw.text;                     // Hyperlink

  return null; // Unrecognised object shape — treat as blank
}

/**
 * Reads all story IDs from stories-input.xlsx.
 * Skips the header row and any blank cells.
 *
 * @returns {Promise<string[]>} Array of story ID strings (e.g. ["51287", "51290"])
 */
async function readStoryIds() {
  await createInputTemplateIfMissing();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  // Always read from the first sheet regardless of its name
  const sheet    = workbook.worksheets[0];
  const storyIds = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const cell      = row.getCell(1); // Column A
    const extracted = extractCellValue(cell.value);

    // Skip blank rows — the user may have left gaps between entries
    if (extracted !== null && String(extracted).trim() !== '') {
      storyIds.push(String(extracted).trim());
    }
  });

  if (storyIds.length === 0) {
    console.error('\n  ✖ stories-input.xlsx has no story IDs. Add them to Column A (from row 2) and re-run.\n');
    process.exit(1);
  }

  return storyIds;
}

module.exports = { readStoryIds };
