# Comprehensive Discord Bot Testing Suite

This directory contains a comprehensive testing suite for the Discord bot integration, covering all aspects of functionality, security, performance, and reliability.

## Test Suite Overview

### 1. Unit Tests (`unitTests.test.js`)
- **Purpose**: Tests all Discord bot service components and command handlers in isolation
- **Coverage**: Individual functions, classes, and modules
- **Timeout**: 30 seconds
- **Key Areas**:
  - DiscordBotService functionality
  - Command handlers (create-task, list-tasks, connect-allowlist)
  - Button handlers and interactions
  - Event handlers (guild join/leave, member events)
  - Service components (permissions, security, audit logging)
  - Database and Redis service operations

### 2. Integration Tests (`integrationTests.test.js`)
- **Purpose**: Tests Discord API interactions and Naffles backend communication
- **Coverage**: Service-to-service communication and external API integration
- **Timeout**: 60 seconds
- **Key Areas**:
  - Discord API integration (commands, messages, embeds)
  - Naffles backend API calls and responses
  - Database operations with real MongoDB
  - Redis caching and session management
  - End-to-end command workflows
  - Real-time synchronization features

### 3. End-to-End Tests (`endToEndTests.test.js`)
- **Purpose**: Tests complete user workflows from Discord to task completion
- **Coverage**: Full user journeys and business processes
- **Timeout**: 90 seconds
- **Key Areas**:
  - Complete task creation workflow
  - Task completion and points award process
  - Allowlist connection and entry workflows
  - Community linking processes
  - Real-time updates and synchronization
  - Multi-user concurrent workflows
  - Data consistency across operations

### 4. Security Tests (`securityTests.test.js`)
- **Purpose**: Tests permission validation and anti-abuse measures
- **Coverage**: Security controls, access management, and threat prevention
- **Timeout**: 45 seconds
- **Key Areas**:
  - Permission validation for different user types
  - Rate limiting and anti-abuse mechanisms
  - Input validation and sanitization
  - Audit logging and monitoring
  - Security reporting and alerting
  - Data protection and privacy
  - Threat detection and response

### 5. Performance Tests (`performanceTests.test.js`)
- **Purpose**: Tests handling of multiple concurrent Discord interactions
- **Coverage**: Load handling, scalability, and resource management
- **Timeout**: 120 seconds
- **Key Areas**:
  - Concurrent command execution (50+ simultaneous)
  - High-frequency button interactions (200+ clicks)
  - Database performance under load
  - Redis caching performance
  - Memory usage and resource management
  - API response time handling
  - Scalability across multiple guilds

### 6. Regression Tests (`regressionTests.test.js`)
- **Purpose**: Tests ensuring continued functionality during updates
- **Coverage**: Backward compatibility and stability
- **Timeout**: 30 seconds
- **Key Areas**:
  - Command structure compatibility
  - API compatibility with Naffles backend
  - Database schema compatibility
  - Discord.js integration stability
  - Error handling consistency
  - Configuration compatibility

## Mock Discord Client

The test suite includes a comprehensive mock Discord client (`mockDiscordClient.js`) that simulates Discord.js behavior without requiring actual Discord API calls:

- **MockDiscordClient**: Full Discord client simulation
- **MockGuild**: Guild management and member operations
- **MockTextChannel**: Channel operations and message handling
- **MockUser**: User management and interactions
- **MockInteraction**: Command and button interaction simulation
- **Event Simulation**: Guild events, member events, interaction events

## Running Tests

### Individual Test Suites
```bash
# Run specific test types
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e           # End-to-end tests only
npm run test:security      # Security tests only
npm run test:performance   # Performance tests only
npm run test:regression    # Regression tests only
```

### Comprehensive Test Runner
```bash
# Run all tests with detailed reporting
npm run test:comprehensive

# Run with coverage reporting
npm run test:comprehensive:coverage

# Run in watch mode for development
npm run test:comprehensive:watch

# Run specific suites only
npm run test:comprehensive -- --only=unit,security

# CI/CD optimized run
npm run test:ci
```

### Standard Jest Commands
```bash
# Basic test run
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- **Coverage Thresholds**: 75-95% depending on component criticality
- **Timeout Settings**: Varied by test type (30s-120s)
- **Projects**: Separate configurations for each test suite
- **Global Setup/Teardown**: MongoDB and environment management
- **Coverage Reporting**: Multiple formats (text, lcov, html, json)

### Environment Setup
- **MongoDB**: In-memory server for isolated testing
- **Redis**: Mock implementation for caching tests
- **Environment Variables**: Test-specific configuration
- **Mock Services**: External API and service mocking

## Test Reports

### Automated Reports
- **test-results.json**: Detailed test execution results
- **test-summary.md**: Human-readable summary report
- **coverage/**: Coverage reports in multiple formats
- **test-report.json**: Comprehensive test runner report

### Coverage Reports
- **HTML Report**: `coverage/lcov-report/index.html`
- **JSON Report**: `coverage/coverage-final.json`
- **LCOV Report**: `coverage/lcov.info`
- **Text Summary**: Console output during test runs

## Best Practices

### Writing Tests
1. **Isolation**: Each test should be independent and not rely on others
2. **Mocking**: Use comprehensive mocks for external dependencies
3. **Assertions**: Include meaningful assertions that verify expected behavior
4. **Error Cases**: Test both success and failure scenarios
5. **Performance**: Include performance expectations where relevant

### Test Data
1. **Realistic Data**: Use realistic test data that mirrors production
2. **Edge Cases**: Include boundary conditions and edge cases
3. **Security**: Test with malicious inputs and security scenarios
4. **Cleanup**: Ensure proper cleanup after each test

### Maintenance
1. **Regular Updates**: Keep tests updated with code changes
2. **Coverage Monitoring**: Maintain high test coverage
3. **Performance Baselines**: Monitor test performance over time
4. **Documentation**: Keep test documentation current

## Troubleshooting

### Common Issues
1. **MongoDB Connection**: Ensure MongoDB Memory Server starts correctly
2. **Timeout Errors**: Increase timeout for slow operations
3. **Mock Failures**: Verify mock implementations match real services
4. **Memory Leaks**: Check for proper cleanup in afterEach hooks

### Debug Mode
```bash
# Run with debug output
DEBUG=* npm run test:comprehensive

# Run single test file with verbose output
npx jest tests/comprehensive/unitTests.test.js --verbose

# Run with coverage and debug
npm run test:comprehensive:coverage -- --verbose
```

### Performance Monitoring
- Monitor test execution times
- Check memory usage during tests
- Verify cleanup effectiveness
- Track coverage trends over time

## Contributing

When adding new tests:
1. Follow the existing test structure and patterns
2. Add appropriate mocks for external dependencies
3. Include both positive and negative test cases
4. Update this README if adding new test categories
5. Ensure tests pass in CI environment
6. Maintain or improve coverage thresholds

## CI/CD Integration

The test suite is designed for CI/CD environments:
- **Fast Feedback**: Unit tests run first for quick feedback
- **Parallel Execution**: Tests can run in parallel where possible
- **Coverage Enforcement**: Fails if coverage thresholds not met
- **Detailed Reporting**: Provides comprehensive reports for analysis
- **Environment Agnostic**: Works in various CI environments

For CI/CD pipelines, use:
```bash
npm run test:ci
```

This runs all tests with coverage, fails fast on errors, and generates comprehensive reports suitable for CI/CD analysis.