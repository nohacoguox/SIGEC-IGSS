module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Reglas para evitar errores de compilación en desarrollo
    'no-unused-vars': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': 'off',
    'react/prop-types': 'off',
    // Desactivar reglas que causan problemas de estabilidad
    'react/react-in-jsx-scope': 'off',
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/alt-text': 'warn',
  },
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};