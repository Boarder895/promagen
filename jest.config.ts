import nextJest from 'next/jest.js';
const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setuptests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mocks for CSS and assets (optional but nice)
    '\\.(css|less|sass|scss)$': '<rootDir>/src/test/__mocks__/styleMock.js',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp|avif)$':
      '<rootDir>/src/test/__mocks__/fileMock.js',
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/.pnpm/',
  ],
  snapshotFormat: { escapeString: true, printBasicPrototype: true },
  // If a specific ESM lib complains, add it here (example):
  // transformIgnorePatterns: ['/node_modules/(?!(@react-aria|nanoid)/)'],
};
export default createJestConfig(config);
