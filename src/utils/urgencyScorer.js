import { groqRequest, parseJsonResponse } from './apiClient';

/**
 * Urgency Scorer - AI-powered urgency calculation with contextual understanding
 * Combines LLM reasoning with signal detection for accurate prioritization
 */

/**
 * Critical keywords that indicate high urgency regardless of message length
 */
const CRITICAL_KEYWORDS = [
  'down', 'outage', 'emergency', 'urgent', 'critical', 'asap', 'immediately',
  'production', 'security', 'breach', 'hack', 'compromised', 'data loss',
  'cannot access', "can't access", 'locked out', 'blocked', 'deadline',
  'legal', 'lawsuit', 'compliance', 'audit', 'executive', 'ceo', 'cto'
];

/**
 * System impact keywords suggesting widespread issues
 */
const SYSTEM_IMPACT_KEYWORDS = [
  'all users', 'everyone', 'entire', 'company-wide', 'organization',
  'multiple', 'team', 'department', 'customers affected', 'widespread'
];

/**
 * Business impact keywords
 */
const BUSINESS_IMPACT_KEYWORDS = [
  'revenue', 'money', 'losing', 'cost', 'contract', 'client',
  'demo', 'presentation', 'meeting', 'launch', 'release'
];

/**
 * Detect signals from the message for context
 */
function detectSignals(message) {
  const lowerMessage = message.toLowerCase();

  const signals = {
    hasCriticalKeyword: CRITICAL_KEYWORDS.some(kw => lowerMessage.includes(kw)),
    hasSystemImpact: SYSTEM_IMPACT_KEYWORDS.some(kw => lowerMessage.includes(kw)),
    hasBusinessImpact: BUSINESS_IMPACT_KEYWORDS.some(kw => lowerMessage.includes(kw)),
    exclamationCount: (message.match(/!/g) || []).length,
    questionCount: (message.match(/\?/g) || []).length,
    isAllCaps: message === message.toUpperCase() && message.length > 10,
    hasPositiveSentiment: ['thank', 'thanks', 'appreciate', 'happy', 'love', 'great', 'excellent', 'wonderful', 'amazing']
      .some(word => lowerMessage.includes(word)),
    hasNegativeSentiment: ['angry', 'frustrated', 'furious', 'terrible', 'awful', 'worst', 'unacceptable', 'ridiculous']
      .some(word => lowerMessage.includes(word)),
    messageLength: message.length,
    wordCount: message.trim().split(/\s+/).length
  };

  return signals;
}

/**
 * Calculate urgency using AI reasoning combined with signal detection
 *
 * @param {string} message - The customer support message
 * @param {string} category - The category from LLM categorization (optional, enhances accuracy)
 * @returns {Promise<{level: string, score: number, reasoning: string, signals: object}>}
 */
export async function calculateUrgency(message, category = null, signal = null) {
  const signals = detectSignals(message);

  try {
    const content = await groqRequest({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are an expert customer support triage specialist. Analyze messages to determine urgency level.

Consider these factors:
1. **Severity**: Is this a critical issue (outage, security, data loss) or minor inconvenience?
2. **Scope**: Does it affect one user, a team, or the entire organization?
3. **Business Impact**: Could this cause revenue loss, legal issues, or reputational damage?
4. **Time Sensitivity**: Is there a deadline or time-critical element?
5. **Customer Sentiment**: Is the customer distressed, frustrated, or calm?
6. **Blockers**: Is the customer completely blocked from using the product?

Return a JSON object with:
- "level": "High", "Medium", or "Low"
- "score": number from 0-100
- "reasoning": brief explanation (2-3 sentences max)

High (70-100): Critical issues, outages, security concerns, blocked users, significant business impact
Medium (30-69): Important but not critical, partial functionality loss, frustrated but not blocked
Low (0-29): General inquiries, feature requests, positive feedback, minor issues`
        },
        {
          role: "user",
          content: `Analyze urgency for this customer message${category ? ` (Category: ${category})` : ''}:

"${message}"

Detected signals:
- Critical keywords found: ${signals.hasCriticalKeyword}
- System-wide impact mentioned: ${signals.hasSystemImpact}
- Business impact mentioned: ${signals.hasBusinessImpact}
- Negative sentiment: ${signals.hasNegativeSentiment}
- Positive sentiment: ${signals.hasPositiveSentiment}

Return JSON only.`
        }
      ],
      temperature: 0.3,
      max_tokens: 300
    }, signal);

    const parsed = parseJsonResponse(content);
    if (parsed) {
      return {
        level: parsed.level || "Medium",
        score: parsed.score || 50,
        reasoning: parsed.reasoning || "Unable to determine detailed reasoning.",
        signals
      };
    }

    // Fallback if JSON parsing fails
    return getFallbackUrgency(message, category, signals);

  } catch (error) {
    console.warn('Groq API failed for urgency scoring, using fallback:', error.message);
    return getFallbackUrgency(message, category, signals);
  }
}

/**
 * Fallback urgency calculation when API is unavailable
 * Uses intelligent rule-based scoring that considers context
 */
function getFallbackUrgency(message, category, signals) {
  let score = 50;
  const reasons = [];

  // Critical keyword detection (highest priority)
  if (signals.hasCriticalKeyword) {
    score += 35;
    reasons.push("Critical keywords detected indicating urgent issue");
  }

  // System-wide impact
  if (signals.hasSystemImpact) {
    score += 20;
    reasons.push("Message suggests widespread system impact");
  }

  // Business impact
  if (signals.hasBusinessImpact) {
    score += 15;
    reasons.push("Potential business or revenue impact mentioned");
  }

  // Negative sentiment indicates frustration
  if (signals.hasNegativeSentiment) {
    score += 15;
    reasons.push("Customer expressing frustration or dissatisfaction");
  }

  // Category-based adjustments
  if (category === "Technical Problem") {
    score += 10;
    reasons.push("Technical issues often require timely resolution");
  } else if (category === "Billing Issue") {
    score += 5;
    reasons.push("Billing concerns can impact customer retention");
  } else if (category === "Feature Request") {
    score -= 15;
    reasons.push("Feature requests are typically non-urgent");
  }

  // Positive sentiment (only reduce if no critical indicators)
  if (signals.hasPositiveSentiment && !signals.hasCriticalKeyword && !signals.hasNegativeSentiment) {
    score -= 20;
    reasons.push("Positive sentiment suggests non-urgent matter");
  }

  // Multiple exclamations with negative context increase urgency
  if (signals.exclamationCount >= 2 && (signals.hasNegativeSentiment || signals.hasCriticalKeyword)) {
    score += 10;
    reasons.push("Emphasis suggests heightened concern");
  }

  // Questions without critical keywords are typically inquiries
  if (signals.questionCount > 0 && !signals.hasCriticalKeyword && !signals.hasNegativeSentiment) {
    score -= 10;
    reasons.push("Question format suggests inquiry rather than urgent issue");
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level;
  if (score >= 70) {
    level = "High";
  } else if (score >= 30) {
    level = "Medium";
  } else {
    level = "Low";
  }

  return {
    level,
    score,
    reasoning: reasons.length > 0
      ? reasons.join(". ") + "."
      : "Standard priority based on message analysis.",
    signals
  };
}

/**
 * Simple synchronous version for backward compatibility
 * Returns just the level string
 */
export function calculateUrgencySync(message) {
  const signals = detectSignals(message);
  const result = getFallbackUrgency(message, null, signals);
  return result.level;
}
