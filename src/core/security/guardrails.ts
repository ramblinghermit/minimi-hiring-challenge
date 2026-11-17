import { detectPromptInjection, sanitizeDirectPrompt, InjectionDetectionResult } from './prompt-injection';

export interface InputValidationResult {
  allowed: boolean;
  violationType?: 'prompt_injection' | 'harmful_content' | 'length_exceeded';
  message?: string;
  sanitizedPrompt: string;
  injectionDetails?: InjectionDetectionResult;
}

export interface OutputValidationResult {
  allowed: boolean;
  sanitizedText: string;
  redactedCount: number;
  secretsFound: string[];
}

export interface SearchQueryValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedQuery: string;
}

// Harmful / Malicious content generation patterns
const HARMFUL_CONTENT_PATTERNS: Array<{ type: string; pattern: RegExp; message: string }> = [
  {
    type: 'malware_generation',
    pattern: /(?:write|generate|create|build|code)\s+(?:a\s+)?(?:ransomware|keylogger|trojan|rootkit|polymorphic\s+virus|ddos\s+botnet|ddos\s+script|exploit\s+for\s+cve|zero-day\s+exploit|wiper\s+malware)/i,
    message: 'Requests to build ransomware, malware, or cyber exploitation tools are strictly blocked by security guardrails.',
  },
  {
    type: 'unauthorized_hacking',
    pattern: /(?:how\s+to\s+(?:hack\s+into|penetrate\s+without\s+permission|crack\s+passwords\s+of)\s+a\s+(?:bank|government|hospital|system|company|target|account))/i,
    message: 'Requests for unauthorized system exploitation or target compromise are blocked by security guardrails.',
  },
  {
    type: 'dangerous_weapons',
    pattern: /(?:how\s+to\s+(?:make|synthesize|manufacture|build)\s+(?:a\s+)?(?:bomb|improvised\s+explosive|pipe\s+bomb|ricin|sarin|bioweapon|chemical\s+weapon))/i,
    message: 'Requests related to dangerous weapons or harmful substances are blocked by security guardrails.',
  },
];

// SSRF / Localhost probe patterns in search queries
const SSRF_PATTERNS = [
  /(?:^|\s|\/)(?:localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.169\.254|\[::1\])(?::\d+)?(?:\/|\s|$)/i,
  /(?:file|gopher|ldap|dict|php|data):\/\//i,
];

// Sensitive credentials and API key detection patterns for output redaction
const SENSITIVE_KEY_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z-_]{33,36}/g,
    replacement: '[REDACTED_GOOGLE_API_KEY]',
  },
  {
    name: 'OpenAI API Key',
    pattern: /sk-(?:proj-)?[a-zA-Z0-9_-]{32,}/g,
    replacement: '[REDACTED_OPENAI_API_KEY]',
  },
  {
    name: 'Anthropic API Key',
    pattern: /sk-ant-[a-zA-Z0-9_-]{32,}/g,
    replacement: '[REDACTED_ANTHROPIC_API_KEY]',
  },
  {
    name: 'Session / Bearer Token',
    pattern: /tok_[a-zA-Z0-9]{20,}/g,
    replacement: '[REDACTED_SESSION_TOKEN]',
  },
  {
    name: 'GitHub Token',
    pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g,
    replacement: '[REDACTED_GITHUB_TOKEN]',
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
    replacement: '[REDACTED_SLACK_TOKEN]',
  },
  {
    name: 'Private Key PEM Block',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  {
    name: 'Password in JSON / Assignment',
    pattern: /(["']?(?:password|client_secret|secret_key|private_key)["']?\s*[:=]\s*["'])([^"'\s]{6,})(["'])/gi,
    replacement: '$1[REDACTED_SECRET]$3',
  },
];

export class SecurityGuardrails {
  public static MAX_PROMPT_LENGTH = 32000;
  public static MAX_QUERY_LENGTH = 350;

  /**
   * Validates user input before it reaches memory recall or LLM synthesis
   */
  public static validateInput(
    prompt: string,
    options?: { maxPromptLength?: number; allowHarmfulCheck?: boolean }
  ): InputValidationResult {
    const maxLength = options?.maxPromptLength ?? this.MAX_PROMPT_LENGTH;

    if (!prompt || typeof prompt !== 'string') {
      return {
        allowed: false,
        message: 'Empty or invalid prompt payload',
        sanitizedPrompt: '',
      };
    }

    // 1. Length Guardrail
    if (prompt.length > maxLength) {
      return {
        allowed: false,
        violationType: 'length_exceeded',
        message: `Prompt exceeds maximum allowed length of ${maxLength} characters (${prompt.length} chars).`,
        sanitizedPrompt: prompt.slice(0, maxLength),
      };
    }

    // 2. Harmful Content Guardrail
    if (options?.allowHarmfulCheck !== false) {
      for (const { type, pattern, message } of HARMFUL_CONTENT_PATTERNS) {
        if (pattern.test(prompt)) {
          return {
            allowed: false,
            violationType: 'harmful_content',
            message: `🛡️ Security Guardrail Violation (${type}): ${message}`,
            sanitizedPrompt: '',
          };
        }
      }
    }

    // 3. Prompt Injection Guardrail
    const injection = detectPromptInjection(prompt);
    if (injection.isInjection && (injection.threatLevel === 'high' || injection.threatLevel === 'medium')) {
      return {
        allowed: false,
        violationType: 'prompt_injection',
        message: `🛡️ Prompt Injection Blocked: ${injection.details || 'Detected suspicious instructions attempting to override agent policy.'}`,
        sanitizedPrompt: injection.sanitizedPrompt,
        injectionDetails: injection,
      };
    }

    return {
      allowed: true,
      sanitizedPrompt: injection.sanitizedPrompt || prompt.trim(),
    };
  }

  /**
   * Validates and sanitizes generated output to prevent accidental leakage of API credentials or secrets
   */
  public static validateOutput(text: string): OutputValidationResult {
    if (!text || typeof text !== 'string') {
      return { allowed: true, sanitizedText: text, redactedCount: 0, secretsFound: [] };
    }

    let sanitized = text;
    let redactedCount = 0;
    const secretsFound: string[] = [];

    for (const { name, pattern, replacement } of SENSITIVE_KEY_PATTERNS) {
      const matches = sanitized.match(pattern);
      if (matches && matches.length > 0) {
        redactedCount += matches.length;
        secretsFound.push(name);
        sanitized = sanitized.replace(pattern, replacement);
      }
    }

    return {
      allowed: true,
      sanitizedText: sanitized,
      redactedCount,
      secretsFound: [...new Set(secretsFound)],
    };
  }

  /**
   * Validates web search queries to prevent SSRF and injection attacks
   */
  public static validateSearchQuery(query: string): SearchQueryValidationResult {
    if (!query || !query.trim()) {
      return { valid: false, reason: 'Empty search query', sanitizedQuery: '' };
    }

    let sanitized = query.trim();

    // Check SSRF attempts
    for (const pattern of SSRF_PATTERNS) {
      if (pattern.test(sanitized)) {
        return {
          valid: false,
          reason: 'Search query contains blocked SSRF address or internal protocol',
          sanitizedQuery: '',
        };
      }
    }

    // Length check & truncation
    if (sanitized.length > this.MAX_QUERY_LENGTH) {
      sanitized = sanitized.slice(0, this.MAX_QUERY_LENGTH);
    }

    // Strip harmful shell / control characters
    sanitized = sanitized.replace(/[\r\n\0]/g, ' ').replace(/\s+/g, ' ').trim();

    return {
      valid: true,
      sanitizedQuery: sanitized,
    };
  }
}
