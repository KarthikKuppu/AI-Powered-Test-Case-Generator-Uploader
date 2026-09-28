function createAIProvider() {
  const provider = (process.env.AI_PROVIDER || 'azure').toLowerCase();

  if (provider === 'azure') {
    const AzureAIProvider = require('./azureAIProvider');
    return new AzureAIProvider();
  }

  if (provider === 'claude') {
    const ClaudeAIProvider = require('./claudeAIProvider');
    return new ClaudeAIProvider();
  }

  throw new Error(`Unknown AI_PROVIDER "${provider}". Valid values: azure, claude`);
}

module.exports = { createAIProvider };
