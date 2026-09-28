/**
 * excelWriter.js — Writes generated test cases to an Excel output file
 *
 * Output file: test-cases-output.xlsx (in the project root)
 *
 * Behaviour:
 *   - If the file already exists, existing sheets are kept and new sheets are appended
 *   - If a sheet for the same story ID already exists, it is replaced (re-generation)
 *   - Each user story gets its own sheet named "US-{storyId}"
 *
 * Output columns (matching ADO's own test case import/export format):
 *   ID | Work Item Type | Title | Test Step | Step Action | Step Expected | Area Path | Assigned To | State
 *
 * One row is written per step per test case.
 * The test case Title is repeated on every step row so the file is easy to filter.
 */

const ExcelJS = require('exceljs');
const path    = require('path');
const fs      = require('fs');

const OUTPUT_PATH = path.join(__dirname, '..', 'test-cases-output.xlsx');

// Column definitions — keys match the row object properties added below
const COLUMNS = [
  { header: 'ID',             key: 'id',           width: 12 },
  { header: 'Work Item Type', key: 'workItemType',  width: 18 },
  { header: 'Title',          key: 'title',         width: 45 },
  { header: 'Test Step',      key: 'testStep',      width: 12 },
  { header: 'Step Action',    key: 'stepAction',    width: 55 },
  { header: 'Step Expected',  key: 'stepExpected',  width: 55 },
  { header: 'Area Path',      key: 'areaPath',      width: 32 },
  { header: 'Assigned To',    key: 'assignedTo',    width: 24 },
  { header: 'State',          key: 'state',         width: 12 },
];

/**
 * Applies consistent header row styling to a worksheet.
 * Blue background, white bold text — matches ADO's own export style.
 *
 * @param {ExcelJS.Worksheet} sheet
 */
function styleHeaderRow(sheet) {
  const headerRow  = sheet.getRow(1);
  headerRow.font   = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  headerRow.height = 18;
  headerRow.alignment = { vertical: 'middle' };
}

/**
 * Writes or replaces a sheet of test cases for one User Story.
 * Loads the existing output file (if any) before writing so other story sheets are preserved.
 *
 * @param {object} story      - Story object: { id, title, state, areaPath }
 * @param {Array}  testCases  - Array of { title, description, steps: [{ action, expected }] }
 * @param {string|null} areaPath - Area path from input.json (applied to every row)
 * @returns {Promise<string>} - The sheet name that was written
 */
async function writeStorySheet(story, testCases, areaPath) {
  const workbook = new ExcelJS.Workbook();

  // Load existing file to preserve sheets from previous stories
  if (fs.existsSync(OUTPUT_PATH)) {
    await workbook.xlsx.readFile(OUTPUT_PATH);
  }

  // Sheet name: "US-{id}" — Excel sheet names are limited to 31 characters
  const sheetName = `US-${story.id}`.substring(0, 31);

  // Remove the sheet if it already exists (allows re-generation without duplicates)
  const existing = workbook.getWorksheet(sheetName);
  if (existing) workbook.removeWorksheet(existing.id);

  const sheet    = workbook.addWorksheet(sheetName);
  sheet.columns  = COLUMNS;
  styleHeaderRow(sheet);

  // Write one row per step per test case
  // The Title column is repeated on every row so filtering by test case works naturally
  testCases.forEach(tc => {
    tc.steps.forEach((step, stepIndex) => {
      sheet.addRow({
        id:           '',                    // Blank until the test case is uploaded to ADO
        workItemType: 'Test Case',
        title:        tc.title,             // Repeated on every step row
        testStep:     stepIndex + 1,        // 1-based step number
        stepAction:   step.action,
        stepExpected: step.expected,
        areaPath:     areaPath || '',
        assignedTo:   '',                   // Left blank — assign in ADO after review
        state:        'Design',             // ADO default state for new test cases
      });
    });
  });

  // Freeze the header row so it stays visible when scrolling
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  await workbook.xlsx.writeFile(OUTPUT_PATH);
  return sheetName;
}

/**
 * Returns the path to the output Excel file so callers can display it to the user.
 */
function getOutputPath() {
  return OUTPUT_PATH;
}

module.exports = { writeStorySheet, getOutputPath };
