# AI Test Case Generator & Uploader

> **Generate test cases with any AI. Push to any tool. Switch providers with one line in your `.env`.**

Stop writing test cases manually. Point this agent at your user stories — in **Azure DevOps (ADO)** or **JIRA** — and let **Azure OpenAI** or **Claude (Anthropic)** generate them for you. Review in Excel, then upload with a single command.

---

## How it works

```
Fill in stories-input.xlsx with your story IDs
                  ↓
         node src/index.js
                  ↓
   Reads each story from ADO or JIRA
   (title, description, acceptance criteria, comments)
                  ↓
   Detects gaps → saves to story-gaps.md for BA review
                  ↓
   Generates test cases using Azure OpenAI or Claude
   (following your custom instructions in testcase-instructions.md)
   (protected by security-guardrails.md)
                  ↓
   Writes test cases to test-cases-output.xlsx
   (one sheet per story)
                  ↓
   "Open the file, verify — type 'upload' when ready"
                  ↓
   Creates test cases in ADO or JIRA
   Links each one back to its source story
```

---

## Prerequisites

| Requirement | Where to get it |
|---|---|
| Node.js (LTS) | https://nodejs.org |
| **ADO** — Personal Access Token | ADO → Profile → Personal Access Tokens |
| **JIRA** — API Token | https://id.atlassian.com → Security → API tokens |
| **Azure OpenAI** — API Key | Azure Portal → Cognitive Services → Keys and Endpoints |
| **Claude** — API Key | https://console.anthropic.com → API Keys |

**ADO PAT permissions needed:**
- Work Items → Read & Write
- Test Management → Read & Write

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create your `.env` file

Copy `.env.example` to `.env` and fill in the values for the providers you want to use.

```bash
cp .env.example .env
```

**Minimum required variables (ADO + Azure OpenAI — the defaults):**
```
AI_PROVIDER=azure
TOOL_PROVIDER=ado

AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_KEY=your-azure-openai-key

ADO_ORG_URL=https://yourorg.visualstudio.com
ADO_PROJECT=YourProject
ADO_PAT=your-ado-pat
```

**To use Claude instead of Azure OpenAI:**
```
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**To use JIRA instead of ADO:**
```
TOOL_PROVIDER=jira
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=you@yourorg.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=PROJ
```

See `.env.example` for all available options.

> Never commit `.env` to Git — it is already in `.gitignore`

---

## How to run

### Step 1 — Add your story IDs to the input file

Open **`stories-input.xlsx`** and enter your story IDs in Column A (one per row, starting from row 2).
The file is created automatically as a template on first run if it does not exist.

**For ADO** — enter numeric work item IDs:

| Story ID |
|----------|
| 51287    |
| 51290    |

**For JIRA** — enter issue keys:

| Story ID |
|----------|
| PROJ-123 |
| PROJ-124 |

### Step 2 — Run the agent

```bash
node src/index.js
```

### Step 3 — Review the output Excel

The agent writes test cases to **`test-cases-output.xlsx`** — one sheet per story (e.g. `US-51287`).
Open the file, verify the test cases, then return to the terminal.

### Step 4 — Confirm upload

```
  Type 'upload' to push to ADO or 'noupload' to exit:
```

- `upload` — creates all test cases in your tool and links them to their stories
- `noupload` — exits without uploading; run again later to upload

---

## Configuration files

All customisation lives in plain files — no code changes needed.

| File | What it controls |
|---|---|
| `.env` | Credentials and provider selection |
| `input.json` | Area path (ADO) or component (JIRA) applied to every test case |
| `testcase-instructions.md` | How the AI writes test cases — style, coverage types, format |
| `security-guardrails.md` | Prompt injection protection rules |

### input.json

**For ADO:**
```json
{
  "areaPath": "YourProject\\Your Team"
}
```

**For JIRA:**
```json
{
  "component": "Your Component Name"
}
```

> Backslashes in ADO area paths must be doubled in JSON: `"Team\\Sub Team"` not `"Team\Sub Team"`

### testcase-instructions.md

Edit this file to control how the AI writes test cases — test types to include, language, format, coverage rules. The AI reads it fresh on every run so changes take effect immediately.

### security-guardrails.md

Contains rules that protect against prompt injection — where malicious text inside a user story tries to hijack the AI. Built-in rules cover the most common attack patterns. Add your own rules in the `## Custom Rules` section at the bottom without touching any code.

---

## Project structure

```
test-case-agent/
├── .env                        ← your credentials (never commit this)
├── .env.example                ← template showing all available env vars
├── .gitignore
├── input.json                  ← area path (ADO) or component (JIRA)
├── stories-input.xlsx          ← enter your story IDs here (Column A)
├── test-cases-output.xlsx      ← generated test cases (created/updated on each run)
├── story-gaps.md               ← gap log for BA review (appended on each run)
├── package.json
├── README.md
├── testcase-instructions.md    ← edit to control how AI writes test cases
├── security-guardrails.md      ← prompt injection protection rules
└── src/
    ├── index.js                ← entry point — run this
    ├── formatter.js            ← converts steps to ADO XML format
    ├── excelReader.js          ← reads story IDs from stories-input.xlsx
    ├── excelWriter.js          ← writes test cases to test-cases-output.xlsx
    └── providers/
        ├── ai/
        │   ├── index.js        ← AI provider factory (reads AI_PROVIDER)
        │   ├── azureAIProvider.js  ← Azure OpenAI implementation
        │   └── claudeAIProvider.js ← Claude / Anthropic implementation
        └── tool/
            ├── index.js        ← tool provider factory (reads TOOL_PROVIDER)
            ├── adoProvider.js  ← Azure DevOps implementation
            └── jiraProvider.js ← JIRA implementation
```

---

## Adding a new AI or tool provider

The agent uses a provider pattern — each AI and tool integration is a self-contained class.

**To add a new AI provider** (e.g. Google Gemini):
1. Create `src/providers/ai/geminiProvider.js` with `generateTestCases(story)` and `detectGaps(story)` methods
2. Add a case for `'gemini'` in `src/providers/ai/index.js`
3. Set `AI_PROVIDER=gemini` in `.env`

**To add a new tool provider** (e.g. ServiceNow):
1. Create `src/providers/tool/serviceNowProvider.js` with `getUserStory(id)`, `createTestCase(...)`, and `linkTestCaseToStory(...)` methods
2. Add a case for `'servicenow'` in `src/providers/tool/index.js`
3. Set `TOOL_PROVIDER=servicenow` in `.env`

---

## Troubleshooting

| Error | Likely cause | Fix |
|---|---|---|
| `401 Unauthorized` | Wrong or expired credentials | Regenerate your PAT (ADO) or API token (JIRA/Claude/Azure) |
| `403 Forbidden` | Missing permissions | ADO: ensure Work Items + Test Management are enabled on the PAT |
| `AI did not return valid JSON` | Unexpected AI response | Check your API key and endpoint in `.env` |
| `Unknown AI_PROVIDER` | Typo in `.env` | Valid values: `azure`, `claude` |
| `Unknown TOOL_PROVIDER` | Typo in `.env` | Valid values: `ado`, `jira` |
| `Cannot find module` | Dependencies not installed | Run `npm install` |
| `ECONNREFUSED` | Network or firewall issue | Check VPN or network access to your ADO/JIRA instance |
| `SyntaxError in JSON` | Backslash not doubled in `input.json` | Use `\\` not `\` in area path |

---

## Security notes

- `.env` is excluded from Git via `.gitignore` — never commit it
- User story content is treated as untrusted external data — `security-guardrails.md` is injected into every AI call to prevent prompt injection
- No story data is sent to any service outside the providers configured in your `.env`
