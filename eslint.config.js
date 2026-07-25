export default [
  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "*.config.*",
      "backend/dist/",
      "frontend/dist/",
      "backend/node_modules/",
      "frontend/node_modules/",
      "coverage/"
    ]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        project: ["./tsconfig.json", "./backend/tsconfig.json", "./frontend/tsconfig.json"]
      }
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: ["./tsconfig.json", "./backend/tsconfig.json", "./frontend/tsconfig.json"]
        }
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "error"
    }
  }
]