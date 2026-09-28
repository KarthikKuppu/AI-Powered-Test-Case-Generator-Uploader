/**
 * index.js — Entry point for the Test Case Agent
 *
 * Flow:
 *   1. Read story/issue IDs from stories-input.xlsx
 *   2. For each story:
 *        a. Fetch story details from the configured tool (ADO or JIRA)
 *        b. Detect gaps — display warning + save to story-gaps.md
 *        c. Generate test cases via the configured AI provider (Azure OpenAI or Claude)
 *        d. Write test cases to test-cases-output.xlsx (one sheet per story)
 *   3. Display summary and prompt to upload
 *   4. If confirmed: create each test case in the tool and link it to the source story
 *
 * Configuration (via .env):
 *   AI_PROVIDER   — "azure" (default) or "claude"
 *   TOOL_PROVIDER — "ado" (default) or "jira"
 *
 * How to run:
 *   node src/index.js
 */

require('dotenv').config();

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const { createAIProvider }   = require('./providers/ai');
const { createToolProvider } = require('./providers/tool');
const { readStoryIds }       = require('./excelReader');
const { writeStorySheet, getOutputPath } = require('./excelWriter');

// ── Config ───────────────────────────────────────────────────────────────────

const inputPath = path.join(__dirname, '..', 'input.json');
const input     = fs.existsSync(inputPath) ? JSON.parse(fs.readFileSync(inputPath, 'utf8')) : {};

// ADO uses "areaPath", JIRA uses "component" — read whichever is set
const toolProvider = (process.env.TOOL_PROVIDER || 'ado').toLowerCase();
const areaPath     = toolProvider === 'jira'
  ? (input.component || null)
  : (input.areaPath   || null);

const GAPS_FILE = path.join(__dirname, '..', 'story-gaps.md');

// ── Helpers ──────────────────────────────────────────────────────────────────

function prompt(message) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function saveGapsToFile(story, gaps) {
  const date  = new Date().toLocaleDateString('en-GB');
  let   entry = `\n---\n\n## Story #${story.id} — "${story.title}"\n**Detected:** ${date}\n\n`;

  gaps.forEach((gap, i) => {
    entry += `**${i + 1}. Missing:** ${gap.issue}\n`;
    entry += `   **Affects:** ${gap.affects}\n`;
    entry += `   **Question for BA:** ${gap.question}\n\n`;
  });

  fs.appendFileSync(GAPS_FILE, entry, 'utf8');
}

function displayGaps(storyTitle, gaps) {
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log(`  ║   ⚠  Story Gaps — "${storyTitle.substring(0, 38)}"`);
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  gaps.forEach((gap, i) => {
    console.log(`  ${i + 1}. Missing : ${gap.issue}`);
    console.log(`     Affects : ${gap.affects}`);
    console.log(`     Ask BA  : ${gap.question}\n`);
  });

  console.log('  Gaps saved to story-gaps.md — continuing to generate test cases.\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const ai   = createAIProvider();
  const tool = createToolProvider();

  const aiLabel   = (process.env.AI_PROVIDER   || 'azure').toUpperCase();
  const toolLabel = (process.env.TOOL_PROVIDER || 'ado').toUpperCase();

  console.log(`\n--- Test Case Agent [AI: ${aiLabel} | Tool: ${toolLabel}] ---\n`);

  // ── Step 1: Read story IDs ───────────────────────────────────────────────
  console.log('[1] Reading story IDs from stories-input.xlsx...');
  const storyIds = await readStoryIds();
  console.log(`    Found ${storyIds.length} story/stories: ${storyIds.join(', ')}\n`);

  const allResults = {};
  const sheetNames = [];

  // ── Step 2: Process each story ───────────────────────────────────────────
  for (let i = 0; i < storyIds.length; i++) {
    const storyId = storyIds[i];
    console.log(`[Story ${i + 1}/${storyIds.length}] Processing #${storyId}`);

    console.log(`    Fetching from ${toolLabel}...`);
    const story = await tool.getUserStory(storyId);
    console.log(`    Title : "${story.title}"`);
    console.log(`    State : ${story.state}`);

    console.log(`    Analysing for gaps...`);
    const gapResult = await ai.detectGaps(story);

    if (gapResult.hasGaps && gapResult.gaps.length > 0) {
      displayGaps(story.title, gapResult.gaps);
      saveGapsToFile(story, gapResult.gaps);
    } else {
      console.log('    No gaps detected — story looks complete');
    }

    console.log(`    Generating test cases via ${aiLabel}...`);
    const testCases = await ai.generateTestCases(story);
    console.log(`    Generated ${testCases.length} test case(s)`);

    console.log(`    Writing to Excel...`);
    const sheetName = await writeStorySheet(story, testCases, areaPath);
    sheetNames.push(sheetName);

    allResults[storyId] = { story, testCases };
    console.log(`    Done — sheet "${sheetName}" written\n`);
  }

  // ── Step 3: Summary ──────────────────────────────────────────────────────
  const outputPath = getOutputPath();

  console.log('══════════════════════════════════════════════════════');
  console.log('  Test cases generated successfully!\n');
  console.log(`  Sheets created : ${sheetNames.join(', ')}`);
  console.log(`  Output file    : ${outputPath}`);
  if (sheetNames.length > 0) {
    console.log('\n  Open the file, verify the test cases, then come back here.');
  }
  console.log('══════════════════════════════════════════════════════\n');

  // ── Step 4: Upload prompt ────────────────────────────────────────────────
  const answer = await prompt(`  Type 'upload' to push to ${toolLabel} or 'noupload' to exit: `);

  if (answer !== 'upload') {
    console.log('\n  Exiting — no test cases uploaded. Run again to upload when ready.\n');
    process.exit(0);
  }

  // ── Step 5: Upload ───────────────────────────────────────────────────────
  console.log(`\n[Uploading to ${toolLabel}...]\n`);

  for (const storyId of storyIds) {
    const { story, testCases } = allResults[storyId];
    console.log(`  Story #${storyId} — "${story.title}"`);

    for (let i = 0; i < testCases.length; i++) {
      const tc   = testCases[i];
      const tcId = await tool.createTestCase(tc.title, tc.steps, tc.description, areaPath);
      await tool.linkTestCaseToStory(tcId, storyId);

      console.log(`    [${i + 1}/${testCases.length}] Created #${tcId}: "${tc.title}"`);
    }

    console.log('');
  }

  const totalCount = Object.values(allResults).reduce((sum, r) => sum + r.testCases.length, 0);
  console.log(`Done — ${totalCount} test case(s) uploaded and linked across ${storyIds.length} story/stories.\n`);
}

run().catch(err => {
  const detail = err.response?.data || err.message;
  console.error('\nError:', JSON.stringify(detail, null, 2));
  process.exit(1);
});
