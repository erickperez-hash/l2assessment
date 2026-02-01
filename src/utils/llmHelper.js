import { groqRequest, parseJsonResponse } from './apiClient';

/**
 * LLM Helper for categorizing customer support messages
 * Using Groq API with structured prompts for accurate categorization
 */

/**
 * Category definitions with clear criteria
 */
const CATEGORY_DEFINITIONS = {
  "Billing Issue": {
    description: "Payment problems, charges, refunds, invoices, subscription management, pricing disputes",
    keywords: ['bill', 'payment', 'charge', 'invoice', 'refund', 'subscription', 'price', 'cost', 'fee', 'credit card', 'cancel subscription', 'renewal', 'discount', 'promo', 'coupon']
  },
  "Technical Problem": {
    description: "Bugs, errors, crashes, outages, performance issues, functionality not working as expected",
    keywords: ['bug', 'error', 'broken', 'not working', 'crash', 'down', 'slow', 'loading', 'freeze', 'stuck', 'fail', 'issue', 'problem', 'glitch', 'unresponsive', 'timeout', 'connection']
  },
  "Feature Request": {
    description: "Suggestions for new features, improvements, enhancements, or changes to existing functionality",
    keywords: ['feature', 'add', 'improve', 'enhancement', 'suggestion', 'wish', 'would be great', 'would like', 'could you add', 'missing', 'need ability', 'roadmap']
  },
  "General Inquiry": {
    description: "Questions about how things work, pricing information, account questions, general help, positive feedback",
    keywords: ['how do', 'how to', 'what is', 'where is', 'can i', 'is there', 'help', 'question', 'wondering', 'curious', 'thank', 'thanks', 'great job', 'love']
  }
};

/**
 * Categorize a customer support message using Groq AI
 *
 * @param {string} message - The customer support message
 * @returns {Promise<{category: string, reasoning: string, confidence: number}>}
 */
export async function categorizeMessage(message, signal = null) {
  try {
    const content = await groqRequest({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a customer support message classifier. Analyze messages and categorize them accurately.

## Available Categories

1. **Billing Issue**: ${CATEGORY_DEFINITIONS["Billing Issue"].description}
   - Examples: "I was charged twice", "Need a refund", "Cancel my subscription"

2. **Technical Problem**: ${CATEGORY_DEFINITIONS["Technical Problem"].description}
   - Examples: "App keeps crashing", "Can't login", "Page won't load"

3. **Feature Request**: ${CATEGORY_DEFINITIONS["Feature Request"].description}
   - Examples: "Would be great if you added...", "Can you implement...", "I wish there was..."

4. **General Inquiry**: ${CATEGORY_DEFINITIONS["General Inquiry"].description}
   - Examples: "How do I export data?", "What are your business hours?", "Thanks for the help!"

## Classification Rules

- Choose the MOST SPECIFIC category that fits
- If a message mentions multiple issues, prioritize: Technical Problem > Billing Issue > others
- Messages expressing frustration about a specific issue should be categorized by the issue type, not the emotion
- "Can't access" or "locked out" are Technical Problems unless specifically about billing/payment access
- Positive feedback with no question = General Inquiry
- Ambiguous messages default to General Inquiry

## Response Format

Return JSON only:
{
  "category": "Category Name",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this category was chosen"
}`
        },
        {
          role: "user",
          content: `Categorize this customer support message:

"${message}"

Return JSON only.`
        }
      ],
      temperature: 0.2,
      max_tokens: 300
    }, signal);

    const parsed = parseJsonResponse(content);
    if (parsed) {
      // Validate category is one of our defined categories
      const validCategories = Object.keys(CATEGORY_DEFINITIONS);
      const category = validCategories.includes(parsed.category) ? parsed.category : "Unknown";

      return {
        category,
        reasoning: parsed.reasoning || content,
        confidence: parsed.confidence || 0.8
      };
    }

    // Fallback: try to extract category from prose response
    return extractCategoryFromProse(content, message);

  } catch (error) {
    console.warn('Groq API failed, using fallback categorization:', error.message);
    return getFallbackCategorization(message);
  }
}

/**
 * Extract category from non-JSON LLM response
 */
function extractCategoryFromProse(content, originalMessage) {
  const lowerContent = content.toLowerCase();

  for (const [category] of Object.entries(CATEGORY_DEFINITIONS)) {
    if (lowerContent.includes(category.toLowerCase())) {
      return {
        category,
        reasoning: content,
        confidence: 0.7
      };
    }
  }

  // If no category found in response, use fallback
  return getFallbackCategorization(originalMessage);
}

/**
 * Intelligent fallback categorization when API is unavailable
 */
function getFallbackCategorization(message) {
  const lowerMessage = message.toLowerCase();

  // Score each category based on keyword matches
  const scores = {};
  for (const [category, def] of Object.entries(CATEGORY_DEFINITIONS)) {
    scores[category] = 0;
    for (const keyword of def.keywords) {
      if (lowerMessage.includes(keyword)) {
        // Longer keywords are more specific, give them more weight
        scores[category] += keyword.split(' ').length;
      }
    }
  }

  // Priority rules for ties and edge cases
  // Technical problems take priority (often more urgent)
  if (scores["Technical Problem"] > 0 && scores["Billing Issue"] > 0) {
    // If both technical and billing, check for specific patterns
    if (lowerMessage.includes('payment') && (lowerMessage.includes('fail') || lowerMessage.includes('error'))) {
      scores["Billing Issue"] += 2; // Payment failures are billing issues
    }
  }

  // Find highest scoring category
  let bestCategory = "General Inquiry";
  let bestScore = 0;

  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // Generate appropriate reasoning
  const reasoning = generateFallbackReasoning(bestCategory);

  return {
    category: bestCategory,
    reasoning,
    confidence: bestScore > 2 ? 0.8 : bestScore > 0 ? 0.6 : 0.4
  };
}

/**
 * Generate contextual reasoning for fallback categorization
 */
function generateFallbackReasoning(category) {
  const reasoningTemplates = {
    "Billing Issue": [
      "This message relates to billing, payments, or subscription management. The customer appears to have a financial or account-related concern that needs to be addressed.",
      "The message contains billing-related terminology indicating the customer needs assistance with payments, charges, or their subscription status.",
      "Based on the financial context of this message, this is categorized as a billing issue requiring review of the customer's account."
    ],
    "Technical Problem": [
      "The customer is reporting a technical issue or malfunction. This requires investigation to identify the root cause and provide a resolution.",
      "This message describes functionality problems or errors the customer is experiencing. Technical troubleshooting will be needed.",
      "Based on the error or malfunction described, this is a technical support issue that may require engineering review."
    ],
    "Feature Request": [
      "The customer is suggesting an improvement or new capability. This feedback should be logged for product team review.",
      "This message contains a feature suggestion or enhancement request. The customer is providing valuable product feedback.",
      "The customer is requesting functionality that doesn't currently exist. This should be tracked as product feedback."
    ],
    "General Inquiry": [
      "This appears to be a general question or informational request. The customer is seeking clarification or assistance.",
      "The message is a general inquiry that can likely be addressed with documentation or standard support responses.",
      "This is a general support request or positive feedback that doesn't fall into a specific issue category."
    ]
  };

  const templates = reasoningTemplates[category] || reasoningTemplates["General Inquiry"];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Get category definitions (for documentation/UI)
 */
export function getCategoryDefinitions() {
  return CATEGORY_DEFINITIONS;
}
