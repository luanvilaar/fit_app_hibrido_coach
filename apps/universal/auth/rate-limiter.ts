/**
 * Rate limiting for authentication attempts
 * Prevents brute force attacks
 */

interface AttemptRecord {
  count: number;
  blockedUntil: number;
  firstAttempt: number;
}

interface RateLimitConfig {
  maxAttempts: number;
  lockoutDurationMs: number;
  resetWindowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5, // 5 failed attempts
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
  resetWindowMs: 60 * 60 * 1000 // 1 hour (reset counter after 1 hour of no attempts)
};

class LoginRateLimiter {
  private attempts: Map<string, AttemptRecord> = new Map();
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if an email is rate limited
   */
  isBlocked(email: string): { blocked: boolean; minutesLeft?: number } {
    const normalized = email.trim().toLowerCase();
    const record = this.attempts.get(normalized);
    const now = Date.now();

    if (!record) {
      return { blocked: false };
    }

    // Check if lockout period has expired
    if (record.blockedUntil <= now) {
      // Check if reset window has expired
      if (now - record.firstAttempt > this.config.resetWindowMs) {
        this.attempts.delete(normalized);
        return { blocked: false };
      }
      return { blocked: false };
    }

    // Still blocked
    const minutesLeft = Math.ceil((record.blockedUntil - now) / 60000);
    return { blocked: true, minutesLeft };
  }

  /**
   * Record a failed attempt
   */
  recordFailedAttempt(email: string): { shouldBlock: boolean; minutesLeft?: number } {
    const normalized = email.trim().toLowerCase();
    const now = Date.now();
    let record = this.attempts.get(normalized);

    if (!record) {
      // First attempt
      record = {
        count: 1,
        blockedUntil: 0,
        firstAttempt: now
      };
    } else {
      // Reset counter if outside reset window
      if (now - record.firstAttempt > this.config.resetWindowMs) {
        record = {
          count: 1,
          blockedUntil: 0,
          firstAttempt: now
        };
      } else {
        record.count++;
      }
    }

    // Check if should trigger lockout
    const shouldBlock = record.count >= this.config.maxAttempts;
    if (shouldBlock) {
      record.blockedUntil = now + this.config.lockoutDurationMs;
    }

    this.attempts.set(normalized, record);

    if (shouldBlock) {
      const minutesLeft = Math.ceil(this.config.lockoutDurationMs / 60000);
      return { shouldBlock: true, minutesLeft };
    }

    return { shouldBlock: false };
  }

  /**
   * Clear attempts for successful login
   */
  clearAttempts(email: string): void {
    const normalized = email.trim().toLowerCase();
    this.attempts.delete(normalized);
  }

  /**
   * Get current attempt count (for UI display)
   */
  getAttemptCount(email: string): number {
    const normalized = email.trim().toLowerCase();
    const record = this.attempts.get(normalized);
    return record?.count ?? 0;
  }

  /**
   * Get remaining attempts before lockout
   */
  getRemainingAttempts(email: string): number {
    const count = this.getAttemptCount(email);
    return Math.max(0, this.config.maxAttempts - count);
  }
}

export const loginRateLimiter = new LoginRateLimiter();
