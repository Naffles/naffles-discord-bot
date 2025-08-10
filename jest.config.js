module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/**/index.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**'
  ],

  // Coverage thresholds for comprehensive testing
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Specific thresholds for critical components
    'src/services/discordBotService.js': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/handlers/commandHandler.js': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/services/permissionManager.js': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/services/securityMonitor.js': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module paths
  moduleDirectories: ['node_modules', 'src'],

  // Clear mocks between tests
  clearMocks: true,

  // Verbose output
  verbose: true,

  // Test timeout (increased for comprehensive tests)
  testTimeout: 30000,

  // Transform configuration
  transform: {},

  // Module file extensions
  moduleFileExtensions: ['js', 'json'],

  // Global setup/teardown
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',

  // Test result processor for comprehensive reporting
  testResultsProcessor: '<rootDir>/tests/comprehensive/testResultsProcessor.js',

  // Max workers for parallel execution
  maxWorkers: '50%',

  // Detect open handles and force exit
  detectOpenHandles: true,
  forceExit: true,

  // Bail on first failure for CI environments
  bail: process.env.CI ? 1 : 0,

  // Test name patterns for filtering
  testNamePattern: process.env.TEST_NAME_PATTERN,

  // Projects configuration for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/comprehensive/unitTests.test.js'],
      testTimeout: 30000
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/comprehensive/integrationTests.test.js'],
      testTimeout: 60000
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/comprehensive/endToEndTests.test.js'],
      testTimeout: 90000
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/tests/comprehensive/securityTests.test.js'],
      testTimeout: 45000
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/tests/comprehensive/performanceTests.test.js'],
      testTimeout: 120000
    },
    {
      displayName: 'regression',
      testMatch: ['<rootDir>/tests/comprehensive/regressionTests.test.js'],
      testTimeout: 30000
    }
  ]
};