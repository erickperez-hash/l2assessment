/**
 * Centralized API client with timeout, retry, and error handling
 */

// Lazy-loaded Groq client - only initializes when first API call is made
let groq = null;

async function getGroqInstance() {
  if (!groq) {
    // Dynamic import - Groq SDK is only loaded when first API call is made
    const { default: Groq } = await import('groq-sdk');
    groq = new Groq({
      apiKey: import.meta.env.VITE_GROQ_API_KEY,
      dangerouslyAllowBrowser: true
    });
  }
  return groq;
}

// Configuration
const CONFIG = {
  timeout: 15000,        // 15 second timeout per request
  maxRetries: 2,         // Retry twice on failure
  retryDelay: 1000,      // 1 second initial delay
  retryBackoff: 2        // Exponential backoff multiplier
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

/**
 * Make a Groq API call with timeout and retry logic
 *
 * @param {object} options - Groq chat completion options
 * @param {AbortSignal} externalSignal - Optional external abort signal for cancellation
 * @returns {Promise<string>} - The response content
 */
export async function groqRequest(options, externalSignal = null) {
  // Get lazy-loaded Groq instance
  const client = await getGroqInstance();
  let lastError;

  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    const { controller, timeoutId } = createTimeoutController(CONFIG.timeout);

    // Link external signal if provided
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await client.chat.completions.create({
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.choices[0].message.content;

    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      // Don't retry if manually aborted
      if (error.name === 'AbortError' && externalSignal?.aborted) {
        throw new Error('Request cancelled');
      }

      // Don't retry on authentication errors
      if (error.status === 401 || error.status === 403) {
        throw error;
      }

      // Log retry attempt
      if (attempt < CONFIG.maxRetries) {
        const delay = CONFIG.retryDelay * Math.pow(CONFIG.retryBackoff, attempt);
        console.warn(`API request failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error.message);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Parse JSON from LLM response, handling markdown code blocks
 */
export function parseJsonResponse(content) {
  // Try to extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Get the Groq client instance (for advanced use cases)
 */
export async function getGroqClient() {
  return getGroqInstance();
}

export { CONFIG as API_CONFIG };
