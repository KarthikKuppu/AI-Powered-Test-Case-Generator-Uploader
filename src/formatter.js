/**
 * formatter.js — Converts AI-generated test steps into ADO's XML format
 *
 * ADO stores test case steps as a specific XML string in the field
 * Microsoft.VSTS.TCM.Steps. This file builds that XML from the plain
 * step objects that the AI returns.
 *
 * Expected input shape (one element per step):
 *   { action: "Click the Login button", expected: "The user is redirected to the dashboard" }
 *
 * Output shape (the XML string stored in ADO):
 *   <steps id="0" last="N">
 *     <step id="1" type="ActionStep">
 *       <parameterizedString isformatted="true">...action HTML...</parameterizedString>
 *       <parameterizedString isformatted="true">...expected HTML...</parameterizedString>
 *       <description/>
 *     </step>
 *     ...
 *   </steps>
 */

/**
 * Escapes special XML characters in a string so it can be safely embedded in XML.
 *
 * ADO will reject or corrupt steps if raw characters like < > & " ' appear in
 * the action or expected result text, so every user-supplied value must be escaped
 * before being placed inside the XML.
 *
 * @param {string} text - Raw text from the AI (action or expected result)
 * @returns {string} - Text safe to embed directly inside an XML element
 */
function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')   // Must be first — replacing & before other chars avoids double-escaping
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts an array of step objects into the XML string ADO expects for test steps.
 *
 * Each step has two "parameterizedString" elements:
 *   [0] — the action the tester should perform
 *   [1] — the expected result after performing the action
 *
 * The inner HTML (DIV > P wrapping) is required by ADO to render the step text
 * correctly in the Test Case UI. The HTML tags themselves are XML-entity-encoded
 * (&lt;DIV&gt; etc.) because they live inside an XML attribute value.
 *
 * @param {Array<{action: string, expected: string}>} steps - Steps from the AI response
 * @returns {string} - Complete XML string ready to POST to ADO's TCM.Steps field
 */
function toADOSteps(steps) {
  // The root <steps> element; "last" is the total step count (used by ADO internally)
  let xml = `<steps id="0" last="${steps.length}">`;

  steps.forEach((step, index) => {
    // id is 1-based; type="ActionStep" means this is a regular action+result step
    // (ADO also supports "ValidateStep" but ActionStep covers all our use cases)
    xml += `
  <step id="${index + 1}" type="ActionStep">
    <parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;${escapeXml(step.action)}&lt;/P&gt;&lt;/DIV&gt;</parameterizedString>
    <parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;${escapeXml(step.expected)}&lt;/P&gt;&lt;/DIV&gt;</parameterizedString>
    <description/>
  </step>`;
  });

  xml += `\n</steps>`;
  return xml;
}

module.exports = { toADOSteps };
