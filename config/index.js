// config/index.js

const config = {
  // File handling
  maxFileSize: 25 * 1024 * 1024, 
  maxBatchSize: 100,
  batchConcurrency: 5, 
  supportedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/tiff',
    'image/bmp',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/html',
    'text/plain',
    'text/markdown',
    'application/json',
    'application/xml',
    'text/xml',
    'application/zip',
    'application/x-zip-compressed'
  ],

  // AI Provider Configuration (model-agnostic)
  ai: {
    // Current active provider: 'openai' | 'anthropic' | 'google' | 'azure'
    provider: process.env.AI_PROVIDER || 'openai',

    // OpenAI
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4096,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
    },

    // Anthropic Claude
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS) || 4096,
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE) || 0.1,
    },

    // Google Gemini
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
      model: process.env.GOOGLE_MODEL || 'gemini-1.5-pro',
      maxTokens: parseInt(process.env.GOOGLE_MAX_TOKENS) || 4096,
      temperature: parseFloat(process.env.GOOGLE_TEMPERATURE) || 0.1,
    },

    // Azure OpenAI
    azure: {
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-06-01',
      maxTokens: parseInt(process.env.AZURE_MAX_TOKENS) || 4096,
      temperature: parseFloat(process.env.AZURE_TEMPERATURE) || 0.1,
    },
  },

  // Supabase (for batch queue persistence if needed)
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  // Netlify function timeout (seconds)
  functionTimeout: 26,
};

module.exports = config;