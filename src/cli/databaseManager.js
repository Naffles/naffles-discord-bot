#!/usr/bin/env node

const { Command } = require('commander');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const EnhancedDatabaseService = require('../services/enhancedDatabaseService');
const DataCleanupService = require('../services/dataCleanupService');
const MigrationRunner = require('../migrations/migrationRunner');

const program = new Command();

// Initialize services
let dbService;
let cleanupService;
let migrationRunner;

async function initializeServices() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        dbService = new EnhancedDatabaseService();
        cleanupService = new DataCleanupService();
        migrationRunner = new MigrationRunner();

        await migrationRunner.initialize();
        
        logger.info('Database services initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize database services:', error);
        process.exit(1);
    }
}

async function cleanup() {
    try {
        if (cleanupService) {
            cleanupService.stop();
        }
        await mongoose.connection.close();
        logger.info('Database connection closed');
    } catch (error) {
        logger.error('Error during cleanup:', error);
    }
}

// Migration commands
program
    .command('migrate')
    .description('Run pending database migrations')
    .action(async () => {
        await initializeServices();
        try {
            await migrationRunner.migrate();
            logger.info('Migrations completed successfully');
        } catch (error) {
            logger.error('Migration failed:', error);
            process.exit(1);
        } finally {
            await cleanup();
        }
    });

program
    .command('migration:status')
    .description('Show migration status')
    .action(async () => {
        await initializeServices();
        try {
            const status = await migrationRunner.getStatus();
            console.log('\n=== Migration Status ===');
            console.log(`Total migrations: ${status.totalMigrations}`);
            console.log(`Applied: ${status.appliedCount}`);
            console.log(`Pending: ${status.pendingCount}`);
            
            if (status.applied.length > 0) {
                console.log('\n--- Applied Migrations ---');
                status.applied.forEach(migration => {
                    console.log(`✓ ${migration.version} - ${migration.description} (${migration.appliedAt})`);
                });
            }
            
            if (status.pending.length > 0) {
                console.log('\n--- Pending Migrations ---');
                status.pending.forEach(migration => {
                    console.log(`○ ${migration.version} - ${migration.description}`);
                });
            }
        } catch (error) {
            logger.error('Failed to get migration status:', error);
            process.exit(1);
        } finally {
            await cleanup();
        }
    });

program
    .command('migration:rollback')
    .description('Rollback the last migration')
    .option('-t, --target <version>', 'Target migration version to rollback to')
    .action(async (options) => {
        await initializeServices();
        try {
            await migrationRunner.rollback(options.target);
            logger.info('Rollback completed successfully');
        } catch (error) {
            logger.error('Rollback failed:', error);
            process.exit(1);
        } finally {
            await cleanup();
        }
    });

program
    .command('migration:create')
    .description('Create a new migration file')
    .argument('<name>', 'Migration name')
    .option('-d, --description <desc>', 'Migration description', '')
    .action(async (name, options) => {
        await initializeServices();
        try {
            const result = await migrationRunner.createMigration(name, options.description);
            logger.info(`Migration created: ${result.filename}`);
            console.log(`File path: ${result.path}`);
        } catch (error) {
            logger.error('Failed to create migration:', error);
            process.exit(1);
        } finally {
            await cleanup();
        }
    });

program
    .command('migration:validate')
    .description('Validate migration files')
    .action(async () => {
        await initializeServices();
        try {
            const validation = await migrationRunner.validateMigrations();
            
            if (validation.isValid) {
                logger.info('All migrations are valid');
            } else {
                logger.error('Migration validation failed:');
                validation.issues.forEach(issue => {
                    console.log(`  ✗ ${issue}`);
                });
                process.exit(1);
            }
        } catch (error) {
            logger.error('Migration validation failed:', error);
            process.exit(1);
        } finally {
            await cleanup();
        }
    });

// Cleanup commands
program
    .command('cleanup')
    .description('Run database cleanup')
    .option('--logs', 'Clean up old interaction logs', true)
    .option('--tokens', 'Clean up expired tokens', true)
    .option('--expired', 'Clean up expired tasks and allowlists', true)
    .option('--orphaned', 'Clean up orphaned records', true)
    .option('--inactive', 'Clean up inactive accounts', true)
    .option('--archive', 'Archive old data', true)
    .option('--optimize', 'Optimize database indexes', true)
    .action(async (options) => {
        await initializeServices();
        try {
            const result = await cleanupService.performManualCleanup({
                cleanupLogs: options.logs,
                cleanupTokens: options.tokens,
                cleanupExpired: options.expired,
                cleanupOrphaned: options.orphaned,
                cleanupInactive: options.inactive,
                archiveOld: options.archive,
                optimizeIndexes: options.optimize
            });
            
            console.log('\n=== Cleanup Results ===');
            console.log(`Run time: ${result.runTime}ms`);
            console.log(`Total processed: ${result.totalProcessed}`);
            console.log(`Total deleted: ${result.totalDeleted}`);
            console.log(`Errors: ${result.errors}`);
            
            if (Object.keys(result.details).length > 0) {
                console.log('\n--- Details ---');
                Object.entries(result.details).forEach(([key, value]) => {
                    if (typeof value === 'object') {
                        console.log(`${key}:`, JSON.stringify(value, null, 2));
                    } else {
                        console.log(`${key}: ${value}`);
                    }
                });
            }
            
        } catch (error) {
            logger.error('Cleanup failed:', error);
            process.exit(1);
        } finally {
            await cleanup();
        }
    });

program
    .command('cleanup:stats')
    .description('Show cleanup service statistics')
    .action(async () => {
        await initializeServices();
        try {
            const stats = cleanupService.getStats();
            
            console.log('\n=== Cleanup Statistics ===');
            console.log(`Total runs: ${stats.totalRuns}`);
            console.log(`Total items processed: ${stats.totalItemsProcessed}`);
            console.log(`Total items deleted: ${stats.totalItemsDeleted}`);
            console.log(`Total errors: ${stats.totalErrors}`);
            console.log(`Average run time: ${Math.round(stats.averageRunTime)}ms`);
            console.log(`Is running: ${stats.isRunning}`);
            console.log(`Last cleanup: ${stats.lastCleanup || 'Never'}`);
            console.log(`Next cleanup: ${stats.nextCleanup || 'Not scheduled'}`);
            
        } catch (error) {
            logger.error('Failed to get cleanup stats:', error);
            process.exit(1);
        } finally {
            await cleanup();
        }
    });

// Data analysis commands
program
    .command('data:summary')
    .description('Show database data summary')
    .action(async () => {
        await initializeServices();
        try {
            const summary = await cleanupService.getDataSummary();
            
            console.log('\n=== Database Summary ===');
            console.log(`Generated at: ${summary.generatedAt}`);
            console.log('\n--- Servers ---');
            console.log(`Total: ${summary.servers.total}`);
            console.log(`Active: ${summary.servers.active}`);
            console.log('\n--- Accounts ---');
            console.log(`Total: ${summary.accounts.total}`);
            console.log(`Active: ${summary.accounts.active}`);
            console.log('\n--- Tasks ---');
            console.log(`Total: ${summary.tasks.total}`);
            console.log(`Active: ${summary.tasks.active}`);
            console.log('\n--- Allowlists ---');
            console.log(`Total: ${summary.allowlists.total}`);
            console.log(`Active: ${summary.allowlists.active}`);
            console.log('\n--- Interaction Logs ---');
            console.log(`Total: ${summary.logs.total}`);
            console.log(`Recent (7 days): ${summary.logs.recent}`);
            
        } catch (error) {
            logger.error('Failed to get data summary:', error);
            process.exit(1);
        } finally {
            await cleanup();
        }
    });

program
    .command('data:analytics')
    .description('Show platform analytics')
    .option('-d, --days <days>', 'Number of days to analyze', '30')
    .action(async (options) => {
        await initializeServices();
        try {
            const analytics = await dbService.getPlatformAnalytics(parseInt(options.days));
            
            console.log('\n=== Platform Analytics ===');
            console.log(`Generated at: ${analytics.generatedAt}`);
            console.log(`Analysis period: ${options.days} days`);
            console.log('\n--- Overview ---');
            console.log(`Total servers: ${analytics.totalServers}`);
            console.log(`Total account links: ${analytics.totalAccountLinks}`);
            console.log(`Total tasks: ${analytics.totalTasks}`);
            console.log(`Total allowlists: ${analytics.totalAllowlists}`);
            console.log(`Total interactions: ${analytics.totalInteractions}`);
            
            if (analytics.performanceMetrics) {
                console.log('\n--- Performance ---');
                console.log(`Average response time: ${Math.round(analytics.performanceMetrics.avgResponseTime || 0)}ms`);
                console.log(`Success rate: ${Math.round(analytics.performanceMetrics.successRate || 0)}%`);
                console.log(`Error rate: ${Math.round(analytics.performanceMetrics.errorRate || 0)}%`);
                console.log(`Unique users: ${analytics.performanceMetrics.uniqueUserCount || 0}`);
                console.log(`Unique guilds: ${analytics.performanceMetrics.uniqueGuildCount || 0}`);
            }
            
            if (analytics.systemHealth) {
                console.log('\n--- System Health ---');
                console.log(`Connected: ${analytics.systemHealth.isConnected}`);
                console.log(`Connection state: ${analytics.systemHealth.connectionState}`);
                console.log(`Uptime: ${Math.round(analytics.systemHealth.uptime || 0)}s`);
            }
            
        } catch (error) {
            logger.error('Failed to get platform analytics:', error);
            process.exit(1);
        } finally {
            await cleanup();
        }
    });

// Health check commands
program
    .command('health')
    .description('Check database health')
    .action(async () => {
        await initializeServices();
        try {
            const health = dbService.getSystemHealth();
            
            console.log('\n=== Database Health ===');
            console.log(`Connected: ${health.isConnected ? '✓' : '✗'}`);
            console.log(`Connection state: ${health.connectionState}`);
            console.log(`Uptime: ${Math.round(health.uptime)}s`);
            
            if (health.performanceMetrics) {
                console.log('\n--- Performance Metrics ---');
                console.log(`Total queries: ${health.performanceMetrics.totalQueries}`);
                console.log(`Average query time: ${Math.round(health.performanceMetrics.avgQueryTime)}ms`);
                console.log(`Error count: ${health.performanceMetrics.errorCount}`);
                console.log(`Last health check: ${health.performanceMetrics.lastHealthCheck || 'Never'}`);
            }
            
            console.log('\n--- Memory Usage ---');
            console.log(`RSS: ${Math.round(health.memoryUsage.rss / 1024 / 1024)}MB`);
            console.log(`Heap used: ${Math.round(health.memoryUsage.heapUsed / 1024 / 1024)}MB`);
            console.log(`Heap total: ${Math.round(health.memoryUsage.heapTotal / 1024 / 1024)}MB`);
            
        } catch (error) {
            logger.error('Health check failed:', error);
            process.exit(1);
        } finally {
            await cleanup();
        }
    });

// Index management commands
program
    .command('indexes:rebuild')
    .description('Rebuild database indexes')
    .action(async () => {
        await initializeServices();
        try {
            logger.info('Rebuilding database indexes...');
            
            const db = mongoose.connection.db;
            const collections = [
                'discordservermappings',
                'discordaccountlinks',
                'discordtaskposts',
                'discordallowlistconnections',
                'discordinteractionlogs'
            ];

            for (const collectionName of collections) {
                try {
                    await db.collection(collectionName).reIndex();
                    logger.info(`Rebuilt indexes for ${collectionName}`);
                } catch (error) {
                    logger.warn(`Failed to rebuild indexes for ${collectionName}:`, error.message);
                }
            }
            
            logger.info('Index rebuild completed');
            
        } catch (error) {
            logger.error('Index rebuild failed:', error);
            process.exit(1);
        } finally {
            await cleanup();
        }
    });

// Error handling
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await cleanup();
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Parse command line arguments
program
    .name('discord-db-manager')
    .description('Discord Bot Database Management CLI')
    .version('1.0.0');

program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
    program.outputHelp();
}