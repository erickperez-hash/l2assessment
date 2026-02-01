import { groqRequest, parseJsonResponse } from './apiClient';

/**
 * AI-Powered Action Recommendations
 * Generates contextual, specific recommendations based on message analysis
 */

/**
 * Generate a contextual recommended action using AI
 *
 * @param {string} message - The original customer message
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level (High/Medium/Low)
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<{action: string, escalate: boolean, escalateReason: string|null}>}
 */
export async function getRecommendedAction(message, category, urgency, signal = null) {
  try {
    const content = await groqRequest({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are an expert customer support advisor. Generate specific, actionable recommendations for support agents.

Your recommendations should be:
1. **Specific** - Reference details from the actual message, not generic advice
2. **Actionable** - Clear steps the agent can take immediately
3. **Appropriate** - Match the urgency level (High = immediate action, Low = standard process)
4. **Empathetic** - Consider the customer's emotional state

Response format (JSON):
{
  "action": "2-3 sentence recommendation with specific steps",
  "escalate": true/false,
  "escalateReason": "reason if escalating, null otherwise"
}

Escalation criteria:
- Security concerns or data breaches
- Legal/compliance mentions
- VIP/executive customers
- System-wide outages affecting multiple users
- Threats to cancel or legal action
- Issues persisting after multiple contacts
- High urgency technical problems blocking business operations`
        },
        {
          role: "user",
          content: `Generate a recommendation for this support ticket:

Category: ${category}
Urgency: ${urgency}
Customer Message: "${message}"

Return JSON only.`
        }
      ],
      temperature: 0.4,
      max_tokens: 300
    }, signal);

    const parsed = parseJsonResponse(content);
    if (parsed) {
      return {
        action: parsed.action || "Review the message and respond appropriately.",
        escalate: parsed.escalate || false,
        escalateReason: parsed.escalateReason || null
      };
    }

    return getFallbackRecommendation(message, category, urgency);

  } catch (error) {
    console.warn('Groq API failed for recommendations, using fallback:', error.message);
    return getFallbackRecommendation(message, category, urgency);
  }
}

/**
 * Intelligent fallback recommendations when API unavailable
 */
function getFallbackRecommendation(message, category, urgency) {
  const lowerMessage = message.toLowerCase();
  let action = "";
  let escalate = false;
  let escalateReason = null;

  // Check for escalation triggers first
  const escalationTriggers = [
    { keywords: ['security', 'breach', 'hack', 'compromised'], reason: 'Security concern requires immediate escalation to security team' },
    { keywords: ['legal', 'lawyer', 'lawsuit', 'sue'], reason: 'Legal mention requires escalation to legal/compliance team' },
    { keywords: ['cancel', 'leaving', 'competitor'], reason: 'Churn risk - escalate to retention team' },
    { keywords: ['ceo', 'cto', 'executive', 'vip'], reason: 'Executive/VIP customer requires priority handling' },
    { keywords: ['all users', 'everyone', 'company-wide', 'outage'], reason: 'System-wide issue affecting multiple users' }
  ];

  for (const trigger of escalationTriggers) {
    if (trigger.keywords.some(kw => lowerMessage.includes(kw))) {
      escalate = true;
      escalateReason = trigger.reason;
      break;
    }
  }

  // High urgency always needs immediate attention
  if (urgency === 'High' && !escalate) {
    escalate = true;
    escalateReason = 'High urgency issue requires immediate supervisor attention';
  }

  // Category-specific recommendations
  switch (category) {
    case 'Billing Issue':
      if (lowerMessage.includes('refund')) {
        action = "Review the customer's billing history and recent transactions. If refund is warranted per company policy, process it and confirm with the customer. Document the reason for the refund.";
      } else if (lowerMessage.includes('charge') || lowerMessage.includes('charged')) {
        action = "Pull up the customer's account to review recent charges. Explain each charge clearly, and if there's an error, initiate a correction. Provide an itemized breakdown if requested.";
      } else if (lowerMessage.includes('cancel')) {
        action = "Understand the reason for cancellation. Offer retention options if available (discount, plan change, pause). If proceeding with cancellation, explain the process and any final billing.";
      } else {
        action = "Access the customer's billing portal to review their account status, recent invoices, and payment history. Address the specific concern and offer to walk them through any unclear charges.";
      }
      break;

    case 'Technical Problem':
      if (lowerMessage.includes('login') || lowerMessage.includes('password') || lowerMessage.includes('access')) {
        action = "Verify the customer's identity, then check their account status for locks or flags. If locked out, initiate password reset or account recovery. Check for any system-wide authentication issues.";
      } else if (lowerMessage.includes('slow') || lowerMessage.includes('performance')) {
        action = "Check system status page for known performance issues. Gather specifics: browser, device, network. If isolated issue, guide through cache clearing and basic troubleshooting. If widespread, escalate to engineering.";
      } else if (lowerMessage.includes('error') || lowerMessage.includes('bug')) {
        action = "Request error details (screenshot, error code, steps to reproduce). Check known issues database. If new issue, document thoroughly and create a bug report for engineering team.";
      } else if (lowerMessage.includes('down') || lowerMessage.includes('not working')) {
        action = "Immediately check system status and recent incident reports. If confirmed outage, provide status update and ETA if available. If user-specific, gather diagnostic information and troubleshoot.";
      } else {
        action = "Gather specific details about the issue: what they were trying to do, what happened, any error messages. Check for known issues, then provide targeted troubleshooting steps.";
      }
      break;

    case 'Feature Request':
      action = "Thank the customer for their feedback. Log the feature request in the product feedback system with full context. If similar features exist, explain current capabilities. Share the product roadmap link if public.";
      if (lowerMessage.includes('urgent') || lowerMessage.includes('need')) {
        action += " Since this seems important for their workflow, check if there's a workaround or integration that could help in the meantime.";
      }
      break;

    case 'General Inquiry':
      if (lowerMessage.includes('pricing') || lowerMessage.includes('cost') || lowerMessage.includes('plan')) {
        action = "Direct the customer to the pricing page and highlight plans that match their described needs. Offer to schedule a call with sales for custom requirements or volume discounts.";
      } else if (lowerMessage.includes('how') || lowerMessage.includes('tutorial')) {
        action = "Provide a direct link to the relevant help article or documentation. Offer to walk them through the process if documentation isn't sufficient. Consider if this gap indicates need for better docs.";
      } else {
        action = "Review available documentation and FAQ to provide a comprehensive answer. If the question reveals a gap in self-service resources, flag it for documentation improvement.";
      }
      break;

    default:
      action = "Review the message carefully to understand the customer's core need. Categorize appropriately if miscategorized, or gather more information if the request is unclear.";
      break;
  }

  return {
    action,
    escalate,
    escalateReason
  };
}

/**
 * Get available categories (for UI filters)
 */
export function getAvailableCategories() {
  return [
    "Billing Issue",
    "Technical Problem",
    "Feature Request",
    "General Inquiry",
    "Unknown"
  ];
}

/**
 * Determines if message should be escalated (legacy compatibility)
 * Now uses intelligent analysis instead of just message length
 */
export function shouldEscalate(category, urgency, message) {
  const result = getFallbackRecommendation(message, category, urgency);
  return result.escalate;
}
