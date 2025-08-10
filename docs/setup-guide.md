# Naffles Discord Bot Setup Guide

This comprehensive guide will walk you through setting up the Naffles Discord bot for your community, from initial installation to advanced configuration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Discord Application Setup](#discord-application-setup)
3. [Bot Installation](#bot-installation)
4. [Environment Configuration](#environment-configuration)
5. [Community Linking](#community-linking)
6. [Permission Configuration](#permission-configuration)
7. [Testing Your Setup](#testing-your-setup)
8. [Advanced Configuration](#advanced-configuration)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

Before setting up the Naffles Discord bot, ensure you have:

### Required Accounts and Access
- **Naffles Community**: You must own a Naffles community (create at [naffles.com](https://naffles.com))
- **Discord Server**: Administrator access to the Discord server you want to integrate
- **Technical Requirements**: Basic understanding of Discord permissions and server management

### System Requirements
- Node.js 18 or higher
- MongoDB database (for production deployments)
- Redis server (for caching and session management)
- Stable internet connection

### Permissions Required
- **Discord**: "Manage Server" permission in your Discord server
- **Naffles**: Owner or administrator access to your Naffles community

## Discord Application Setup

### Step 1: Create Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Enter a name for your application (e.g., "Naffles Bot - [Your Community]")
4. Click "Create"

### Step 2: Configure Bot Settings

1. Navigate to the "Bot" section in the left sidebar
2. Click "Add Bot" if not already created
3. Configure bot settings:
   - **Username**: Choose a recognizable name (e.g., "Naffles-YourCommunity")
   - **Avatar**: Upload your community logo or Naffles branding
   - **Public Bot**: Disable this option (keep it private to your community)
   - **Requires OAuth2 Code Grant**: Keep disabled
   - **Bot Permissions**: We'll configure these in the next step

### Step 3: Set Bot Permissions

In the "Bot" section, scroll down to "Bot Permissions" and enable:

#### Required Permissions
- ✅ **Send Messages** - Post tasks and allowlists
- ✅ **Use Slash Commands** - Enable slash command functionality
- ✅ **Embed Links** - Display rich embeds for tasks and allowlists
- ✅ **Read Message History** - Access channel history for context
- ✅ **Add Reactions** - Add reaction buttons to posts
- ✅ **Manage Messages** - Update and edit bot messages

#### Optional Permissions (Recommended)
- ✅ **Mention Everyone** - For important announcements (use sparingly)
- ✅ **Use External Emojis** - Enhanced visual experience
- ✅ **Attach Files** - For analytics exports and reports

### Step 4: Generate Bot Token

1. In the "Bot" section, click "Reset Token"
2. Copy the generated token immediately
3. **⚠️ IMPORTANT**: Store this token securely - it won't be shown again
4. Never share this token publicly or commit it to version control

### Step 5: Configure OAuth2 Settings

1. Navigate to "OAuth2" → "General"
2. Add redirect URIs for account linking:
   - `https://naffles.com/discord/callback`
   - `https://your-domain.com/discord/callback` (if using custom domain)
3. Note your Client ID and Client Secret for later configuration

## Bot Installation

### Option 1: Using Hosted Service (Recommended)

If Naffles provides a hosted bot service:

1. Visit the [Naffles Discord Integration](https://naffles.com/discord-setup) page
2. Select your community from the dropdown
3. Click "Add to Discord"
4. Choose your Discord server
5. Review and accept the requested permissions
6. Complete the authorization process

### Option 2: Self-Hosting

For advanced users who want to host their own bot instance:

#### Clone and Install

```bash
# Clone the repository
git clone https://github.com/naffles/discord-bot.git
cd naffles-discord-bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

#### Configure Environment Variables

Edit the `.env` file with your specific values:

```env
# Discord Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here

# Naffles API Configuration
NAFFLES_API_BASE_URL=https://api.naffles.com
NAFFLES_API_KEY=your_api_key_here

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/naffles-discord-bot
REDIS_URL=redis://localhost:6379

# Optional Configuration
NODE_ENV=production
LOG_LEVEL=info
MONITORING_PORT=3001
```

#### Start the Bot

```bash
# For development
npm run dev

# For production
npm start

# Using PM2 (recommended for production)
npm install -g pm2
pm2 start ecosystem.config.js
```

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | Bot token from Discord Developer Portal | `MTIzNDU2Nzg5MDEyMzQ1Njc4OTA...` |
| `DISCORD_CLIENT_ID` | Application ID from Discord Developer Portal | `123456789012345678` |
| `NAFFLES_API_BASE_URL` | Base URL for Naffles API | `https://api.naffles.com` |
| `NAFFLES_API_KEY` | API key for Naffles backend | `naf_live_1234567890abcdef...` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/naffles-bot` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |

### Optional Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Environment mode | `development` | `production` |
| `LOG_LEVEL` | Logging verbosity | `info` | `debug` |
| `MONITORING_PORT` | Health monitoring port | `3001` | `8080` |
| `RATE_LIMIT_WINDOW` | Rate limiting window (ms) | `60000` | `30000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` | `50` |
| `CACHE_TTL` | Cache time-to-live (seconds) | `300` | `600` |

### Security Configuration

#### API Key Management

1. **Generate API Key**: In your Naffles community dashboard:
   - Go to Settings → API Keys
   - Click "Generate New Key"
   - Select "Discord Bot" scope
   - Copy the generated key

2. **Secure Storage**: 
   - Use environment variables, never hardcode
   - Use secrets management in production
   - Rotate keys regularly

#### Database Security

```env
# Use authentication in production
MONGODB_URI=mongodb://username:password@host:port/database?authSource=admin

# Enable SSL/TLS
MONGODB_URI=mongodb://host:port/database?ssl=true&sslValidate=true

# Use connection pooling
MONGODB_URI=mongodb://host:port/database?maxPoolSize=10&minPoolSize=2
```

## Community Linking

### Step 1: Find Your Community ID

1. Log in to your Naffles community dashboard
2. Navigate to **Settings** → **General**
3. Copy your **Community ID** (format: `comm_1234567890abcdef`)

### Step 2: Link Discord Server

1. In your Discord server, run the command:
   ```
   /naffles-link-community community_id:comm_1234567890abcdef
   ```

2. The bot will respond with one of the following:
   - **Success**: "✅ Server successfully linked to [Community Name]"
   - **OAuth Required**: Follow the provided link to complete authentication
   - **Error**: Check the error message and troubleshooting section

### Step 3: Complete OAuth Authentication (if required)

If OAuth authentication is required:

1. Click the provided authentication link
2. Log in to your Naffles account
3. Authorize the Discord integration
4. Return to Discord and verify the connection

### Step 4: Verify Connection

Run the status command to verify everything is working:
```
/naffles-status
```

Expected response:
```
✅ Bot Status: Online
✅ Community: [Your Community Name]
✅ API Connection: Healthy
✅ Database: Connected
✅ Permissions: Configured
```

## Permission Configuration

### Default Permission Structure

By default, the bot uses these permission levels:

| Command | Required Permission | Customizable |
|---------|-------------------|--------------|
| `/naffles-link-community` | Manage Server | ❌ No |
| `/naffles-create-task` | Manage Server | ✅ Yes |
| `/naffles-connect-allowlist` | Manage Server | ✅ Yes |
| `/naffles-list-tasks` | Everyone | ✅ Yes |
| `/naffles-status` | Everyone | ✅ Yes |
| `/naffles-help` | Everyone | ✅ Yes |

### Customizing Permissions

#### Method 1: Discord Server Settings

1. Go to **Server Settings** → **Integrations**
2. Find your Naffles bot
3. Click **Manage**
4. Configure command permissions per role/channel

#### Method 2: Bot Configuration (if self-hosting)

Edit the permission configuration in your bot settings:

```javascript
// config/permissions.js
module.exports = {
  commands: {
    'naffles-create-task': {
      requiredRoles: ['Community Manager', 'Moderator'],
      requiredPermissions: ['ManageMessages'],
      allowedChannels: ['#community-tasks', '#announcements']
    },
    'naffles-connect-allowlist': {
      requiredRoles: ['Admin', 'Community Manager'],
      requiredPermissions: ['ManageServer'],
      allowedChannels: ['#allowlists', '#announcements']
    }
  }
};
```

### Role-Based Access Control

#### Recommended Role Structure

1. **Community Owner**
   - All bot commands
   - Community linking
   - Permission management

2. **Community Managers**
   - Create tasks
   - Connect allowlists
   - View analytics

3. **Moderators**
   - Create basic tasks
   - View task lists
   - Help users

4. **Members**
   - View tasks
   - Enter allowlists
   - Get help

#### Setting Up Roles

1. Create Discord roles with appropriate names
2. Assign permissions to roles in Discord
3. Configure bot to recognize these roles
4. Test permissions with different user accounts

## Testing Your Setup

### Basic Functionality Tests

#### 1. Bot Connectivity Test
```
/naffles-status
```
**Expected**: Green status indicators for all services

#### 2. Community Linking Test
```
/naffles-link-community community_id:your_community_id
```
**Expected**: Successful linking confirmation

#### 3. Task Creation Test
```
/naffles-create-task type:twitter_follow title:"Test Task" description:"Testing bot functionality" points:100
```
**Expected**: Task creation modal appears and completes successfully

#### 4. Task Listing Test
```
/naffles-list-tasks status:active
```
**Expected**: List of active tasks with interactive elements

#### 5. Help System Test
```
/naffles-help
```
**Expected**: Comprehensive help embed with interactive buttons

### Advanced Testing

#### Permission Testing

1. **Admin User Test**: Verify all commands work
2. **Regular User Test**: Verify appropriate command restrictions
3. **Guest User Test**: Verify read-only access works

#### Integration Testing

1. **Task Completion Flow**: Create task → User completes → Points awarded
2. **Allowlist Flow**: Connect allowlist → User enters → Entry recorded
3. **Analytics Flow**: Create content → View analytics → Data accuracy

#### Error Handling Testing

1. **Invalid Community ID**: Test error messages
2. **Network Issues**: Test graceful degradation
3. **Permission Denied**: Test appropriate error responses

### Performance Testing

#### Load Testing

1. **Concurrent Commands**: Multiple users running commands simultaneously
2. **Large Task Lists**: Communities with 50+ active tasks
3. **High-Frequency Updates**: Real-time task completion updates

#### Monitoring

Set up monitoring for:
- Response times
- Error rates
- Memory usage
- Database performance
- API call success rates

## Advanced Configuration

### Custom Embed Styling

Customize the appearance of bot messages:

```javascript
// config/embeds.js
module.exports = {
  colors: {
    primary: 0x7C3AED,    // Purple
    success: 0x10B981,    // Green
    error: 0xEF4444,      // Red
    warning: 0xF59E0B,    // Orange
    info: 0x3B82F6        // Blue
  },
  branding: {
    logoUrl: 'https://your-community.com/logo.png',
    footerText: 'Powered by Your Community',
    thumbnailUrl: 'https://your-community.com/thumbnail.png'
  }
};
```

### Analytics Configuration

Enable detailed analytics tracking:

```javascript
// config/analytics.js
module.exports = {
  enabled: true,
  trackingEvents: [
    'task_created',
    'task_completed',
    'allowlist_connected',
    'allowlist_entered',
    'user_joined',
    'command_executed'
  ],
  retentionPeriod: '90d',
  exportFormats: ['csv', 'json'],
  dashboardAccess: ['admin', 'community_manager']
};
```

### Notification Settings

Configure notification preferences:

```javascript
// config/notifications.js
module.exports = {
  channels: {
    taskUpdates: '#task-updates',
    allowlistUpdates: '#allowlist-updates',
    systemAlerts: '#bot-alerts',
    analytics: '#analytics'
  },
  frequency: {
    taskCompletions: 'immediate',
    allowlistEntries: 'immediate',
    analyticsReports: 'daily',
    systemHealth: 'hourly'
  }
};
```

### Rate Limiting Configuration

Adjust rate limiting for your community size:

```javascript
// config/rateLimiting.js
module.exports = {
  global: {
    windowMs: 60000,      // 1 minute
    maxRequests: 100      // 100 requests per minute
  },
  perUser: {
    windowMs: 60000,      // 1 minute
    maxRequests: 10       // 10 requests per user per minute
  },
  perCommand: {
    'create-task': {
      windowMs: 300000,   // 5 minutes
      maxRequests: 5      // 5 task creations per 5 minutes
    },
    'connect-allowlist': {
      windowMs: 600000,   // 10 minutes
      maxRequests: 3      // 3 allowlist connections per 10 minutes
    }
  }
};
```

## Troubleshooting

### Common Issues and Solutions

#### Bot Not Responding

**Symptoms**: Commands don't trigger any response

**Possible Causes**:
- Bot is offline
- Missing permissions
- Invalid token
- Network connectivity issues

**Solutions**:
1. Check bot status in Discord (should show as online)
2. Verify bot permissions in server settings
3. Check bot token validity in Discord Developer Portal
4. Test network connectivity to Discord API
5. Review bot logs for error messages

#### Community Linking Fails

**Symptoms**: "Community not found" or "Permission denied" errors

**Possible Causes**:
- Incorrect Community ID
- User doesn't own the community
- Community already linked to another server
- API connectivity issues

**Solutions**:
1. Double-check Community ID from Naffles dashboard
2. Verify you're the community owner
3. Check if community is already linked elsewhere
4. Test API connectivity with `/naffles-status`
5. Contact Naffles support if issues persist

#### Task Creation Fails

**Symptoms**: Modal doesn't appear or task creation errors

**Possible Causes**:
- Insufficient permissions
- Server not linked to community
- Invalid task parameters
- API rate limiting

**Solutions**:
1. Verify "Manage Server" permission
2. Confirm server is linked with `/naffles-status`
3. Check task parameters (points, duration, etc.)
4. Wait and retry if rate limited
5. Review task creation logs

#### Allowlist Connection Issues

**Symptoms**: "Allowlist not found" or connection failures

**Possible Causes**:
- Invalid Allowlist ID
- Allowlist already connected
- Permission issues
- Allowlist not active

**Solutions**:
1. Verify Allowlist ID from Naffles dashboard
2. Check if allowlist is already connected
3. Ensure allowlist is active and not expired
4. Verify user permissions
5. Test with a different allowlist

### Diagnostic Commands

#### Health Check
```
/naffles-status
```
Provides comprehensive system status including:
- Bot connectivity
- Community linking status
- API health
- Database connectivity
- Permission configuration

#### Debug Information

For self-hosted instances, enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

This provides detailed information about:
- Command execution
- API calls
- Database queries
- Error stack traces
- Performance metrics

### Log Analysis

#### Important Log Patterns

**Successful Operations**:
```
[INFO] Command executed successfully: create-task by user123 in guild456
[INFO] Task created: task789 for community comm_abc123
[INFO] API call successful: POST /api/communities/comm_abc123/tasks
```

**Error Patterns**:
```
[ERROR] Command failed: create-task - Permission denied for user123
[ERROR] API call failed: 404 Community not found
[ERROR] Database connection lost, attempting reconnection
```

**Performance Issues**:
```
[WARN] Slow API response: 5.2s for GET /api/communities/comm_abc123/tasks
[WARN] High memory usage: 512MB (threshold: 256MB)
[WARN] Rate limit approaching: 95/100 requests in window
```

### Getting Additional Help

#### Documentation Resources
- [Naffles Discord Bot API Documentation](https://docs.naffles.com/discord-bot)
- [Discord.js Documentation](https://discord.js.org/#/docs)
- [Discord Developer Documentation](https://discord.com/developers/docs)

#### Support Channels
- **Naffles Support**: [support@naffles.com](mailto:support@naffles.com)
- **Community Discord**: [discord.gg/naffles](https://discord.gg/naffles)
- **GitHub Issues**: [github.com/naffles/discord-bot/issues](https://github.com/naffles/discord-bot/issues)

#### Before Contacting Support

Please gather the following information:
1. Bot version and deployment method
2. Discord server ID and community ID
3. Specific error messages or screenshots
4. Steps to reproduce the issue
5. Recent changes to server or community settings

---

**Need more help?** Join our [Discord community](https://discord.gg/naffles) or contact [support@naffles.com](mailto:support@naffles.com)