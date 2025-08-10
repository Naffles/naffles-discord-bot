const express = require('express');
const path = require('path');
const logger = require('../utils/logger');

class MonitoringDashboard {
    constructor(botService, databaseService, redisService, healthMonitor) {
        this.app = express();
        this.botService = botService;
        this.databaseService = databaseService;
        this.redisService = redisService;
        this.healthMonitor = healthMonitor;
        this.port = process.env.MONITORING_PORT || 3001;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // CORS for development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const health = this.getHealthStatus();
            res.status(health.status === 'healthy' ? 200 : 503).json(health);
        });

        // Detailed health report
        this.app.get('/health/detailed', (req, res) => {
            const report = this.healthMonitor.getHealthReport();
            res.json(report);
        });

        // Bot metrics
        this.app.get('/metrics', (req, res) => {
            const metrics = this.getBotMetrics();
            res.json(metrics);
        });

        // Connection status
        this.app.get('/status/connections', (req, res) => {
            const connections = this.getConnectionStatus();
            res.json(connections);
        });

        // Guild information
        this.app.get('/guilds', async (req, res) => {
            try {
                const guilds = await this.getGuildInformation();
                res.json(guilds);
            } catch (error) {
                logger.error('Failed to get guild information:', error);
                res.status(500).json({ error: 'Failed to retrieve guild information' });
            }
        });

        // Interaction logs
        this.app.get('/logs/interactions', async (req, res) => {
            try {
                const { limit = 100, guildId, action } = req.query;
                const filters = {};
                
                if (guildId) filters.guildId = guildId;
                if (action) filters.action = action;
                
                const logs = await this.databaseService.getInteractionLogs(filters, parseInt(limit));
                res.json(logs);
            } catch (error) {
                logger.error('Failed to get interaction logs:', error);
                res.status(500).json({ error: 'Failed to retrieve interaction logs' });
            }
        });

        // Interaction statistics
        this.app.get('/stats/interactions/:guildId', async (req, res) => {
            try {
                const { guildId } = req.params;
                const { timeRange = 24 } = req.query;
                
                const stats = await this.databaseService.getInteractionStats(guildId, parseInt(timeRange));
                res.json(stats);
            } catch (error) {
                logger.error('Failed to get interaction stats:', error);
                res.status(500).json({ error: 'Failed to retrieve interaction statistics' });
            }
        });

        // Performance metrics
        this.app.get('/performance', (req, res) => {
            const performance = this.getPerformanceMetrics();
            res.json(performance);
        });

        // Configuration endpoint
        this.app.get('/config', (req, res) => {
            const config = this.getConfiguration();
            res.json(config);
        });

        // Update health monitor configuration
        this.app.post('/config/health', (req, res) => {
            try {
                this.healthMonitor.updateConfiguration(req.body);
                res.json({ success: true, message: 'Health monitor configuration updated' });
            } catch (error) {
                logger.error('Failed to update health monitor config:', error);
                res.status(500).json({ error: 'Failed to update configuration' });
            }
        });

        // Dashboard HTML
        this.app.get('/', (req, res) => {
            res.send(this.getDashboardHTML());
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Endpoint not found' });
        });

        // Error handler
        this.app.use((error, req, res, next) => {
            logger.error('Dashboard error:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    getHealthStatus() {
        const healthReport = this.healthMonitor.getHealthReport();
        
        return {
            status: healthReport.overall,
            timestamp: healthReport.timestamp,
            services: healthReport.services.map(service => ({
                name: service.name,
                status: service.status,
                responseTime: service.responseTime
            })),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0'
        };
    }

    getBotMetrics() {
        const botMetrics = this.botService.getMetrics();
        const memoryUsage = process.memoryUsage();
        
        return {
            ...botMetrics,
            memory: {
                rss: Math.round(memoryUsage.rss / 1024 / 1024),
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                external: Math.round(memoryUsage.external / 1024 / 1024)
            },
            cpu: process.cpuUsage(),
            uptime: process.uptime()
        };
    }

    getConnectionStatus() {
        return {
            discord: {
                connected: this.botService.client?.isReady() || false,
                ping: this.botService.client?.ws?.ping || null,
                guilds: this.botService.client?.guilds?.cache?.size || 0
            },
            database: {
                connected: this.databaseService.isHealthy(),
                info: this.databaseService.getConnectionInfo()
            },
            redis: {
                connected: this.redisService.isConnected(),
                info: this.redisService.getConnectionInfo()
            },
            nafflesApi: this.botService.getConnectionStatus()
        };
    }

    async getGuildInformation() {
        if (!this.botService.client?.isReady()) {
            return [];
        }

        const guilds = [];
        
        for (const [guildId, guild] of this.botService.client.guilds.cache) {
            try {
                const mapping = await this.databaseService.getServerCommunityMapping(guildId);
                
                guilds.push({
                    id: guild.id,
                    name: guild.name,
                    memberCount: guild.memberCount,
                    joinedAt: guild.joinedAt,
                    communityId: mapping?.communityId || null,
                    isLinked: !!mapping,
                    permissions: guild.members.me?.permissions.toArray() || []
                });
            } catch (error) {
                logger.error(`Failed to get info for guild ${guild.name}:`, error);
            }
        }

        return guilds;
    }

    getPerformanceMetrics() {
        const metrics = this.getBotMetrics();
        
        return {
            responseTime: {
                average: metrics.averageResponseTime || 0,
                p95: metrics.p95ResponseTime || 0,
                p99: metrics.p99ResponseTime || 0
            },
            throughput: {
                commandsPerMinute: metrics.commandsProcessed / (metrics.uptimeHours * 60) || 0,
                errorsPerMinute: metrics.errorsEncountered / (metrics.uptimeHours * 60) || 0
            },
            reliability: {
                successRate: metrics.commandsProcessed > 0 ? 
                    ((metrics.commandsProcessed - metrics.errorsEncountered) / metrics.commandsProcessed * 100) : 100,
                apiSuccessRate: (metrics.apiCallsSuccessful + metrics.apiCallsFailed) > 0 ?
                    (metrics.apiCallsSuccessful / (metrics.apiCallsSuccessful + metrics.apiCallsFailed) * 100) : 100
            }
        };
    }

    getConfiguration() {
        return {
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            monitoring: {
                port: this.port,
                healthCheckInterval: this.healthMonitor.checkInterval
            },
            discord: {
                clientId: process.env.DISCORD_CLIENT_ID,
                guildCount: this.botService.client?.guilds?.cache?.size || 0
            },
            api: {
                baseUrl: process.env.NAFFLES_API_BASE_URL,
                timeout: 10000
            }
        };
    }

    getDashboardHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Naffles Discord Bot - Monitoring Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #7C3AED; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status-healthy { color: #10B981; }
        .status-unhealthy { color: #EF4444; }
        .status-degraded { color: #F59E0B; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; }
        .refresh-btn { background: #7C3AED; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        .refresh-btn:hover { background: #6D28D9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Naffles Discord Bot</h1>
            <p>Monitoring Dashboard</p>
            <button class="refresh-btn" onclick="location.reload()">Refresh</button>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>Health Status</h3>
                <div id="health-status">Loading...</div>
            </div>
            
            <div class="card">
                <h3>Bot Metrics</h3>
                <div id="bot-metrics">Loading...</div>
            </div>
            
            <div class="card">
                <h3>Connection Status</h3>
                <div id="connection-status">Loading...</div>
            </div>
            
            <div class="card">
                <h3>Performance</h3>
                <div id="performance-metrics">Loading...</div>
            </div>
        </div>
        
        <div class="card">
            <h3>Guild Information</h3>
            <div id="guild-info">Loading...</div>
        </div>
    </div>

    <script>
        async function loadDashboardData() {
            try {
                // Load health status
                const health = await fetch('/health').then(r => r.json());
                document.getElementById('health-status').innerHTML = 
                    '<div class="metric"><span>Overall Status:</span><span class="status-' + health.status + '">' + health.status.toUpperCase() + '</span></div>' +
                    '<div class="metric"><span>Uptime:</span><span>' + Math.round(health.uptime / 3600) + ' hours</span></div>' +
                    '<div class="metric"><span>Version:</span><span>' + health.version + '</span></div>';

                // Load bot metrics
                const metrics = await fetch('/metrics').then(r => r.json());
                document.getElementById('bot-metrics').innerHTML = 
                    '<div class="metric"><span>Commands Processed:</span><span>' + metrics.commandsProcessed + '</span></div>' +
                    '<div class="metric"><span>Errors:</span><span>' + metrics.errorsEncountered + '</span></div>' +
                    '<div class="metric"><span>Memory Usage:</span><span>' + metrics.memory.heapUsed + ' MB</span></div>';

                // Load connection status
                const connections = await fetch('/status/connections').then(r => r.json());
                document.getElementById('connection-status').innerHTML = 
                    '<div class="metric"><span>Discord:</span><span class="status-' + (connections.discord.connected ? 'healthy' : 'unhealthy') + '">' + (connections.discord.connected ? 'Connected' : 'Disconnected') + '</span></div>' +
                    '<div class="metric"><span>Database:</span><span class="status-' + (connections.database.connected ? 'healthy' : 'unhealthy') + '">' + (connections.database.connected ? 'Connected' : 'Disconnected') + '</span></div>' +
                    '<div class="metric"><span>Redis:</span><span class="status-' + (connections.redis.connected ? 'healthy' : 'unhealthy') + '">' + (connections.redis.connected ? 'Connected' : 'Disconnected') + '</span></div>';

                // Load performance metrics
                const performance = await fetch('/performance').then(r => r.json());
                document.getElementById('performance-metrics').innerHTML = 
                    '<div class="metric"><span>Success Rate:</span><span>' + performance.reliability.successRate.toFixed(1) + '%</span></div>' +
                    '<div class="metric"><span>API Success Rate:</span><span>' + performance.reliability.apiSuccessRate.toFixed(1) + '%</span></div>' +
                    '<div class="metric"><span>Commands/Min:</span><span>' + performance.throughput.commandsPerMinute.toFixed(2) + '</span></div>';

                // Load guild information
                const guilds = await fetch('/guilds').then(r => r.json());
                document.getElementById('guild-info').innerHTML = 
                    '<p>Total Guilds: ' + guilds.length + '</p>' +
                    guilds.map(guild => 
                        '<div class="metric"><span>' + guild.name + ' (' + guild.memberCount + ' members)</span><span class="status-' + (guild.isLinked ? 'healthy' : 'degraded') + '">' + (guild.isLinked ? 'Linked' : 'Not Linked') + '</span></div>'
                    ).join('');

            } catch (error) {
                console.error('Failed to load dashboard data:', error);
            }
        }

        // Load data on page load
        loadDashboardData();

        // Auto-refresh every 30 seconds
        setInterval(loadDashboardData, 30000);
    </script>
</body>
</html>`;
    }

    start() {
        this.app.listen(this.port, () => {
            logger.info(`Monitoring dashboard started on port ${this.port}`);
            logger.info(`Dashboard URL: http://localhost:${this.port}`);
        });
    }
}

module.exports = MonitoringDashboard;