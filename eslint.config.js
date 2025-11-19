const globals = require("globals");
const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
  js.configs.recommended,
  prettier,
];
