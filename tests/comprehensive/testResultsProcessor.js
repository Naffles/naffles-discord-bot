/**
 * Test Results Processor for Comprehensive Discord Bot Testing
 * Processes and formats test results for detailed reporting
 */

const fs = require('fs');
const path = require('path');

class TestResultsProcessor {
    constructor() {
        this.reportPath = path.join(__dirname, 'test-results.json');
    }

    process(results) {
        const processedResults = {
            timestamp: new Date().toISOString(),
            summary: {
                numTotalTests: results.numTotalTests,
                numPassedTests: results.numPassedTests,
                numFailedTests: results.numFailedTests,
                numPendingTests: results.numPendingTests,
                numTodoTests: results.numTodoTests,
                success: results.success,
                startTime: results.startTime,
                testResults: results.testResults.length
            },
            coverage: results.coverageMap ? this.processCoverage(results.coverageMap) : null,
            testSuites: results.testResults.map(testResult => ({
                name: testResult.testFilePath.split('/').pop(),
                path: testResult.testFilePath,
                duration: testResult.perfStats.end - testResult.perfStats.start,
                status: testResult.numFailingTests === 0 ? 'PASSED' : 'FAILED',
                tests: {
                    total: testResult.numPassingTests + testResult.numFailingTests + testResult.numPendingTests,
                    passed: testResult.numPassingTests,
                    failed: testResult.numFailingTests,
                    pending: testResult.numPendingTests,
                    todo: testResult.numTodoTests
                },
                failures: testResult.testResults
                    .filter(test => test.status === 'failed')
                    .map(test => ({
                        name: test.fullName,
                        message: test.failureMessages.join('\n'),
                        duration: test.duration
                    })),
                performance: {
                    slow: testResult.testResults.filter(test => test.duration > 5000).length,
                    average: testResult.testResults.length > 0 
                        ? testResult.testResults.reduce((sum, test) => sum + test.duration, 0) / testResult.testResults.length 
                        : 0
                }
            })),
            performance: {
                totalDuration: results.testResults.reduce((sum, result) => 
                    sum + (result.perfStats.end - result.perfStats.start), 0),
                slowestSuite: this.findSlowestSuite(results.testResults),
                fastestSuite: this.findFastestSuite(results.testResults),
                averageSuiteDuration: results.testResults.length > 0 
                    ? results.testResults.reduce((sum, result) => 
                        sum + (result.perfStats.end - result.perfStats.start), 0) / results.testResults.length 
                    : 0
            },
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                memory: process.memoryUsage(),
                ci: !!process.env.CI,
                testTimeout: 30000
            }
        };

        // Save detailed results
        this.saveResults(processedResults);

        // Generate summary report
        this.generateSummaryReport(processedResults);

        return results;
    }

    processCoverage(coverageMap) {
        if (!coverageMap || typeof coverageMap.getCoverageSummary !== 'function') {
            return null;
        }

        const summary = coverageMap.getCoverageSummary();
        
        return {
            lines: {
                total: summary.lines.total,
                covered: summary.lines.covered,
                percentage: summary.lines.pct
            },
            functions: {
                total: summary.functions.total,
                covered: summary.functions.covered,
                percentage: summary.functions.pct
            },
            branches: {
                total: summary.branches.total,
                covered: summary.branches.covered,
                percentage: summary.branches.pct
            },
            statements: {
                total: summary.statements.total,
                covered: summary.statements.covered,
                percentage: summary.statements.pct
            }
        };
    }

    findSlowestSuite(testResults) {
        if (testResults.length === 0) return null;

        return testResults.reduce((slowest, current) => {
            const currentDuration = current.perfStats.end - current.perfStats.start;
            const slowestDuration = slowest.perfStats.end - slowest.perfStats.start;
            return currentDuration > slowestDuration ? current : slowest;
        });
    }

    findFastestSuite(testResults) {
        if (testResults.length === 0) return null;

        return testResults.reduce((fastest, current) => {
            const currentDuration = current.perfStats.end - current.perfStats.start;
            const fastestDuration = fastest.perfStats.end - fastest.perfStats.start;
            return currentDuration < fastestDuration ? current : fastest;
        });
    }

    saveResults(results) {
        try {
            fs.writeFileSync(this.reportPath, JSON.stringify(results, null, 2));
            console.log(`📊 Detailed test results saved to: ${this.reportPath}`);
        } catch (error) {
            console.error('Failed to save test results:', error.message);
        }
    }

    generateSummaryReport(results) {
        const summaryPath = path.join(__dirname, 'test-summary.md');
        
        const summary = `# Discord Bot Test Summary

## Overview
- **Timestamp**: ${results.timestamp}
- **Total Tests**: ${results.summary.numTotalTests}
- **Passed**: ${results.summary.numPassedTests} ✅
- **Failed**: ${results.summary.numFailedTests} ❌
- **Pending**: ${results.summary.numPendingTests} ⏳
- **Success Rate**: ${results.summary.numTotalTests > 0 ? ((results.summary.numPassedTests / results.summary.numTotalTests) * 100).toFixed(2) : 0}%

## Performance
- **Total Duration**: ${results.performance.totalDuration}ms
- **Average Suite Duration**: ${results.performance.averageSuiteDuration.toFixed(2)}ms
- **Slowest Suite**: ${results.performance.slowestSuite ? results.performance.slowestSuite.testFilePath.split('/').pop() : 'N/A'}
- **Fastest Suite**: ${results.performance.fastestSuite ? results.performance.fastestSuite.testFilePath.split('/').pop() : 'N/A'}

## Coverage
${results.coverage ? `
- **Lines**: ${results.coverage.lines.percentage}% (${results.coverage.lines.covered}/${results.coverage.lines.total})
- **Functions**: ${results.coverage.functions.percentage}% (${results.coverage.functions.covered}/${results.coverage.functions.total})
- **Branches**: ${results.coverage.branches.percentage}% (${results.coverage.branches.covered}/${results.coverage.branches.total})
- **Statements**: ${results.coverage.statements.percentage}% (${results.coverage.statements.covered}/${results.coverage.statements.total})
` : '- Coverage data not available'}

## Test Suites

${results.testSuites.map(suite => `
### ${suite.name} ${suite.status === 'PASSED' ? '✅' : '❌'}
- **Duration**: ${suite.duration}ms
- **Tests**: ${suite.tests.passed}/${suite.tests.total} passed
- **Average Test Duration**: ${suite.performance.average.toFixed(2)}ms
- **Slow Tests**: ${suite.performance.slow}

${suite.failures.length > 0 ? `
**Failures:**
${suite.failures.map(failure => `- ${failure.name}: ${failure.message.split('\n')[0]}`).join('\n')}
` : ''}
`).join('')}

## Environment
- **Node Version**: ${results.environment.nodeVersion}
- **Platform**: ${results.environment.platform}
- **Architecture**: ${results.environment.arch}
- **CI Environment**: ${results.environment.ci ? 'Yes' : 'No'}
- **Memory Usage**: ${(results.environment.memory.heapUsed / 1024 / 1024).toFixed(2)}MB

---
*Generated by Discord Bot Comprehensive Test Suite*
`;

        try {
            fs.writeFileSync(summaryPath, summary);
            console.log(`📋 Test summary saved to: ${summaryPath}`);
        } catch (error) {
            console.error('Failed to save test summary:', error.message);
        }
    }
}

module.exports = (results) => {
    const processor = new TestResultsProcessor();
    return processor.process(results);
};