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
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: ['js', 'ts', 'json'],
  transformIgnorePatterns: [
    // Add module name that needs to be transpiled
    // '/node_modules/(?!whatwg-fetch|stanza|xmpp-jid|genesys-cloud-streaming-client).+\\.js$'
  ],
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
  globals: {
    'ts-jest': {
      tsconfig: {
        target: 'es2015',
        moduleResolution: 'node',
        resolveJsonModule: true
      }
    }
  }
};
