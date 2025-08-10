const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

// Migration tracking schema
const migrationSchema = new mongoose.Schema({
    version: {
        type: String,
        required: true,
        unique: true
    },
    description: String,
    appliedAt: {
        type: Date,
        default: Date.now
    },
    executionTime: Number, // milliseconds
    status: {
        type: String,
        enum: ['completed', 'failed', 'rolled_back'],
        default: 'completed'
    },
    error: String
}, {
    timestamps: true
});

const Migration = mongoose.model('Migration', migrationSchema);

class MigrationRunner {
    constructor() {
        this.migrationsPath = __dirname;
        this.migrations = new Map();
    }

    async initialize() {
        try {
            // Ensure migrations collection exists
            await Migration.createCollection().catch(() => {
                // Collection might already exist, ignore error
            });

            // Load all migration files
            await this.loadMigrations();

            logger.info('Migration runner initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize migration runner:', error);
            throw error;
        }
    }

    async loadMigrations() {
        try {
            const files = await fs.readdir(this.migrationsPath);
            const migrationFiles = files
                .filter(file => file.match(/^\d{3}-.*\.js$/) && file !== 'migrationRunner.js')
                .sort();

            for (const file of migrationFiles) {
                const filePath = path.join(this.migrationsPath, file);
                const migration = require(filePath);
                
                if (!migration.version || !migration.up || !migration.down) {
                    logger.warn(`Invalid migration file: ${file}. Skipping.`);
                    continue;
                }

                this.migrations.set(migration.version, {
                    ...migration,
                    filename: file
                });
            }

            logger.info(`Loaded ${this.migrations.size} migration files`);
        } catch (error) {
            logger.error('Failed to load migrations:', error);
            throw error;
        }
    }

    async getAppliedMigrations() {
        try {
            const applied = await Migration.find({ status: 'completed' })
                .sort({ appliedAt: 1 })
                .select('version description appliedAt');
            
            return applied.map(m => m.version);
        } catch (error) {
            logger.error('Failed to get applied migrations:', error);
            throw error;
        }
    }

    async getPendingMigrations() {
        try {
            const appliedVersions = await this.getAppliedMigrations();
            const allVersions = Array.from(this.migrations.keys()).sort();
            
            return allVersions.filter(version => !appliedVersions.includes(version));
        } catch (error) {
            logger.error('Failed to get pending migrations:', error);
            throw error;
        }
    }

    async runMigration(version, direction = 'up') {
        const migration = this.migrations.get(version);
        if (!migration) {
            throw new Error(`Migration ${version} not found`);
        }

        const startTime = Date.now();
        
        try {
            logger.info(`Running migration ${version} (${direction}): ${migration.description}`);

            // Execute migration
            if (direction === 'up') {
                await migration.up();
            } else {
                await migration.down();
            }

            const executionTime = Date.now() - startTime;

            // Record migration
            if (direction === 'up') {
                await Migration.findOneAndUpdate(
                    { version },
                    {
                        version,
                        description: migration.description,
                        appliedAt: new Date(),
                        executionTime,
                        status: 'completed'
                    },
                    { upsert: true }
                );
            } else {
                await Migration.findOneAndUpdate(
                    { version },
                    {
                        status: 'rolled_back',
                        executionTime
                    }
                );
            }

            logger.info(`Migration ${version} ${direction} completed successfully in ${executionTime}ms`);
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            // Record failed migration
            await Migration.findOneAndUpdate(
                { version },
                {
                    version,
                    description: migration.description,
                    appliedAt: new Date(),
                    executionTime,
                    status: 'failed',
                    error: error.message
                },
                { upsert: true }
            );

            logger.error(`Migration ${version} ${direction} failed after ${executionTime}ms:`, error);
            throw error;
        }
    }

    async migrate() {
        try {
            const pendingMigrations = await this.getPendingMigrations();
            
            if (pendingMigrations.length === 0) {
                logger.info('No pending migrations to run');
                return;
            }

            logger.info(`Running ${pendingMigrations.length} pending migrations`);

            for (const version of pendingMigrations) {
                await this.runMigration(version, 'up');
            }

            logger.info('All migrations completed successfully');
            
        } catch (error) {
            logger.error('Migration process failed:', error);
            throw error;
        }
    }

    async rollback(targetVersion = null) {
        try {
            const appliedMigrations = await this.getAppliedMigrations();
            
            if (appliedMigrations.length === 0) {
                logger.info('No migrations to rollback');
                return;
            }

            let migrationsToRollback;
            
            if (targetVersion) {
                const targetIndex = appliedMigrations.indexOf(targetVersion);
                if (targetIndex === -1) {
                    throw new Error(`Target migration ${targetVersion} not found in applied migrations`);
                }
                migrationsToRollback = appliedMigrations.slice(targetIndex + 1).reverse();
            } else {
                // Rollback only the last migration
                migrationsToRollback = [appliedMigrations[appliedMigrations.length - 1]];
            }

            logger.info(`Rolling back ${migrationsToRollback.length} migrations`);

            for (const version of migrationsToRollback) {
                await this.runMigration(version, 'down');
            }

            logger.info('Rollback completed successfully');
            
        } catch (error) {
            logger.error('Rollback process failed:', error);
            throw error;
        }
    }

    async getStatus() {
        try {
            const appliedMigrations = await Migration.find()
                .sort({ appliedAt: 1 })
                .select('version description appliedAt status executionTime error');
            
            const pendingMigrations = await this.getPendingMigrations();
            
            return {
                applied: appliedMigrations,
                pending: pendingMigrations.map(version => ({
                    version,
                    description: this.migrations.get(version)?.description || 'No description'
                })),
                totalMigrations: this.migrations.size,
                appliedCount: appliedMigrations.length,
                pendingCount: pendingMigrations.length
            };
        } catch (error) {
            logger.error('Failed to get migration status:', error);
            throw error;
        }
    }

    async validateMigrations() {
        try {
            const issues = [];
            
            // Check for duplicate versions
            const versions = Array.from(this.migrations.keys());
            const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);
            if (duplicates.length > 0) {
                issues.push(`Duplicate migration versions found: ${duplicates.join(', ')}`);
            }

            // Check for missing migrations in sequence
            const appliedMigrations = await this.getAppliedMigrations();
            for (const appliedVersion of appliedMigrations) {
                if (!this.migrations.has(appliedVersion)) {
                    issues.push(`Applied migration ${appliedVersion} not found in migration files`);
                }
            }

            // Check migration file format
            for (const [version, migration] of this.migrations) {
                if (typeof migration.up !== 'function') {
                    issues.push(`Migration ${version} missing 'up' function`);
                }
                if (typeof migration.down !== 'function') {
                    issues.push(`Migration ${version} missing 'down' function`);
                }
                if (!migration.description) {
                    issues.push(`Migration ${version} missing description`);
                }
            }

            return {
                isValid: issues.length === 0,
                issues
            };
        } catch (error) {
            logger.error('Failed to validate migrations:', error);
            throw error;
        }
    }

    async createMigration(name, description = '') {
        try {
            const timestamp = Date.now();
            const version = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
            const filename = `${String(this.migrations.size + 1).padStart(3, '0')}-${name.toLowerCase().replace(/\s+/g, '-')}.js`;
            
            const template = `const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Migration: ${name}
 * Version: ${version}
 * Description: ${description}
 */

const migration = {
    version: '${version}',
    description: '${description}',
    
    async up() {
        try {
            logger.info('Running migration: ${name}');

            const db = mongoose.connection.db;

            // Add your migration logic here
            
            logger.info('Migration ${name} completed successfully');
            
        } catch (error) {
            logger.error('Migration ${name} failed:', error);
            throw error;
        }
    },

    async down() {
        try {
            logger.info('Rolling back migration: ${name}');

            const db = mongoose.connection.db;

            // Add your rollback logic here
            
            logger.info('Migration ${name} rollback completed');
            
        } catch (error) {
            logger.error('Migration ${name} rollback failed:', error);
            throw error;
        }
    }
};

module.exports = migration;`;

            const filePath = path.join(this.migrationsPath, filename);
            await fs.writeFile(filePath, template);
            
            logger.info(`Created migration file: ${filename}`);
            
            // Reload migrations
            await this.loadMigrations();
            
            return {
                filename,
                version,
                path: filePath
            };
        } catch (error) {
            logger.error('Failed to create migration:', error);
            throw error;
        }
    }
}

module.exports = MigrationRunner;