module.exports = {
  testEnvironment: 'jsdom',
  roots: [
    '<rootDir>/src',
    '<rootDir>/test'
  ],
  testMatch: [
    '<rootDir>/test/**/*.(ts|js)'
  ],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'es2015',
          moduleResolution: 'node',
          resolveJsonModule: true,
        },
      },
    ],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/types/**'
  ],
  coverageReporters: [
    'lcov', 'text', 'text-summary'
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  preset: 'ts-jest/presets/js-with-babel',
}
