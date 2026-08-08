module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/**/*.(test|spec).(ts|tsx)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@fitblock/design-tokens$": "<rootDir>/../../packages/design-tokens/src/index.ts"
  }
};
