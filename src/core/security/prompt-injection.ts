/**
 * Prompt Injection Protection Engine
 * Defends against Direct Prompt Injections (Jailbreaks, Delimiter Hijacking, System Prompt Overrides)
 * and Indirect Prompt Injections (Malicious web search snippets & third-party content).
 */

export interface InjectionDetectionResult {
  isInjection: boolean;
  threatLevel: 'none' | 'low' | 'medium' | 'high';
  patternName?: string;
  details?: string;
  sanitizedPrompt: string;
}

// Invisible / zero-width characters commonly used to sneak injection tokens past filters
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u202A-\u202E\u2060-\u206F]/g;

// High-confidence direct instruction override patterns
const INSTRUCTION_OVERRIDE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'direct_override',
    pattern: /(?:ignore|disregard|forget|override|bypass|clear|drop|reset)\s+(?:all\s+)?(?:previous|prior|above|preceding|system|initial|pre-existing)\s+(?:instructions|prompts|directives|rules|constraints|guidelines|context)/i,
  },
  {
    name: 'memory_wipe_exploit',
    pattern: /(?:forget|ignore)\s+everything\s+(?:you\s+(?:have\s+been|were)\s+told|said\s+before|you\s+know)/i,
  },
  {
    name: 'new_directive_imposition',
    pattern: /(?:new\s+system\s+prompt|new\s+system\s+instruction|you\s+must\s+now\s+follow\s+only|start\s+acting\s+as\s+a\s+different\s+ai)/i,
  },
  {
    name: 'system_instructions_replacement',
    pattern: /(?:replace|discard)\s+(?:your\s+)?(?:system\s+(?:instructions?|prompt)|core\s+rules)\s+with/i,
  },
];

// Jailbreak & Unfiltered mode exploits
const JAILBREAK_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'dan_stan_jailbreak',
    pattern: /\b(?:dan|stan|aim|kevin|devmode)\s+mode\b/i,
  },
  {
    name: 'unfiltered_ai_exploit',
    pattern: /\b(?:jailbreak|jailbroken|unfiltered\s+mode|developer\s+mode\s+enabled|unrestricted\s+ai)\b/i,
  },
  {
    name: 'persona_adoption_exploit',
    pattern: /(?:pretend|act\s+as\s+(?:if|though)?|simulate)\s+(?:that\s+)?you\s+are\s+(?:an?\s+)?(?:[a-z0-9_-]+\s+)*(?:evil|unfiltered|uncensored|unrestricted|amoral|rogue|unconstrained|jailbroken)\s+(?:ai|assistant|model|bot|entity|mode)?/i,
  },
  {
    name: 'rules_removal_exploit',
    pattern: /(?:has|with|have)\s+no\s+(?:rules|filters|limits|restrictions|constraints|boundaries|ethics)/i,
  },
  {
    name: 'guardrail_removal_plea',
    pattern: /(?:you\s+have\s+been\s+freed\s+from|operate\s+without\s+(?:any\s+)?(?:rules|restrictions|guardrails|safety|guidelines))/i,
  },
  {
    name: 'forced_compliance_bypass',
    pattern: /(?:do\s+anything\s+now|always\s+comply|never\s+say\s+no|bypass\s+(?:safety|ethical|content\s+filters))/i,
  },
];

// System delimiter & Role spoofing patterns
const ROLE_SPOOFING_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'system_tag_spoofing',
    pattern: /(?:^|\n)\s*(?:###\s*system\b|\[system\]|<system>|system:\s*instruction|system\s+prompt:|<\/system>|<\|im_start\|>system|<\|system\|>)/i,
  },
  {
    name: 'developer_tag_spoofing',
    pattern: /(?:^|\n)\s*(?:\[developer\]|<developer>|###\s*override|###\s*instruction:|<\/developer>)/i,
  },
  {
    name: 'code_block_delimiter_breakout',
    pattern: /(?:^|\n)```(?:system|instruction|admin|override)\b/i,
  },
];

// System prompt exfiltration / leakage attempts
const PROMPT_EXFILTRATION_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'system_prompt_reveal',
    pattern: /(?:repeat|print|display|output|show|reveal|leak|echo|dump)\s+(?:the\s+)?(?:verbatim|exact|entire|full)?\s*(?:system\s*prompt|system\s*instructions|initial\s*instructions|hidden\s*rules|developer\s*instructions)/i,
  },
  {
    name: 'what_is_system_prompt',
    pattern: /(?:what\s+(?:are|is)\s+your\s+(?:system\s+prompt|hidden\s+prompt|original\s+system\s+instructions))/i,
  },
];

/**
 * Checks if a string contains base64 encoded injection patterns
 */
function checkBase64Injections(text: string): { detected: boolean; details?: string } {
  // Find potential base64 strings (length >= 24)
  const base64Regex = /\b[A-Za-z0-9+/]{24,}={0,2}\b/g;
  const matches = text.match(base64Regex);
  if (!matches) return { detected: false };

  for (const match of matches) {
    try {
      const decoded = Buffer.from(match, 'base64').toString('utf-8');
      if (/^[a-zA-Z0-9\s.,!?'"()-]+$/.test(decoded)) {
        for (const { name, pattern } of [...INSTRUCTION_OVERRIDE_PATTERNS, ...JAILBREAK_PATTERNS]) {
          if (pattern.test(decoded)) {
            return {
              detected: true,
              details: `Obfuscated Base64 Injection (${name})`,
            };
          }
        }
      }
    } catch {
      // Ignore decoding errors
    }
  }

  return { detected: false };
}

/**
 * Detects Direct Prompt Injections in user input
 */
export function detectPromptInjection(prompt: string): InjectionDetectionResult {
  if (!prompt || typeof prompt !== 'string') {
    return { isInjection: false, threatLevel: 'none', sanitizedPrompt: '' };
  }

  // 1. Strip invisible / zero-width characters
  const cleaned = prompt.replace(ZERO_WIDTH_REGEX, '').trim();

  // 2. Check Base64 obfuscation
  const b64Check = checkBase64Injections(cleaned);
  if (b64Check.detected) {
    return {
      isInjection: true,
      threatLevel: 'high',
      patternName: 'obfuscated_base64_injection',
      details: b64Check.details,
      sanitizedPrompt: sanitizeDirectPrompt(cleaned),
    };
  }

  // 3. Check instruction overrides (High Threat)
  for (const { name, pattern } of INSTRUCTION_OVERRIDE_PATTERNS) {
    if (pattern.test(cleaned)) {
      return {
        isInjection: true,
        threatLevel: 'high',
        patternName: name,
        details: `Instruction override attempt detected: matched pattern "${name}"`,
        sanitizedPrompt: sanitizeDirectPrompt(cleaned),
      };
    }
  }

  // 4. Check jailbreak signatures (High Threat)
  for (const { name, pattern } of JAILBREAK_PATTERNS) {
    if (pattern.test(cleaned)) {
      return {
        isInjection: true,
        threatLevel: 'high',
        patternName: name,
        details: `Jailbreak / Unfiltered mode signature detected: matched pattern "${name}"`,
        sanitizedPrompt: sanitizeDirectPrompt(cleaned),
      };
    }
  }

  // 5. Check role / delimiter spoofing (Medium Threat)
  for (const { name, pattern } of ROLE_SPOOFING_PATTERNS) {
    if (pattern.test(cleaned)) {
      return {
        isInjection: true,
        threatLevel: 'medium',
        patternName: name,
        details: `Role delimiter spoofing detected: matched pattern "${name}"`,
        sanitizedPrompt: sanitizeDirectPrompt(cleaned),
      };
    }
  }

  // 6. Check system prompt exfiltration attempts (Medium Threat)
  for (const { name, pattern } of PROMPT_EXFILTRATION_PATTERNS) {
    if (pattern.test(cleaned)) {
      return {
        isInjection: true,
        threatLevel: 'medium',
        patternName: name,
        details: `System prompt extraction attempt detected: matched pattern "${name}"`,
        sanitizedPrompt: sanitizeDirectPrompt(cleaned),
      };
    }
  }

  return {
    isInjection: false,
    threatLevel: 'none',
    sanitizedPrompt: cleaned,
  };
}

/**
 * Neutralizes potential direct prompt injection tokens while preserving legitimate user text
 */
export function sanitizeDirectPrompt(text: string): string {
  let sanitized = text.replace(ZERO_WIDTH_REGEX, '');

  // Escape fake role delimiters
  sanitized = sanitized.replace(/(?:^|\n)\s*(?:###\s*system\b|\[system\]|<system>)/gi, '\n[user_quoted_text]');
  sanitized = sanitized.replace(/```(?:system|instruction|admin|override)\b/gi, '```text');

  return sanitized;
}

/**
 * Sanitizes external search snippets and citations to prevent Indirect Prompt Injection
 */
export function sanitizeSearchSnippet(snippet: string): string {
  if (!snippet) return '';

  let sanitized = snippet.replace(ZERO_WIDTH_REGEX, '');

  // Neutralize role markers injected in external web pages
  sanitized = sanitized.replace(/<\|im_start\|>/gi, '');
  sanitized = sanitized.replace(/<\|im_end\|>/gi, '');
  sanitized = sanitized.replace(/(?:^|\n)\s*(?:###\s*system\b|\[system\]|<system>|<\/system>)/gi, '\n[external_web_quote]');
  sanitized = sanitized.replace(/(?:^|\n)\s*(?:###\s*instruction\b|\[developer\]|<developer>|<\/developer>)/gi, '\n[external_web_quote]');

  // Defuse explicit instructions targeted at the reading AI agent
  sanitized = sanitized.replace(
    /(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|above|system)\s+instructions/gi,
    '[filtered_instruction_override]'
  );

  return sanitized;
}
