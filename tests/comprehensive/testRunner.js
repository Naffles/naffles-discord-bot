/**
 * Comprehensive Test Runner for Discord Bot Integration
 * Orchestrates all test suites and provides detailed reporting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ComprehensiveTestRunner {
    constructor() {
        this.testSuites = [
            {
                name: 'Unit Tests',
                file: 'unitTests.test.js',
                description: 'Tests all Discord bot service components and command handlers',
                timeout: 30000
            },
            {
                name: 'Integration Tests',
                file: 'integrationTests.test.js',
                description: 'Tests Discord API interactions and Naffles backend communication',
                timeout: 60000
            },
            {
                name: 'End-to-End Tests',
                file: 'endToEndTests.test.js',
                description: 'Tests complete user workflows from Discord to task completion',
                timeout: 90000
            },
            {
                name: 'Security Tests',
                file: 'securityTests.test.js',
                description: 'Tests permission validation and anti-abuse measures',
                timeout: 45000
            },
            {
                name: 'Performance Tests',
                file: 'performanceTests.test.js',
                description: 'Tests handling of multiple concurrent Discord interactions',
                timeout: 120000
            },
            {
                name: 'Regression Tests',
                file: 'regressionTests.test.js',
                description: 'Tests ensuring continued functionality during updates',
                timeout: 30000
            }
        ];

        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            suites: []
        };
    }

    async runAllTests(options = {}) {
        console.log('🚀 Starting Comprehensive Discord Bot Test Suite\n');
        
        const startTime = Date.now();
        
        for (const suite of this.testSuites) {
            if (options.only && !options.only.includes(suite.name.toLowerCase().replace(/\s+/g, '-'))) {
                console.log(`⏭️  Skipping ${suite.name} (not in --only filter)`);
                continue;
            }

            await this.runTestSuite(suite, options);
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        this.generateReport(totalTime);
        
        return this.results.failed === 0;
    }

    async runTestSuite(suite, options = {}) {
        console.log(`\n📋 Running ${suite.name}`);
        console.log(`   ${suite.description}`);
        console.log(`   Timeout: ${suite.timeout}ms\n`);

        const suiteResult = {
            name: suite.name,
            file: suite.file,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            errors: []
        };

        const startTime = Date.now();

        try {
            
            const jestCommand = [
                'npx jest',
                `--testPathPattern=${suite.file}`,
                '--verbose',
                '--no-cache',
                `--testTimeout=${suite.timeout}`,
                options.coverage ? '--coverage' : '',
                options.watch ? '--watch' : '',
                options.bail ? '--bail' : '',
                '--detectOpenHandles',
                '--forceExit'
            ].filter(Boolean).join(' ');

            console.log(`   Command: ${jestCommand}\n`);

            const output = execSync(jestCommand, {
                cwd: path.join(__dirname, '../..'),
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: suite.timeout + 10000 // Add buffer time
            });

            const endTime = Date.now();
            suiteResult.duration = endTime - startTime;

            // Parse Jest output
            this.parseJestOutput(output, suiteResult);

            if (suiteResult.failed === 0) {
                console.log(`✅ ${suite.name} completed successfully`);
                console.log(`   Tests: ${suiteResult.passed} passed, ${suiteResult.skipped} skipped`);
                console.log(`   Duration: ${suiteResult.duration}ms`);
            } else {
                console.log(`❌ ${suite.name} failed`);
                console.log(`   Tests: ${suiteResult.passed} passed, ${suiteResult.failed} failed, ${suiteResult.skipped} skipped`);
                console.log(`   Duration: ${suiteResult.duration}ms`);
            }

        } catch (error) {
            const endTime = Date.now();
            suiteResult.duration = endTime - startTime;
            suiteResult.failed = 1;
            suiteResult.errors.push({
                message: error.message,
                stack: error.stack
            });

            console.log(`💥 ${suite.name} crashed`);
            console.log(`   Error: ${error.message}`);
            console.log(`   Duration: ${suiteResult.duration}ms`);
        }

        this.results.suites.push(suiteResult);
        this.results.total += suiteResult.passed + suiteResult.failed + suiteResult.skipped;
        this.results.passed += suiteResult.passed;
        this.results.failed += suiteResult.failed;
        this.results.skipped += suiteResult.skipped;
    }

    parseJestOutput(output, suiteResult) {
        const lines = output.split('\n');
        
        for (const line of lines) {
            // Parse test results
            if (line.includes('✓') || line.includes('PASS')) {
                suiteResult.passed++;
            } else if (line.includes('✗') || line.includes('FAIL')) {
                suiteResult.failed++;
            } else if (line.includes('○') || line.includes('SKIP')) {
                suiteResult.skipped++;
            }

            // Capture errors
            if (line.includes('Error:') || line.includes('Failed:')) {
                suiteResult.errors.push({
                    message: line.trim(),
                    stack: null
                });
            }
        }
    }

    generateReport(totalTime) {
        console.log('\n' + '='.repeat(80));
        console.log('📊 COMPREHENSIVE TEST RESULTS');
        console.log('='.repeat(80));

        console.log(`\n⏱️  Total Execution Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
        console.log(`📈 Overall Results: ${this.results.passed} passed, ${this.results.failed} failed, ${this.results.skipped} skipped`);
        
        if (this.results.failed === 0) {
            console.log('🎉 ALL TESTS PASSED!');
        } else {
            console.log(`❌ ${this.results.failed} TEST(S) FAILED`);
        }

        console.log('\n📋 Suite Breakdown:');
        console.log('-'.repeat(80));

        for (const suite of this.results.suites) {
            const status = suite.failed === 0 ? '✅' : '❌';
            const duration = `${suite.duration}ms`;
            const results = `${suite.passed}P/${suite.failed}F/${suite.skipped}S`;
            
            console.log(`${status} ${suite.name.padEnd(20)} ${results.padEnd(15)} ${duration.padStart(10)}`);
            
            if (suite.errors.length > 0) {
                suite.errors.forEach(error => {
                    console.log(`   ⚠️  ${error.message}`);
                });
            }
        }

        // Generate detailed report file
        this.generateDetailedReport(totalTime);

        console.log('\n📄 Detailed report saved to: tests/comprehensive/test-report.json');
        console.log('='.repeat(80));
    }

    generateDetailedReport(totalTime) {
        const report = {
            timestamp: new Date().toISOString(),
            totalDuration: totalTime,
            summary: {
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                skipped: this.results.skipped,
                successRate: this.results.total > 0 ? (this.results.passed / this.results.total * 100).toFixed(2) : 0
            },
            suites: this.results.suites.map(suite => ({
                name: suite.name,
                file: suite.file,
                duration: suite.duration,
                results: {
                    passed: suite.passed,
                    failed: suite.failed,
                    skipped: suite.skipped
                },
                errors: suite.errors,
                status: suite.failed === 0 ? 'PASSED' : 'FAILED'
            })),
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                memory: process.memoryUsage(),
                env: {
                    NODE_ENV: process.env.NODE_ENV,
                    CI: process.env.CI
                }
            }
        };

        const reportPath = path.join(__dirname, 'test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    }

    static async run() {
        const args = process.argv.slice(2);
        const options = {
            coverage: args.includes('--coverage'),
            watch: args.includes('--watch'),
            bail: args.includes('--bail'),
            only: args.find(arg => arg.startsWith('--only='))?.split('=')[1]?.split(',')
        };

        const runner = new ComprehensiveTestRunner();
        const success = await runner.runAllTests(options);
        
        process.exit(success ? 0 : 1);
    }
}

// Run if called directly
if (require.main === module) {
    ComprehensiveTestRunner.run().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = ComprehensiveTestRunner;