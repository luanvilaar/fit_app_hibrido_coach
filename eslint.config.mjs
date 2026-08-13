import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/**
 * Lint do código que vive fora do app: as funções de pagamento em `api/` e os repositórios em
 * `packages/`. Nenhum dos dois era coberto — o `npm run lint` roda dentro de `apps/universal` e
 * nunca enxergou nada acima dela. Mesmas regras do app, para não haver dois padrões.
 */
export default [
  {
    ignores: ["node_modules/**", "dist/**", "apps/**", ".expo/**", ".vercel/**", ".aiox-core/**"]
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
];
