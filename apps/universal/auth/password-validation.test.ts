import { validatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthLabel } from "./password-validation";

describe("validatePasswordStrength", () => {
  it("requires minimum 12 characters", () => {
    const result = validatePasswordStrength("Short1!");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Mínimo de 12 caracteres");
  });

  it("requires uppercase letters", () => {
    const result = validatePasswordStrength("validpass12345!");
    expect(result.errors).toContain("Adicione letras maiúsculas (A-Z)");
  });

  it("requires lowercase letters", () => {
    const result = validatePasswordStrength("VALIDPASS12345!");
    expect(result.errors).toContain("Adicione letras minúsculas (a-z)");
  });

  it("requires numbers", () => {
    const result = validatePasswordStrength("ValidPassword!");
    expect(result.errors).toContain("Adicione números (0-9)");
  });

  it("requires special characters", () => {
    const result = validatePasswordStrength("ValidPassword123");
    expect(result.errors).toContain("Adicione símbolos (!@#$%^&*)");
  });

  it("accepts strong passwords with all requirements", () => {
    const result = validatePasswordStrength("ValidPass123!");
    expect(result.isValid).toBe(true);
  });

  it("provides feedback messages", () => {
    const result = validatePasswordStrength("ValidPass123!");
    expect(result.feedback.length).toBeGreaterThan(0);
  });
});

describe("getPasswordStrengthColor", () => {
  it("returns correct colors for strength levels", () => {
    expect(getPasswordStrengthColor("weak")).toBe("#ef4444");
    expect(getPasswordStrengthColor("fair")).toBe("#f97316");
    expect(getPasswordStrengthColor("good")).toBe("#eab308");
    expect(getPasswordStrengthColor("strong")).toBe("#22c55e");
  });
});

describe("getPasswordStrengthLabel", () => {
  it("returns Portuguese labels", () => {
    expect(getPasswordStrengthLabel("weak")).toBe("Fraca");
    expect(getPasswordStrengthLabel("fair")).toBe("Razoável");
    expect(getPasswordStrengthLabel("good")).toBe("Boa");
    expect(getPasswordStrengthLabel("strong")).toBe("Forte");
  });
});
