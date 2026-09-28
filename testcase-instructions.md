# Test Case Instructions

Edit this file to control how the AI generates your test cases.
No coding needed — just write your requirements in plain English below.

The AI reads this file every time it runs.

---

## Format & Structure

- Each test case must have a clear, descriptive title starting with a verb (e.g. "Verify", "Validate", "Confirm", "Check")
- Write test steps in simple language that a junior tester can follow without any technical background
- Each step must have exactly one action and one expected result
- Keep steps short — one action per step, no combining multiple actions
- Steps should be numbered and sequential
- Minimum 3 steps per test case
- Test case steps should start with navigating to or logging into the application and end with logging out or verifying the final state

---
## User Story Coverage

### Required Context
- Always read and consider all four sections of the user story before generating tests: **Title**, **Description**, **Acceptance Criteria**, and **Discussion / Comments**
- The Discussion section contains BA clarifications, scope decisions, and change notes — treat it as equally important as the Acceptance Criteria
- If an AC item appears vague but is clarified in the Discussion, use the discussion clarification — do not raise it as a gap
- If a scope change or edge case is mentioned in the Discussion, it must have at least one test case even if it is not listed in the AC
- Note any discussion points used to inform test cases by adding a `[Discussion]` tag to the relevant test case title

### Pre-Generation Validation
*(All checks below must be completed before any test cases are written)*

#### Story Validation
- If the user story does not follow the format "As a [role], I want [goal], so that [benefit]" — highlight this and ask the user to confirm or correct it
- If acceptance criteria is missing entirely — show a warning message and do not proceed
- If AC items use vague language ("quickly", "easily", "appropriately") — flag each one and ask for a measurable definition before generating tests
- If the story has no title or is a duplicate of an existing story — warn the user before proceeding
- Ask clarifying questions if the user story is incomplete or missing any cases

#### Gap Detection & BA Highlighting
- After reading the user story, identify and list all missing details that would be needed to write complete tests (e.g. missing error messages, undefined field limits, unspecified roles, unclear workflows)
- Display a clearly labelled warning block titled **"⚠ Story Gaps — Action Required"** listing each gap as a numbered item
- Each gap item must include: what is missing, which part of the story it affects, and a suggested question the user can raise with the BA
- After listing gaps, test case generation will pause and wait for the QA lead to confirm before continuing (handled automatically by the agent)

---

### Traceability
- Each test case must reference the specific acceptance criterion it covers, e.g. `[AC1]`, `[AC2]`
- If a test case covers multiple AC items, list all references (e.g. `[AC1, AC3]`)
- No test case should exist without a traceable AC — if one cannot be linked, flag it

### Coverage Completeness
- Every acceptance criterion must have at least one Happy Path test case
- Every AC item that involves user input or data must also have a Negative test case
- Before finalising, produce a simple coverage summary table: AC item | Test Case count | Types covered
- Do not consider a user story done until all AC items appear in the summary table

### Multi-Role / Persona Handling
- If a story involves more than one user role, generate a separate test case set for each role
- Clearly label each set with the role name (e.g. `[Admin]`, `[Read-Only User]`)
- Include a Permission test case for every role combination mentioned in the AC

### Definition of "Complete" Coverage
- Coverage is only complete when: all AC items are traced, all required test types are present (Happy Path minimum), and the coverage summary table shows no gaps
- If any AC item has zero test cases, block generation and prompt the user to resolve the gap first

## Test Case Coverage

For every user story, always generate the following types:

1. **Happy Path** — the normal successful flow where everything works as expected
2. **Negative Test** — what happens when the user enters wrong or invalid data
3. **Boundary / Edge Case** — empty fields, maximum character limits, special characters
4. **UI Validation** — check labels, buttons, error messages are displayed correctly
5. **Permission / Role based** — if the story involves user roles or access levels

---

## Priority & Severity

- Assign priority: High / Medium / Low based on business impact
- Happy path = High
- Negative cases = Medium
- Edge cases = Low

---

## Test Data Guidelines

- Use realistic but fictional test data (e.g. "John Smith", "test@example.com", not "aaa" or "123")
- For date fields use format DD/MM/YYYY
- For numeric fields always test: zero, negative number, maximum allowed value

---

## Language & Tone

- Write in British English
- Use "the user" not "I" or "the tester"
- Action: start with a verb — "Enter", "Click", "Select", "Navigate to", "Submit"
- Expected result: start with — "The system should", "The page should", "An error message should"

---

## What NOT to do

- Do not include implementation details (no SQL, no API calls, no code)
- Do not write steps that assume developer knowledge
- Do not repeat the same step in different test cases word for word

---

## Example of a good test case

**Title:** Verify successful login with valid credentials

**Steps:**
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to the login page | The login page is displayed with Username and Password fields |
| 2 | Enter a valid username "john.smith@example.com" | The username is accepted and displayed in the field |
| 3 | Enter the correct password | The password is masked and accepted |
| 4 | Click the "Login" button | The user is redirected to the dashboard |
| 5 | Check the page header | The user's name is displayed in the top-right corner |

---

## Example of a good negative test case

**Title:** Verify error message when logging in with incorrect password

**Steps:**
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to the login page | The login page is displayed |
| 2 | Enter a valid username "john.smith@example.com" | The username is accepted |
| 3 | Enter an incorrect password "WrongPass123" | The password is masked |
| 4 | Click the "Login" button | An error message "Invalid username or password" is displayed in red |
| 5 | Check that the user remains on the login page | The login page is still displayed and no dashboard is shown |
