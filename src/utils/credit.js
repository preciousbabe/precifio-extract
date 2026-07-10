// src/utils/credits.js

export function calculateCost(chars, model = 'gpt-4o') {
  // Approximate: 1 token ≈ 4 chars
  const tokens = Math.ceil(chars / 4);
  
  // Cost per 1K tokens (in credits)
  const rates = {
    'gpt-4o': 0.5,      // 1 credit per 2K tokens
    'gpt-4o-mini': 0.1, // 1 credit per 10K tokens
    'claude-3-5-sonnet': 0.6,
    'gemini-1.5-pro': 0.4
  };

  const rate = rates[model] || rates['gpt-4o'];
  const cost = Math.ceil((tokens / 1000) * rate);
  
  return Math.max(cost, 1); // Minimum 1 credit
}