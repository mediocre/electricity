module.exports = {
    parserOptions: {
        ecmaVersion: 2020
    },
    env: {
        es6: true,
        mocha: true,
        node: true
    },
    'extends': 'eslint:recommended',
    rules: {
        'brace-style': [2, '1tbs', { allowSingleLine: true }],
        'comma-dangle': [2, 'never'],
        'dot-notation': 2,
        'no-array-constructor': 2,
        'no-console': 0,
        'no-fallthrough': 0,
        'no-inline-comments': 1,
        'no-trailing-spaces': 2,
        'no-unused-vars': ['error', { 'caughtErrors': 'none' }],
        'object-curly-spacing': [2, 'always'],
        quotes: [2, 'single'],
        semi: [2, 'always']
    }
};
