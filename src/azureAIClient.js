const axios = require('axios');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const ENDPOINT           = process.env.AZURE_OPENAI_ENDPOINT;
const API_KEY            = process.env.AZURE_OPENAI_KEY;
const INSTRUCTIONS_FILE  = path.join(__dirname, '..', 'testcase-instructions.md');

function loadInstructions() {
  if (fs.existsSync(INSTRUCTIONS_FILE)) {
    return fs.readFileSync(INSTRUCTIONS_FILE, 'utf8');
  }
  return 'Generate comprehensive test cases covering happy path, negative cases, and edge cases.';
}

async function generateTestCases(userStory) {
  const instructions = loadInstructions();

  const prompt = `You are a senior QA engineer. Based on the user story below, generate test cases following the instructions provided.

=== YOUR TEST CASE INSTRUCTIONS ===
${instructions}
=== END OF INSTRUCTIONS ===

=== USER STORY ===
Title: ${userStory.title}
Description: ${userStory.description}
Acceptance Criteria: ${userStory.acceptanceCriteria}
Discussion / Comments: ${userStory.discussion || 'No comments'}
=== END OF USER STORY ===

Important: treat the Discussion / Comments section as required context. BA clarifications, scope changes,
and decisions made in the comments must be reflected in the test cases — do not ignore them.

Return ONLY valid JSON in this exact format — no extra text, no markdown:
{
  "testCases": [
    {
      "title": "Test case title",
      "description": "Brief description of what is being tested",
      "steps": [
        {
          "action": "Step action the tester performs",
          "expected": "Expected result after this step"
        }
      ]
    }
  ]
}`;

  const res = await axios.post(
    ENDPOINT,
    {
      messages: [
        {
          role:    'system',
          content: 'You are an expert QA engineer. Output only valid JSON as instructed.',
        },
        {
          role:    'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens:  4000,
    },
    {
      headers: {
        'api-key':      API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  const raw = res.data.choices[0].message.content;

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI did not return valid JSON. Raw response:\n' + raw);

  const parsed = JSON.parse(match[0]);
  return parsed.testCases;
}

async function detectGaps(userStory) {
  const prompt = `You are a senior QA engineer reviewing a user story before writing test cases.

Analyse the user story below and identify any missing information that would prevent complete test cases from being written.
Look for: missing error messages, undefined field limits, unspecified user roles, vague acceptance criteria, unclear workflows, missing pre-conditions.

=== USER STORY ===
Title: ${userStory.title}
Description: ${userStory.description}
Acceptance Criteria: ${userStory.acceptanceCriteria}
Discussion / Comments: ${userStory.discussion || 'No comments'}
=== END OF USER STORY ===

Important: the Discussion / Comments section must be treated as required context alongside the
Acceptance Criteria. Gaps that appear in the AC but are clarified in the comments are NOT gaps.
Scope changes or decisions made in comments should influence your gap analysis.

Return ONLY valid JSON — no extra text, no markdown:
{
  "hasGaps": true,
  "gaps": [
    {
      "issue": "What is missing",
      "affects": "Which part of the story this impacts",
      "question": "Suggested question to raise with the BA"
    }
  ]
}

If there are no gaps return: { "hasGaps": false, "gaps": [] }`;

  const res = await axios.post(
    ENDPOINT,
    {
      messages: [
        {
          role:    'system',
          content: 'You are an expert QA engineer reviewing user stories for completeness. Output only valid JSON.',
        },
        {
          role:    'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens:  2000,
    },
    {
      headers: {
        'api-key':      API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  const raw   = res.data.choices[0].message.content;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { hasGaps: false, gaps: [] };

  return JSON.parse(match[0]);
}
// hhh

module.exports = { generateTestCases, detectGaps };
