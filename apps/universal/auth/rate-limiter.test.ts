import { loginRateLimiter } from "./rate-limiter";

describe("LoginRateLimiter", () => {
  beforeEach(() => {
    // Reset limiter by clearing internal state
    loginRateLimiter.clearAttempts("test@example.com");
    loginRateLimiter.clearAttempts("attempt@test.com");
  });

  describe("blocking after max attempts", () => {
    it("allows initial attempts", () => {
      const result = loginRateLimiter.isBlocked("test@example.com");
      expect(result.blocked).toBe(false);
    });

    it("blocks after 5 failed attempts", () => {
      const email = "attempt@test.com";

      // Make 5 attempts
      for (let i = 0; i < 5; i++) {
        loginRateLimiter.recordFailedAttempt(email);
      }

      // 6th attempt should be blocked
      const blocked = loginRateLimiter.isBlocked(email);
      expect(blocked.blocked).toBe(true);
      expect(blocked.minutesLeft).toBeGreaterThan(0);
    });

    it("returns correct remaining attempts", () => {
      const email = "attempt@test.com";

      loginRateLimiter.recordFailedAttempt(email);
      expect(loginRateLimiter.getRemainingAttempts(email)).toBe(4);

      loginRateLimiter.recordFailedAttempt(email);
      expect(loginRateLimiter.getRemainingAttempts(email)).toBe(3);

      loginRateLimiter.recordFailedAttempt(email);
      expect(loginRateLimiter.getRemainingAttempts(email)).toBe(2);
    });
  });

  describe("email normalization", () => {
    it("treats different cases as same email", () => {
      loginRateLimiter.recordFailedAttempt("Test@Example.com");
      loginRateLimiter.recordFailedAttempt("test@example.com");
      loginRateLimiter.recordFailedAttempt("TEST@EXAMPLE.COM");

      expect(loginRateLimiter.getAttemptCount("test@example.com")).toBe(3);
    });

    it("trims whitespace from emails", () => {
      loginRateLimiter.recordFailedAttempt("  test@example.com  ");
      loginRateLimiter.recordFailedAttempt("test@example.com");

      expect(loginRateLimiter.getAttemptCount("test@example.com")).toBe(2);
    });
  });

  describe("clearing attempts on success", () => {
    it("clears attempt count after successful login", () => {
      const email = "test@example.com";

      loginRateLimiter.recordFailedAttempt(email);
      loginRateLimiter.recordFailedAttempt(email);

      expect(loginRateLimiter.getAttemptCount(email)).toBe(2);

      loginRateLimiter.clearAttempts(email);

      expect(loginRateLimiter.getAttemptCount(email)).toBe(0);
    });
  });

  describe("rate limit result handling", () => {
    it("indicates when account should be blocked", () => {
      const email = "block@test.com";

      // Make 5 attempts
      for (let i = 0; i < 5; i++) {
        loginRateLimiter.recordFailedAttempt(email);
      }

      const result = loginRateLimiter.recordFailedAttempt(email);
      expect(result.shouldBlock).toBe(true);
      expect(result.minutesLeft).toBe(15);
    });

    it("returns remaining attempts before blocking", () => {
      const email = "limit@test.com";

      const result1 = loginRateLimiter.recordFailedAttempt(email);
      expect(result1.shouldBlock).toBe(false);

      const result2 = loginRateLimiter.recordFailedAttempt(email);
      expect(result2.shouldBlock).toBe(false);

      const result3 = loginRateLimiter.recordFailedAttempt(email);
      expect(result3.shouldBlock).toBe(false);

      const result4 = loginRateLimiter.recordFailedAttempt(email);
      expect(result4.shouldBlock).toBe(false);

      const result5 = loginRateLimiter.recordFailedAttempt(email);
      expect(result5.shouldBlock).toBe(true);
      expect(result5.minutesLeft).toBe(15);
    });
  });

  describe("attempt counter", () => {
    it("returns 0 for unknown email", () => {
      expect(loginRateLimiter.getAttemptCount("unknown@test.com")).toBe(0);
    });

    it("increments count for each failed attempt", () => {
      const email = "counter@test.com";

      for (let i = 1; i <= 3; i++) {
        loginRateLimiter.recordFailedAttempt(email);
        expect(loginRateLimiter.getAttemptCount(email)).toBe(i);
      }
    });
  });
});
