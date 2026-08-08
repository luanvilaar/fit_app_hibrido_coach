/**
 * Password validation with strength requirements
 * OWASP: Minimum 12 characters with complexity
 */

export interface PasswordValidationResult {
  isValid: boolean;
  score: "weak" | "fair" | "good" | "strong";
  errors: string[];
  feedback: string[];
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const feedback: string[] = [];
  let score = 0;

  // Check minimum length (OWASP: 12+ characters)
  if (password.length < 12) {
    errors.push("Mínimo de 12 caracteres");
  } else {
    score++;
    feedback.push("✓ Comprimento adequado");
  }

  // Check for uppercase letters
  if (!/[A-Z]/.test(password)) {
    errors.push("Adicione letras maiúsculas (A-Z)");
  } else {
    score++;
    feedback.push("✓ Contém maiúsculas");
  }

  // Check for lowercase letters
  if (!/[a-z]/.test(password)) {
    errors.push("Adicione letras minúsculas (a-z)");
  } else {
    score++;
    feedback.push("✓ Contém minúsculas");
  }

  // Check for numbers
  if (!/[0-9]/.test(password)) {
    errors.push("Adicione números (0-9)");
  } else {
    score++;
    feedback.push("✓ Contém números");
  }

  // Check for special characters
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Adicione símbolos (!@#$%^&*)");
  } else {
    score++;
    feedback.push("✓ Contém símbolos");
  }

  // Block common passwords
  const commonPasswords = [
    "password",
    "123456",
    "12345678",
    "qwerty",
    "abc123",
    "monkey",
    "1234567",
    "letmein",
    "trustno1",
    "dragon",
    "baseball",
    "iloveyou",
    "passw0rd",
    "shadow",
    "123123",
    "654321",
    "superman",
    "qazwsx",
    "michael",
    "football"
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push("Senha muito comum. Escolha uma senha única");
  }

  // Determine score
  let strengthScore: "weak" | "fair" | "good" | "strong";
  if (score <= 1) {
    strengthScore = "weak";
  } else if (score <= 2) {
    strengthScore = "fair";
  } else if (score <= 3) {
    strengthScore = "good";
  } else {
    strengthScore = "strong";
  }

  return {
    isValid: errors.length === 0,
    score: strengthScore,
    errors,
    feedback
  };
}

export function getPasswordStrengthColor(score: "weak" | "fair" | "good" | "strong"): string {
  switch (score) {
    case "weak":
      return "#ef4444"; // red
    case "fair":
      return "#f97316"; // orange
    case "good":
      return "#eab308"; // yellow
    case "strong":
      return "#22c55e"; // green
  }
}

export function getPasswordStrengthLabel(score: "weak" | "fair" | "good" | "strong"): string {
  switch (score) {
    case "weak":
      return "Fraca";
    case "fair":
      return "Razoável";
    case "good":
      return "Boa";
    case "strong":
      return "Forte";
  }
}
