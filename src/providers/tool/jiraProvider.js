const axios = require('axios');

// Recursively extracts plain text from an Atlassian Document Format (ADF) node.
// JIRA Cloud stores rich-text fields (description, acceptance criteria) in ADF.
function adfToText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (!node.content) return '';
  const children = node.content.map(adfToText).join('');
  const block    = ['paragraph', 'heading', 'listItem', 'tableCell'].includes(node.type);
  return block ? children + '\n' : children;
}

// Builds an ADF "doc" node containing a description paragraph followed by a step table.
function buildAdfDescription(description, steps) {
  const tableRows = [
    // Header row
    {
      type: 'tableRow',
      content: [
        adfTableHeader('#'),
        adfTableHeader('Action'),
        adfTableHeader('Expected Result'),
      ],
    },
    // Step rows
    ...steps.map((step, i) => ({
      type: 'tableRow',
      content: [
        adfTableCell(String(i + 1)),
        adfTableCell(step.action),
        adfTableCell(step.expected),
      ],
    })),
  ];

  const content = [];

  if (description) {
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: description }],
    });
  }

  content.push(
    {
      type:    'heading',
      attrs:   { level: 3 },
      content: [{ type: 'text', text: 'Test Steps' }],
    },
    {
      type:    'table',
      attrs:   { isNumberColumnEnabled: false },
      content: tableRows,
    }
  );

  return { type: 'doc', version: 1, content };
}

function adfTableHeader(text) {
  return {
    type:    'tableHeader',
    attrs:   {},
    content: [{
      type:    'paragraph',
      content: [{ type: 'text', text, marks: [{ type: 'strong' }] }],
    }],
  };
}

function adfTableCell(text) {
  return {
    type:    'tableCell',
    attrs:   {},
    content: [{
      type:    'paragraph',
      content: [{ type: 'text', text }],
    }],
  };
}

class JiraProvider {
  constructor() {
    this.baseUrl       = process.env.JIRA_BASE_URL;          // e.g. https://yourorg.atlassian.net
    this.email         = process.env.JIRA_EMAIL;             // Atlassian account email
    this.apiToken      = process.env.JIRA_API_TOKEN;         // API token from id.atlassian.com
    this.projectKey    = process.env.JIRA_PROJECT_KEY;       // e.g. PROJ
    this.testIssueType = process.env.JIRA_TEST_ISSUE_TYPE || 'Test';
    this.linkType      = process.env.JIRA_LINK_TYPE        || 'Tests';
    this.acField       = process.env.JIRA_AC_FIELD         || 'customfield_10016';

    const token    = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
    this.headers   = {
      Authorization:  `Basic ${token}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    };
  }

  async getUserStory(issueKey) {
    const [issueRes, commentsRes] = await Promise.all([
      axios.get(`${this.baseUrl}/rest/api/3/issue/${issueKey}`, { headers: this.headers }),
      axios.get(`${this.baseUrl}/rest/api/3/issue/${issueKey}/comment`, { headers: this.headers })
        .catch(() => ({ data: { comments: [] } })),
    ]);

    const f = issueRes.data.fields;

    // Description and AC may be ADF objects or plain strings depending on JIRA version
    const description        = typeof f.description === 'object'
      ? adfToText(f.description).trim()
      : (f.description || '');

    const acceptanceCriteria = typeof f[this.acField] === 'object'
      ? adfToText(f[this.acField]).trim()
      : (f[this.acField] || '');

    const comments   = commentsRes.data.comments || [];
    const discussion = comments
      .map(c => {
        const author = c.author?.displayName || 'Unknown';
        const date   = new Date(c.created).toLocaleDateString('en-GB');
        const body   = typeof c.body === 'object' ? adfToText(c.body).trim() : (c.body || '');
        return `[${author} on ${date}]: ${body}`;
      })
      .join('\n\n');

    return {
      id:                 issueKey,
      title:              f.summary                    || '',
      description,
      acceptanceCriteria,
      state:              f.status?.name               || '',
      discussion:         discussion || '',
    };
  }

  async createTestCase(title, steps, description, component) {
    const body = {
      fields: {
        project:     { key: this.projectKey },
        summary:     title,
        description: buildAdfDescription(description, steps),
        issuetype:   { name: this.testIssueType },
      },
    };

    if (component) {
      body.fields.components = [{ name: component }];
    }

    const res = await axios.post(`${this.baseUrl}/rest/api/3/issue`, body, {
      headers: this.headers,
    });

    return res.data.key; // Returns JIRA issue key, e.g. "PROJ-456"
  }

  async linkTestCaseToStory(testCaseKey, storyKey) {
    await axios.post(
      `${this.baseUrl}/rest/api/3/issueLink`,
      {
        type:         { name: this.linkType },
        inwardIssue:  { key: testCaseKey },
        outwardIssue: { key: storyKey },
      },
      { headers: this.headers }
    );
  }
}

module.exports = JiraProvider;
