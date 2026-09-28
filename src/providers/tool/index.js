function createToolProvider() {
  const provider = (process.env.TOOL_PROVIDER || 'ado').toLowerCase();

  if (provider === 'ado') {
    const AdoProvider = require('./adoProvider');
    return new AdoProvider();
  }

  if (provider === 'jira') {
    const JiraProvider = require('./jiraProvider');
    return new JiraProvider();
  }

  throw new Error(`Unknown TOOL_PROVIDER "${provider}". Valid values: ado, jira`);
}

module.exports = { createToolProvider };
