/** Keep linting, but don't fail builds on import spacing */
module.exports = {
  extends: ['next', 'next/core-web-vitals'],
  rules: {
    // Stop builds failing on import group spacing/order
    'import/order': 'warn',
  },
};
