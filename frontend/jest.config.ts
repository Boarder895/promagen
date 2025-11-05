// /frontend/jest.config.ts
import nextJest from 'next/jest';

const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setuptests.ts'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|sass|scss)$': '<rootDir>/src/test/__mocks__/stylemock.js',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp|avif)$':
      '<rootDir>/src/test/__mocks__/filemock.js',
  },

  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/.pnpm/',
  ],

  snapshotFormat: { escapeString: true, printBasicPrototype: true },

  // Uncomment and tailor if a specific ESM dep needs transforming:
  // transformIgnorePatterns: ['/node_modules/(?!(@react-aria|nanoid)/)'],
};

export default createJestConfig(config);
