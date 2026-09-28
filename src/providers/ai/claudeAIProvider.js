const Anthropic = require('@anthropic-ai/sdk');
const fs        = require('fs');
const path      = require('path');

const INSTRUCTIONS_FILE = path.join(__dirname, '..', '..', '..', 'testcase-instructions.md');
const GUARDRAILS_FILE   = path.join(__dirname, '..', '..', '..', 'security-guardrails.md');

function loadInstructions() {
  if (fs.existsSync(INSTRUCTIONS_FILE)) {
    return fs.readFileSync(INSTRUCTIONS_FILE, 'utf8');
  }
  return 'Generate comprehensive test cases covering happy path, negative cases, and edge cases.';
}

function loadGuardrails() {
  if (fs.existsSync(GUARDRAILS_FILE)) {
    return fs.readFileSync(GUARDRAILS_FILE, 'utf8');
  }
  return '';
}

class ClaudeAIProvider {
  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model  = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
  }

  async _chat(system, userPrompt, maxTokens) {
    const message = await this.client.messages.create({
      model:      this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });
    return message.content[0].text;
  }

  async generateTestCases(userStory) {
    const instructions = loadInstructions();

    const userPrompt = `You are a senior QA engineer. Based on the user story below, generate test cases following the instructions provided.

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

    const guardrails = loadGuardrails();
    const raw   = await this._chat(`You are an expert QA engineer. Output only valid JSON as instructed.\n\n${guardrails}`, userPrompt, 4000);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI did not return valid JSON. Raw response:\n' + raw);
    return JSON.parse(match[0]).testCases;
  }

  async detectGaps(userStory) {
    const userPrompt = `You are a senior QA engineer reviewing a user story before writing test cases.

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

    const guardrails = loadGuardrails();
    const raw   = await this._chat(`You are an expert QA engineer reviewing user stories for completeness. Output only valid JSON.\n\n${guardrails}`, userPrompt, 2000);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { hasGaps: false, gaps: [] };
    return JSON.parse(match[0]);
  }
}

module.exports = ClaudeAIProvider;
