module.exports = {
  collect: {
    numberOfRuns: 1,
    startServerCommand: null, // run Next yourself
    url: [process.env.BASE_URL || 'http://localhost:3000/'],
    settings: { preset: 'desktop' }
  },
  assert: {
    assertions: {
      'categories:performance': ['error', { minScore: 0.90 }],
      'uses-rel-preconnect': 'warn',
      'font-display': 'error',
      'layout-shift-elements': 'warn',
      'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      'largest-contentful-paint': ['warn', { maxNumericValue: 3000 }],
      'total-blocking-time': ['warn', { maxNumericValue: 200 }],
      'uses-optimized-images': 'warn'
    }
  },
  upload: { target: 'filesystem', outputDir: '.lighthouse' }
};
