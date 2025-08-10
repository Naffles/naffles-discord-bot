# Discord Bot Database Schema Documentation

## Overview

The Naffles Discord Bot uses a comprehensive MongoDB database schema designed for scalability, performance, and data integrity. The schema includes enhanced models with proper indexing, audit trails, analytics tracking, and automated cleanup procedures.

## Database Models

### 1. DiscordServerMapping

Manages the relationship between Discord servers and Naffles communities.

**Key Features:**
- One-to-one mapping between Discord guilds and Naffles communities
- Comprehensive guild information tracking
- Bot configuration per server
- Activity statistics and health monitoring
- Audit trail for all changes

**Schema Highlights:**
```javascript
{
  guildId: String (unique, indexed),
  communityId: String (indexed),
  linkedBy: String (indexed),
  guildInfo: {
    name: String,
    memberCount: Number,
    ownerId: String,
    // ... additional guild metadata
  },
  botConfig: {
    defaultChannel: String,
    allowedRoles: [RoleConfig],
    autoPostTasks: Boolean,
    // ... configuration options
  },
  activityStats: {
    totalTasksCreated: Number,
    totalAllowlistsConnected: Number,
    lastActivity: Date,
    // ... activity metrics
  },
  integrationStatus: {
    isHealthy: Boolean,
    apiConnectionStatus: String,
    lastHealthCheck: Date
  },
  auditLog: [AuditEntry]
}
```

### 2. DiscordAccountLink

Manages secure linking between Discord accounts and Naffles user accounts.

**Key Features:**
- Encrypted OAuth token storage
- Comprehensive user information tracking
- Activity statistics and engagement metrics
- Security monitoring and audit trails
- Automatic token refresh management

**Schema Highlights:**
```javascript
{
  discordId: String (unique, indexed),
  nafflesUserId: String (indexed),
  discordUserInfo: {
    username: String,
    discriminator: String,
    avatar: String,
    // ... Discord user data
  },
  nafflesUserInfo: {
    username: String,
    walletAddress: String,
    tier: String,
    // ... Naffles user data
  },
  oauthTokens: {
    accessToken: String (encrypted),
    refreshToken: String (encrypted),
    expiresAt: Date
  },
  activityStats: {
    totalTasksCompleted: Number,
    totalPointsEarned: Number,
    lastActivity: Date,
    // ... engagement metrics
  },
  securityData: {
    loginAttempts: Number,
    suspiciousActivityFlags: [SecurityFlag],
    // ... security monitoring
  }
}
```

### 3. DiscordTaskPost

Tracks social tasks posted to Discord channels with comprehensive analytics.

**Key Features:**
- Complete task lifecycle management
- Detailed interaction analytics
- User engagement tracking
- Performance metrics and optimization
- Automated expiration handling

**Schema Highlights:**
```javascript
{
  taskId: String (indexed),
  guildId: String (indexed),
  messageId: String (unique, indexed),
  taskData: {
    title: String,
    description: String,
    type: String,
    points: Number,
    status: String (indexed)
  },
  interactionStats: {
    views: Number,
    completions: Number,
    conversionRate: Number,
    averageCompletionTime: Number
  },
  engagement: {
    participantIds: [String],
    reactions: [ReactionData],
    comments: [CommentData]
  },
  analytics: {
    engagementScore: Number,
    performanceMetrics: Object
  }
}
```

### 4. DiscordAllowlistConnection

Manages allowlist campaigns posted to Discord with entry tracking.

**Key Features:**
- Comprehensive allowlist management
- Entry queue with duplicate prevention
- Winner selection and notification
- Advanced analytics and reporting
- Fraud detection and prevention

**Schema Highlights:**
```javascript
{
  allowlistId: String (indexed),
  guildId: String (indexed),
  messageId: String (unique, indexed),
  allowlistData: {
    title: String,
    prize: String,
    winnerCount: Number,
    entryPrice: Object,
    status: String (indexed)
  },
  entryManagement: {
    entryQueue: [EntryData],
    duplicateAttempts: [AttemptData],
    fraudulentAttempts: [FraudData]
  },
  winnerData: {
    isDrawn: Boolean,
    winners: [WinnerData],
    drawMethod: String,
    vrfRequestId: String
  },
  analytics: {
    competitiveness: Number,
    popularityTrend: [TrendData]
  }
}
```

### 5. DiscordInteractionLog

Comprehensive logging of all Discord bot interactions for analytics and debugging.

**Key Features:**
- Detailed interaction tracking
- Performance monitoring
- Security event logging
- Business metrics collection
- Automated cleanup with TTL indexes

**Schema Highlights:**
```javascript
{
  interactionId: String (unique, indexed),
  guildId: String (indexed),
  userId: String (indexed),
  interaction: {
    type: String (indexed),
    commandName: String (indexed),
    customId: String
  },
  timing: {
    timestamp: Date (indexed, TTL),
    responseTime: Number,
    processingTime: Number
  },
  performance: {
    memoryUsage: Object,
    cpuUsage: Object,
    networkLatency: Number
  },
  security: {
    riskScore: Number,
    suspiciousActivity: Boolean,
    rateLimited: Boolean
  },
  businessData: {
    pointsAwarded: Number,
    taskCompleted: Boolean,
    conversionEvent: Boolean
  }
}
```

## Database Indexes

### Performance Indexes
- **Compound indexes** for common query patterns
- **Single field indexes** for frequently filtered fields
- **Text indexes** for search functionality
- **Geospatial indexes** for location-based queries (if needed)

### TTL Indexes
- **Interaction logs**: Auto-delete after 90 days
- **Expired tokens**: Auto-delete immediately after expiration
- **Expired tasks**: Auto-delete 90 days after expiration
- **Expired allowlists**: Auto-delete 180 days after expiration

### Unique Indexes
- `guildId` in DiscordServerMapping
- `discordId` in DiscordAccountLink
- `messageId` in DiscordTaskPost and DiscordAllowlistConnection
- `interactionId` in DiscordInteractionLog

## Data Management Services

### Enhanced Database Service

Provides advanced database operations with:
- Connection management and health monitoring
- Performance optimization
- Data integrity validation
- Analytics and reporting
- Migration support

### Data Cleanup Service

Automated maintenance with:
- Scheduled cleanup operations
- Expired data removal
- Orphaned record cleanup
- Index optimization
- Performance monitoring

### Migration Runner

Database schema evolution with:
- Version-controlled migrations
- Rollback capabilities
- Migration validation
- Automated execution
- Status tracking

## CLI Management Tool

The `discord-db-manager` CLI provides comprehensive database management:

```bash
# Migration management
npm run db:migrate              # Run pending migrations
npm run db:status              # Show migration status
npm run db:rollback            # Rollback last migration

# Data maintenance
npm run db:cleanup             # Run manual cleanup
npm run db:health              # Check database health
npm run db:analytics           # Show platform analytics
npm run db:summary             # Show data summary

# Advanced operations
discord-db-manager migration:create "migration-name"
discord-db-manager cleanup --logs --tokens --expired
discord-db-manager indexes:rebuild
```

## Environment Configuration

Required environment variables:

```env
# Database connection
MONGODB_URI=mongodb://localhost:27017/naffles-discord-bot

# Enhanced features
USE_ENHANCED_DATABASE=true
DISCORD_TOKEN_ENCRYPTION_KEY=your-encryption-key-here

# Performance tuning
DB_POOL_SIZE=20
DB_TIMEOUT_MS=45000
CLEANUP_INTERVAL_MINUTES=60
```

## Performance Considerations

### Query Optimization
- Use compound indexes for multi-field queries
- Implement proper pagination for large result sets
- Use aggregation pipelines for complex analytics
- Cache frequently accessed data in Redis

### Memory Management
- Monitor connection pool usage
- Implement proper cleanup procedures
- Use streaming for large data operations
- Regular index maintenance

### Scaling Strategies
- Implement read replicas for analytics queries
- Use sharding for high-volume collections
- Implement data archiving for historical data
- Monitor and optimize slow queries

## Security Features

### Data Protection
- Encrypted storage of sensitive data (OAuth tokens)
- Audit trails for all data modifications
- Access control and permission management
- Secure data transmission

### Monitoring and Alerting
- Real-time security event logging
- Suspicious activity detection
- Rate limiting and abuse prevention
- Comprehensive audit trails

## Backup and Recovery

### Backup Strategy
- Daily automated backups
- Point-in-time recovery capability
- Cross-region backup replication
- Regular backup validation

### Recovery Procedures
- Documented recovery processes
- Tested disaster recovery plans
- Data integrity verification
- Minimal downtime procedures

## Monitoring and Analytics

### Health Monitoring
- Connection status tracking
- Performance metrics collection
- Error rate monitoring
- Resource usage tracking

### Business Analytics
- User engagement metrics
- Task completion rates
- Allowlist performance data
- Platform usage statistics

## Testing

Comprehensive test suite includes:
- Unit tests for all models
- Integration tests for services
- Performance tests for queries
- Migration tests for schema changes

Run tests with:
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

## Troubleshooting

### Common Issues
1. **Connection timeouts**: Check network connectivity and MongoDB status
2. **Index errors**: Rebuild indexes using CLI tool
3. **Migration failures**: Check migration logs and rollback if needed
4. **Performance issues**: Analyze slow query logs and optimize indexes

### Debug Tools
- Database health check: `npm run db:health`
- Performance analytics: `npm run db:analytics`
- Data summary: `npm run db:summary`
- Migration status: `npm run db:status`

## Future Enhancements

### Planned Features
- Real-time data synchronization
- Advanced analytics dashboards
- Machine learning integration
- Multi-region deployment support
- Enhanced security features

### Scalability Improvements
- Horizontal scaling support
- Advanced caching strategies
- Query optimization tools
- Automated performance tuning