# Discord Bot Security Guide

This guide covers security considerations, best practices, and implementation details for the Naffles Discord bot.

## Table of Contents

1. [Security Overview](#security-overview)
2. [Authentication and Authorization](#authentication-and-authorization)
3. [Data Protection](#data-protection)
4. [Network Security](#network-security)
5. [Input Validation](#input-validation)
6. [Rate Limiting and Abuse Prevention](#rate-limiting-and-abuse-prevention)
7. [Monitoring and Logging](#monitoring-and-logging)
8. [Incident Response](#incident-response)
9. [Security Configuration](#security-configuration)
10. [Compliance and Privacy](#compliance-and-privacy)

## Security Overview

The Naffles Discord bot implements multiple layers of security to protect user data, prevent abuse, and ensure reliable operation.

### Security Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discord API   │    │   Naffles API   │    │   Database      │
│                 │    │                 │    │                 │
│ • Rate Limiting │    │ • Authentication│    │ • Encryption    │
│ • Permission    │    │ • Authorization │    │ • Access Control│
│   Validation    │    │ • Input Validation│  │ • Audit Logs    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Discord Bot     │
                    │                 │
                    │ • Token Security│
                    │ • Input Sanitization│
                    │ • Error Handling│
                    │ • Audit Logging │
                    │ • Rate Limiting │
                    └─────────────────┘
```

### Core Security Principles

1. **Defense in Depth**: Multiple security layers
2. **Least Privilege**: Minimal required permissions
3. **Zero Trust**: Verify all inputs and requests
4. **Fail Secure**: Secure defaults and error handling
5. **Audit Everything**: Comprehensive logging and monitoring

## Authentication and Authorization

### Discord Bot Authentication

#### Bot Token Security

**Storage Requirements**:
- Store bot tokens in environment variables only
- Never commit tokens to version control
- Use secrets management in production
- Rotate tokens regularly (every 90 days recommended)

**Token Validation**:
```javascript
// Validate bot token format
const validateBotToken = (token) => {
    // Discord bot tokens follow specific patterns
    const botTokenPattern = /^[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}$/;
    return botTokenPattern.test(token);
};

// Check token validity on startup
const verifyBotToken = async (token) => {
    try {
        const response = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { 'Authorization': `Bot ${token}` }
        });
        return response.ok;
    } catch (error) {
        return false;
    }
};
```

#### OAuth2 Integration

**Secure OAuth Flow**:
```javascript
// OAuth2 configuration
const oauthConfig = {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
    scopes: ['identify', 'guilds'],
    state: generateSecureState() // CSRF protection
};

// State validation for CSRF protection
const validateOAuthState = (receivedState, expectedState) => {
    return crypto.timingSafeEqual(
        Buffer.from(receivedState),
        Buffer.from(expectedState)
    );
};
```

### Naffles API Authentication

#### API Key Management

**Key Generation and Storage**:
```javascript
// API key validation
const validateApiKey = (apiKey) => {
    // Naffles API keys follow specific format
    const apiKeyPattern = /^naf_(live|test)_[A-Za-z0-9]{32}$/;
    return apiKeyPattern.test(apiKey);
};

// Secure API key storage
const apiKeyConfig = {
    key: process.env.NAFFLES_API_KEY,
    environment: process.env.NODE_ENV === 'production' ? 'live' : 'test',
    rotationDate: process.env.API_KEY_ROTATION_DATE
};
```

#### Request Authentication

**Bearer Token Implementation**:
```javascript
const makeAuthenticatedRequest = async (endpoint, options = {}) => {
    const headers = {
        'Authorization': `Bearer ${process.env.NAFFLES_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Naffles-Discord-Bot/1.0',
        ...options.headers
    };

    return fetch(`${process.env.NAFFLES_API_BASE_URL}${endpoint}`, {
        ...options,
        headers
    });
};
```

### Permission Management

#### Discord Permission Validation

**Permission Checking**:
```javascript
const validateUserPermissions = async (guildId, userId, requiredPermissions) => {
    try {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        
        const hasPermissions = requiredPermissions.every(permission => 
            member.permissions.has(permission)
        );
        
        return {
            hasPermission: hasPermissions,
            reason: hasPermissions ? null : 'Insufficient Discord permissions'
        };
    } catch (error) {
        return {
            hasPermission: false,
            reason: 'Unable to verify permissions'
        };
    }
};
```

#### Role-Based Access Control

**Custom Permission System**:
```javascript
const permissionLevels = {
    COMMUNITY_OWNER: 4,
    COMMUNITY_ADMIN: 3,
    COMMUNITY_MANAGER: 2,
    MODERATOR: 1,
    MEMBER: 0
};

const checkCommandPermission = async (userId, command, guildId) => {
    const userLevel = await getUserPermissionLevel(userId, guildId);
    const requiredLevel = commandPermissions[command] || 0;
    
    return userLevel >= requiredLevel;
};
```

## Data Protection

### Data Encryption

#### Data at Rest

**Database Encryption**:
```javascript
// MongoDB encryption configuration
const mongoConfig = {
    uri: process.env.MONGODB_URI,
    options: {
        ssl: true,
        sslValidate: true,
        sslCA: fs.readFileSync('./certs/mongodb-ca.crt'),
        authSource: 'admin'
    }
};

// Field-level encryption for sensitive data
const encryptSensitiveField = (data) => {
    const cipher = crypto.createCipher('aes-256-gcm', process.env.ENCRYPTION_KEY);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};
```

#### Data in Transit

**HTTPS/TLS Configuration**:
```javascript
// Enforce HTTPS for all API calls
const httpsAgent = new https.Agent({
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
});

// API client with TLS enforcement
const apiClient = axios.create({
    httpsAgent,
    timeout: 10000,
    headers: {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    }
});
```

### Data Minimization

#### Data Collection Principles

**Minimal Data Collection**:
```javascript
// Only collect necessary user data
const collectUserData = (discordUser) => {
    return {
        discordId: discordUser.id,
        username: discordUser.username,
        // Don't collect: email, phone, real name, etc.
        createdAt: new Date(),
        lastActive: new Date()
    };
};

// Automatic data cleanup
const cleanupExpiredData = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    await InteractionLog.deleteMany({
        createdAt: { $lt: thirtyDaysAgo }
    });
};
```

### Data Retention

**Retention Policies**:
```javascript
const retentionPolicies = {
    interactionLogs: 30, // days
    errorLogs: 90,
    auditLogs: 365,
    userSessions: 7,
    temporaryData: 1
};

// Automated cleanup scheduler
const scheduleDataCleanup = () => {
    cron.schedule('0 2 * * *', async () => { // Daily at 2 AM
        await cleanupExpiredData();
        await cleanupTemporaryFiles();
        await archiveOldLogs();
    });
};
```

## Network Security

### API Security

#### Request Validation

**Input Sanitization**:
```javascript
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
        .replace(/[<>]/g, '') // Remove HTML brackets
        .trim()
        .substring(0, 1000); // Limit length
};

// Validate Discord IDs
const validateDiscordId = (id) => {
    const discordIdPattern = /^\d{17,19}$/;
    return discordIdPattern.test(id);
};
```

#### Rate Limiting

**Multi-Level Rate Limiting**:
```javascript
const rateLimiters = {
    global: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 1000, // Global limit
        message: 'Too many requests from this IP'
    }),
    
    perUser: new Map(), // User-specific limits
    
    perCommand: {
        'create-task': rateLimit({
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: 5, // 5 task creations per 5 minutes
            keyGenerator: (req) => req.user.id
        })
    }
};
```

### Network Monitoring

**Connection Monitoring**:
```javascript
const monitorConnections = () => {
    // Monitor Discord WebSocket connection
    client.on('shardDisconnect', (event, id) => {
        logger.warn(`Shard ${id} disconnected`, { event });
        alertSecurityTeam('discord_disconnect', { shardId: id, event });
    });
    
    // Monitor API response times
    const monitorApiHealth = setInterval(async () => {
        const start = Date.now();
        try {
            await makeAuthenticatedRequest('/health');
            const responseTime = Date.now() - start;
            
            if (responseTime > 5000) {
                logger.warn('Slow API response', { responseTime });
            }
        } catch (error) {
            logger.error('API health check failed', error);
            alertSecurityTeam('api_health_failure', error);
        }
    }, 60000); // Every minute
};
```

## Input Validation

### Command Input Validation

**Comprehensive Input Validation**:
```javascript
const validateCommandInput = (command, options) => {
    const validators = {
        'create-task': {
            type: (value) => ['twitter_follow', 'discord_join', 'telegram_join', 'custom'].includes(value),
            title: (value) => typeof value === 'string' && value.length >= 1 && value.length <= 100,
            description: (value) => typeof value === 'string' && value.length >= 1 && value.length <= 500,
            points: (value) => Number.isInteger(value) && value >= 1 && value <= 10000,
            duration: (value) => !value || (Number.isInteger(value) && value >= 1 && value <= 8760)
        },
        'connect-allowlist': {
            allowlist_id: (value) => /^allow_[A-Za-z0-9]{16}$/.test(value)
        }
    };
    
    const commandValidators = validators[command];
    if (!commandValidators) return { valid: false, errors: ['Unknown command'] };
    
    const errors = [];
    for (const [field, validator] of Object.entries(commandValidators)) {
        if (!validator(options[field])) {
            errors.push(`Invalid ${field}`);
        }
    }
    
    return { valid: errors.length === 0, errors };
};
```

### Modal Input Validation

**Modal Data Sanitization**:
```javascript
const validateModalInput = (modalType, inputs) => {
    const validators = {
        twitter_follow: {
            twitter_username: (value) => {
                const twitterPattern = /^[A-Za-z0-9_]{1,15}$/;
                return twitterPattern.test(value) && !value.startsWith('_');
            }
        },
        discord_join: {
            discord_invite: (value) => {
                const discordInvitePattern = /^https:\/\/discord\.gg\/[A-Za-z0-9]+$/;
                return discordInvitePattern.test(value);
            }
        },
        telegram_join: {
            telegram_link: (value) => {
                const telegramPattern = /^https:\/\/t\.me\/[A-Za-z0-9_]+$/;
                return telegramPattern.test(value);
            }
        },
        custom: {
            custom_instructions: (value) => {
                return typeof value === 'string' && 
                       value.length >= 10 && 
                       value.length <= 1000 &&
                       !containsMaliciousContent(value);
            },
            verification_method: (value) => {
                return typeof value === 'string' && 
                       value.length >= 5 && 
                       value.length <= 500;
            }
        }
    };
    
    return validateInputs(inputs, validators[modalType] || {});
};
```

### Content Filtering

**Malicious Content Detection**:
```javascript
const containsMaliciousContent = (content) => {
    const maliciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
        /javascript:/gi, // JavaScript URLs
        /on\w+\s*=/gi, // Event handlers
        /data:text\/html/gi, // Data URLs
        /vbscript:/gi, // VBScript
        /@everyone|@here/gi // Discord mentions (in certain contexts)
    ];
    
    return maliciousPatterns.some(pattern => pattern.test(content));
};

const sanitizeContent = (content) => {
    return content
        .replace(/[<>]/g, '') // Remove HTML brackets
        .replace(/[@#]/g, '') // Remove Discord mentions
        .replace(/https?:\/\/[^\s]+/g, '[LINK]') // Replace URLs
        .trim();
};
```

## Rate Limiting and Abuse Prevention

### Multi-Tier Rate Limiting

**Comprehensive Rate Limiting System**:
```javascript
class RateLimitManager {
    constructor() {
        this.limits = new Map();
        this.violations = new Map();
    }
    
    async checkRateLimit(key, limit, window) {
        const now = Date.now();
        const windowStart = now - window;
        
        if (!this.limits.has(key)) {
            this.limits.set(key, []);
        }
        
        const requests = this.limits.get(key);
        
        // Remove old requests
        const validRequests = requests.filter(time => time > windowStart);
        this.limits.set(key, validRequests);
        
        if (validRequests.length >= limit) {
            await this.recordViolation(key);
            return false;
        }
        
        validRequests.push(now);
        return true;
    }
    
    async recordViolation(key) {
        const violations = this.violations.get(key) || 0;
        this.violations.set(key, violations + 1);
        
        if (violations > 5) {
            await this.alertSecurityTeam(key, violations);
        }
    }
}
```

### Abuse Detection

**Suspicious Activity Detection**:
```javascript
const detectSuspiciousActivity = async (userId, guildId, action) => {
    const suspiciousPatterns = [
        {
            name: 'rapid_commands',
            check: async () => {
                const recentCommands = await getRecentCommands(userId, 60000); // 1 minute
                return recentCommands.length > 20;
            }
        },
        {
            name: 'multiple_guilds',
            check: async () => {
                const recentGuilds = await getRecentGuilds(userId, 3600000); // 1 hour
                return recentGuilds.length > 10;
            }
        },
        {
            name: 'failed_authentications',
            check: async () => {
                const failedAuths = await getFailedAuthentications(userId, 3600000);
                return failedAuths.length > 5;
            }
        }
    ];
    
    const violations = [];
    for (const pattern of suspiciousPatterns) {
        if (await pattern.check()) {
            violations.push(pattern.name);
        }
    }
    
    if (violations.length > 0) {
        await logSecurityEvent('suspicious_activity', {
            userId,
            guildId,
            action,
            violations,
            timestamp: new Date()
        });
    }
    
    return violations;
};
```

### Automated Response

**Automated Security Responses**:
```javascript
const automatedSecurityResponse = async (violation) => {
    const responses = {
        rate_limit_exceeded: async (data) => {
            // Temporary cooldown
            await setCooldown(data.userId, 300000); // 5 minutes
        },
        
        suspicious_activity: async (data) => {
            // Increased monitoring
            await enableEnhancedMonitoring(data.userId, 3600000); // 1 hour
            
            if (data.violations.length > 2) {
                await temporaryRestriction(data.userId, 1800000); // 30 minutes
            }
        },
        
        malicious_content: async (data) => {
            // Immediate restriction
            await temporaryRestriction(data.userId, 3600000); // 1 hour
            await alertModerators(data.guildId, data);
        }
    };
    
    const response = responses[violation.type];
    if (response) {
        await response(violation.data);
    }
};
```

## Monitoring and Logging

### Security Event Logging

**Comprehensive Security Logging**:
```javascript
const logSecurityEvent = async (eventType, data) => {
    const securityEvent = {
        type: eventType,
        timestamp: new Date(),
        severity: getSeverityLevel(eventType),
        data: sanitizeLogData(data),
        source: 'discord-bot',
        version: process.env.BOT_VERSION
    };
    
    // Log to database
    await SecurityLog.create(securityEvent);
    
    // Log to file
    securityLogger.log(securityEvent.severity, 'Security event', securityEvent);
    
    // Alert if high severity
    if (securityEvent.severity === 'high' || securityEvent.severity === 'critical') {
        await alertSecurityTeam(eventType, data);
    }
};

const getSeverityLevel = (eventType) => {
    const severityMap = {
        'authentication_failure': 'medium',
        'permission_violation': 'medium',
        'rate_limit_exceeded': 'low',
        'suspicious_activity': 'high',
        'malicious_content': 'high',
        'data_breach_attempt': 'critical',
        'system_compromise': 'critical'
    };
    
    return severityMap[eventType] || 'low';
};
```

### Real-time Monitoring

**Security Monitoring Dashboard**:
```javascript
const securityMetrics = {
    async getSecurityStatus() {
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        return {
            authenticationFailures: await SecurityLog.countDocuments({
                type: 'authentication_failure',
                timestamp: { $gte: last24Hours }
            }),
            
            rateLimitViolations: await SecurityLog.countDocuments({
                type: 'rate_limit_exceeded',
                timestamp: { $gte: last24Hours }
            }),
            
            suspiciousActivities: await SecurityLog.countDocuments({
                type: 'suspicious_activity',
                timestamp: { $gte: last24Hours }
            }),
            
            activeThreats: await getActiveThreats(),
            systemHealth: await getSystemHealth()
        };
    },
    
    async generateSecurityReport(timeframe = '24h') {
        const startTime = getTimeframeStart(timeframe);
        
        const events = await SecurityLog.find({
            timestamp: { $gte: startTime }
        }).sort({ timestamp: -1 });
        
        return {
            summary: generateEventSummary(events),
            trends: analyzeSecurityTrends(events),
            recommendations: generateSecurityRecommendations(events),
            topThreats: identifyTopThreats(events)
        };
    }
};
```

### Alerting System

**Multi-Channel Alerting**:
```javascript
const alertSecurityTeam = async (eventType, data) => {
    const alert = {
        type: eventType,
        severity: getSeverityLevel(eventType),
        timestamp: new Date(),
        data: sanitizeAlertData(data),
        source: 'naffles-discord-bot'
    };
    
    // Email alerts for high/critical severity
    if (alert.severity === 'high' || alert.severity === 'critical') {
        await sendEmailAlert(alert);
    }
    
    // Discord webhook for immediate notifications
    await sendDiscordAlert(alert);
    
    // Slack integration for team notifications
    await sendSlackAlert(alert);
    
    // PagerDuty for critical incidents
    if (alert.severity === 'critical') {
        await triggerPagerDutyIncident(alert);
    }
};
```

## Incident Response

### Incident Classification

**Security Incident Types**:
```javascript
const incidentTypes = {
    LOW: {
        examples: ['Rate limiting triggered', 'Minor permission violations'],
        response: 'automated',
        escalation: false
    },
    
    MEDIUM: {
        examples: ['Authentication failures', 'Suspicious user behavior'],
        response: 'monitored',
        escalation: 'if_repeated'
    },
    
    HIGH: {
        examples: ['Malicious content detected', 'Abuse patterns identified'],
        response: 'immediate_action',
        escalation: true
    },
    
    CRITICAL: {
        examples: ['Data breach attempt', 'System compromise', 'Mass abuse'],
        response: 'emergency_protocol',
        escalation: 'immediate'
    }
};
```

### Response Procedures

**Automated Incident Response**:
```javascript
const incidentResponse = {
    async handleSecurityIncident(incident) {
        const responseLevel = this.classifyIncident(incident);
        
        switch (responseLevel) {
            case 'LOW':
                await this.logIncident(incident);
                break;
                
            case 'MEDIUM':
                await this.logIncident(incident);
                await this.enableMonitoring(incident);
                break;
                
            case 'HIGH':
                await this.logIncident(incident);
                await this.takeImmediateAction(incident);
                await this.alertSecurityTeam(incident);
                break;
                
            case 'CRITICAL':
                await this.logIncident(incident);
                await this.emergencyProtocol(incident);
                await this.alertAllStakeholders(incident);
                break;
        }
    },
    
    async emergencyProtocol(incident) {
        // Immediate containment
        await this.isolateAffectedSystems(incident);
        
        // Preserve evidence
        await this.preserveForensicData(incident);
        
        // Notify authorities if required
        if (this.requiresLegalNotification(incident)) {
            await this.notifyLegalTeam(incident);
        }
        
        // Begin recovery procedures
        await this.initiateRecoveryProcedures(incident);
    }
};
```

### Forensic Data Collection

**Evidence Preservation**:
```javascript
const preserveForensicData = async (incident) => {
    const forensicData = {
        incident_id: incident.id,
        timestamp: new Date(),
        system_state: await captureSystemState(),
        logs: await collectRelevantLogs(incident),
        network_data: await captureNetworkData(incident),
        user_data: await collectUserData(incident),
        integrity_hashes: await generateIntegrityHashes()
    };
    
    // Encrypt and store forensic data
    const encryptedData = await encryptForensicData(forensicData);
    await storeForensicEvidence(incident.id, encryptedData);
    
    // Generate chain of custody record
    await createChainOfCustody(incident.id, forensicData);
};
```

## Security Configuration

### Environment Security

**Secure Environment Configuration**:
```javascript
// .env.example with security annotations
const secureEnvironmentConfig = {
    // Discord Configuration (Required)
    DISCORD_BOT_TOKEN: 'your_bot_token_here', // Keep secret, rotate every 90 days
    DISCORD_CLIENT_ID: 'your_client_id_here', // Public, but don't expose unnecessarily
    DISCORD_CLIENT_SECRET: 'your_client_secret_here', // Keep secret
    
    // Naffles API Configuration (Required)
    NAFFLES_API_BASE_URL: 'https://api.naffles.com', // Use HTTPS only
    NAFFLES_API_KEY: 'your_api_key_here', // Keep secret, rotate regularly
    
    // Database Configuration (Required)
    MONGODB_URI: 'mongodb://localhost:27017/naffles-discord-bot', // Use authentication in production
    REDIS_URL: 'redis://localhost:6379', // Use authentication and TLS in production
    
    // Security Configuration (Optional but recommended)
    ENCRYPTION_KEY: 'your_encryption_key_here', // 32-byte key for AES-256
    JWT_SECRET: 'your_jwt_secret_here', // For session management
    RATE_LIMIT_REDIS_URL: 'redis://localhost:6379/1', // Separate Redis DB for rate limiting
    
    // Monitoring Configuration (Optional)
    MONITORING_PORT: '3001', // Internal monitoring port
    LOG_LEVEL: 'info', // debug, info, warn, error
    SENTRY_DSN: 'your_sentry_dsn_here', // Error tracking
    
    // Security Headers and CORS (Production)
    ALLOWED_ORIGINS: 'https://naffles.com,https://discord.com',
    SECURITY_HEADERS: 'true',
    FORCE_HTTPS: 'true'
};
```

### Production Security Checklist

**Pre-Deployment Security Checklist**:
```markdown
## Infrastructure Security
- [ ] All secrets stored in environment variables or secrets manager
- [ ] Database authentication enabled
- [ ] Redis authentication enabled
- [ ] TLS/SSL certificates configured
- [ ] Firewall rules configured (minimal required ports)
- [ ] Regular security updates scheduled

## Application Security
- [ ] Input validation implemented for all user inputs
- [ ] Rate limiting configured at multiple levels
- [ ] Error handling doesn't expose sensitive information
- [ ] Logging configured with appropriate levels
- [ ] Security headers configured
- [ ] CORS properly configured

## Monitoring and Alerting
- [ ] Security event logging implemented
- [ ] Real-time monitoring configured
- [ ] Alert thresholds configured
- [ ] Incident response procedures documented
- [ ] Backup and recovery procedures tested

## Access Control
- [ ] Principle of least privilege applied
- [ ] Regular access reviews scheduled
- [ ] Multi-factor authentication enabled where possible
- [ ] API key rotation schedule established
```

### Security Headers

**HTTP Security Headers**:
```javascript
const securityHeaders = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};

// Apply security headers to all responses
app.use((req, res, next) => {
    Object.entries(securityHeaders).forEach(([header, value]) => {
        res.setHeader(header, value);
    });
    next();
});
```

## Compliance and Privacy

### Data Privacy Compliance

**GDPR Compliance Measures**:
```javascript
const privacyCompliance = {
    // Data subject rights implementation
    async handleDataRequest(userId, requestType) {
        switch (requestType) {
            case 'access':
                return await this.exportUserData(userId);
            case 'rectification':
                return await this.updateUserData(userId);
            case 'erasure':
                return await this.deleteUserData(userId);
            case 'portability':
                return await this.exportPortableData(userId);
            case 'restriction':
                return await this.restrictProcessing(userId);
        }
    },
    
    // Data retention compliance
    async enforceRetentionPolicies() {
        const policies = {
            interactionLogs: 30 * 24 * 60 * 60 * 1000, // 30 days
            errorLogs: 90 * 24 * 60 * 60 * 1000, // 90 days
            auditLogs: 365 * 24 * 60 * 60 * 1000, // 1 year
            userSessions: 7 * 24 * 60 * 60 * 1000 // 7 days
        };
        
        for (const [dataType, retention] of Object.entries(policies)) {
            await this.cleanupExpiredData(dataType, retention);
        }
    },
    
    // Consent management
    async recordConsent(userId, consentType, granted) {
        await ConsentRecord.create({
            userId,
            consentType,
            granted,
            timestamp: new Date(),
            ipAddress: await this.getHashedIP(userId),
            userAgent: await this.getHashedUserAgent(userId)
        });
    }
};
```

### Audit and Compliance Reporting

**Compliance Reporting**:
```javascript
const complianceReporting = {
    async generateComplianceReport(timeframe) {
        return {
            dataProcessingActivities: await this.getDataProcessingReport(timeframe),
            securityIncidents: await this.getSecurityIncidentReport(timeframe),
            dataSubjectRequests: await this.getDataSubjectRequestReport(timeframe),
            retentionCompliance: await this.getRetentionComplianceReport(timeframe),
            accessControls: await this.getAccessControlReport(timeframe),
            thirdPartyIntegrations: await this.getThirdPartyIntegrationReport(timeframe)
        };
    },
    
    async auditSecurityControls() {
        const controls = [
            'encryption_at_rest',
            'encryption_in_transit',
            'access_controls',
            'authentication_mechanisms',
            'authorization_controls',
            'input_validation',
            'output_encoding',
            'session_management',
            'error_handling',
            'logging_monitoring'
        ];
        
        const auditResults = {};
        for (const control of controls) {
            auditResults[control] = await this.auditControl(control);
        }
        
        return auditResults;
    }
};
```

---

**Security is an ongoing process.** Regularly review and update your security measures, stay informed about new threats, and maintain a security-first mindset in all development and operational activities.

For security-related questions or to report security vulnerabilities, contact [security@naffles.com](mailto:security@naffles.com).