# Discord Bot Troubleshooting Guide

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with the Naffles Discord bot.

## Table of Contents

1. [Quick Diagnostic Steps](#quick-diagnostic-steps)
2. [Bot Connection Issues](#bot-connection-issues)
3. [Community Linking Problems](#community-linking-problems)
4. [Command Execution Failures](#command-execution-failures)
5. [Task Creation Issues](#task-creation-issues)
6. [Allowlist Connection Problems](#allowlist-connection-problems)
7. [Permission and Access Issues](#permission-and-access-issues)
8. [Performance and Response Issues](#performance-and-response-issues)
9. [Integration and API Problems](#integration-and-api-problems)
10. [Advanced Troubleshooting](#advanced-troubleshooting)
11. [Getting Additional Help](#getting-additional-help)

## Quick Diagnostic Steps

Before diving into specific issues, run these quick diagnostic steps:

### 1. Check Bot Status
```
/naffles-status
```
This command provides comprehensive system health information and often identifies the root cause of issues.

### 2. Verify Basic Connectivity
- Is the bot showing as online in Discord?
- Can you see the bot in the server member list?
- Do slash commands appear when you type `/naffles-`?

### 3. Check Recent Changes
- Have there been recent changes to server permissions?
- Has the community configuration changed on Naffles?
- Were there recent Discord server updates or role changes?

### 4. Review Error Messages
- Take screenshots of any error messages
- Note the exact command that failed
- Record the time when the issue occurred

## Bot Connection Issues

### Bot Appears Offline

**Symptoms**:
- Bot shows as offline in Discord
- No response to any commands
- Bot doesn't appear in member list

**Possible Causes**:
- Bot service is down
- Network connectivity issues
- Invalid bot token
- Discord API issues

**Solutions**:

#### Step 1: Verify Bot Status
1. Check if other Discord bots in your server are working
2. Visit [Discord Status](https://discordstatus.com) for API issues
3. Try the bot in a different server (if available)

#### Step 2: Check Bot Configuration
1. Verify bot token hasn't expired
2. Confirm bot has proper permissions
3. Check if bot was accidentally removed from server

#### Step 3: Contact Support
If the bot appears offline across multiple servers:
```
This indicates a service-level issue. Contact support with:
• Time when bot went offline
• Affected servers
• Any error messages received
```

### Bot Online But Not Responding

**Symptoms**:
- Bot shows as online
- Slash commands don't appear or don't work
- No response to interactions

**Possible Causes**:
- Missing application command permissions
- Bot lacks required Discord permissions
- Rate limiting or API issues
- Database connectivity problems

**Solutions**:

#### Step 1: Check Slash Command Permissions
1. Go to **Server Settings** → **Integrations**
2. Find your Naffles bot
3. Ensure "Use Slash Commands" is enabled
4. Check command-specific permissions

#### Step 2: Verify Bot Permissions
Required permissions:
- ✅ Send Messages
- ✅ Use Slash Commands
- ✅ Embed Links
- ✅ Read Message History
- ✅ Add Reactions

#### Step 3: Test in Different Channel
Try commands in a different channel to isolate permission issues:
```
/naffles-help
```

#### Step 4: Check Rate Limiting
If you've been running many commands quickly:
```
Wait 5-10 minutes and try again
Rate limiting is temporary and will resolve automatically
```

### Slash Commands Not Appearing

**Symptoms**:
- Typing `/naffles-` doesn't show command suggestions
- Commands exist but aren't visible to users
- Some commands appear but others don't

**Possible Causes**:
- Commands not registered properly
- Permission restrictions
- Discord client cache issues
- Bot integration not configured

**Solutions**:

#### Step 1: Refresh Discord Client
1. **Desktop**: Ctrl+R (Windows/Linux) or Cmd+R (Mac)
2. **Web**: Refresh browser page
3. **Mobile**: Force close and reopen app

#### Step 2: Check Integration Settings
1. **Server Settings** → **Integrations**
2. Find Naffles bot
3. Click **Manage**
4. Verify command permissions

#### Step 3: Re-invite Bot (if self-hosting)
If you're self-hosting, the bot may need to be re-invited with updated permissions:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=YOUR_PERMISSIONS&scope=bot%20applications.commands
```

## Community Linking Problems

### "Community Not Found" Error

**Symptoms**:
```
❌ Community not found
Please check your Community ID and try again
```

**Possible Causes**:
- Incorrect Community ID
- Community doesn't exist
- Community is inactive or deleted
- Typo in Community ID

**Solutions**:

#### Step 1: Verify Community ID
1. Log in to [Naffles Dashboard](https://naffles.com/dashboard)
2. Navigate to **Settings** → **General**
3. Copy the exact Community ID (format: `comm_1234567890abcdef`)
4. Ensure no extra spaces or characters

#### Step 2: Check Community Status
1. Verify community is active in dashboard
2. Confirm you have access to the community
3. Check if community was recently created (may need time to propagate)

#### Step 3: Test with Different Community
If you have access to multiple communities, test with a different one to isolate the issue.

### "Permission Denied" Error

**Symptoms**:
```
❌ Permission denied
You don't have permission to link this community
```

**Possible Causes**:
- You're not the community owner
- Insufficient Naffles account permissions
- Account linking issues
- Community ownership transferred

**Solutions**:

#### Step 1: Verify Community Ownership
1. Check community dashboard for your role
2. Confirm you're listed as owner or administrator
3. Verify account is properly authenticated

#### Step 2: Complete Account Linking
1. Visit [Naffles Discord Integration](https://naffles.com/discord-setup)
2. Complete OAuth authentication
3. Verify Discord account is linked to correct Naffles account

#### Step 3: Check Recent Changes
- Has community ownership changed recently?
- Were there recent permission updates?
- Is your Naffles account in good standing?

### "Already Linked" Error

**Symptoms**:
```
❌ Community already linked
This community is already linked to another Discord server
```

**Possible Causes**:
- Community is linked to different server
- Previous linking wasn't properly removed
- Multiple linking attempts

**Solutions**:

#### Step 1: Check Current Linking
1. In Naffles dashboard, go to **Settings** → **Discord Integration**
2. View currently linked Discord server
3. Verify if linking is correct or needs to be changed

#### Step 2: Unlink Previous Connection
If community is linked to wrong server:
1. In Naffles dashboard, click **Unlink Discord Server**
2. Confirm unlinking
3. Wait 5 minutes for changes to propagate
4. Try linking to correct server

#### Step 3: Contact Support
If you can't access the previously linked server:
```
Contact support with:
• Community ID
• Current Discord server ID
• Previous Discord server ID (if known)
• Reason for relinking
```

## Command Execution Failures

### Commands Return "Unknown Interaction"

**Symptoms**:
```
This interaction failed
Unknown interaction
```

**Possible Causes**:
- Command took too long to process
- Bot restarted during command execution
- Network timeout
- Discord API issues

**Solutions**:

#### Step 1: Retry Command
Wait 30 seconds and try the command again:
```
/naffles-status
```

#### Step 2: Check System Status
Run status command to check for issues:
```
/naffles-status
```

#### Step 3: Try Simpler Command
Test with a basic command first:
```
/naffles-help
```

### "Application Did Not Respond" Error

**Symptoms**:
```
The application did not respond
```

**Possible Causes**:
- Command timeout (3-second limit)
- High server load
- Database connectivity issues
- API rate limiting

**Solutions**:

#### Step 1: Wait and Retry
Discord has a 3-second response limit. Wait 1-2 minutes and try again.

#### Step 2: Check Bot Load
If multiple users are using the bot simultaneously, wait for lower usage periods.

#### Step 3: Use Alternative Commands
Try a simpler command to test responsiveness:
```
/naffles-help
```

### Commands Work But Show Errors

**Symptoms**:
- Command executes but shows error message
- Partial functionality works
- Inconsistent behavior

**Possible Causes**:
- API connectivity issues
- Database problems
- Permission issues
- Configuration problems

**Solutions**:

#### Step 1: Check Detailed Status
```
/naffles-status
```
Look for specific error indicators.

#### Step 2: Review Error Messages
Take note of exact error messages and when they occur.

#### Step 3: Test Different Commands
Try various commands to identify patterns:
- Do all commands fail or just specific ones?
- Are errors consistent or intermittent?
- Do errors occur for all users or just some?

## Task Creation Issues

### Task Creation Modal Doesn't Appear

**Symptoms**:
- `/naffles-create-task` command succeeds
- No modal window appears
- Command seems to hang

**Possible Causes**:
- Discord client issues
- Modal blocked by browser/client
- Network connectivity problems
- Bot processing delays

**Solutions**:

#### Step 1: Check Discord Client
1. **Desktop**: Ensure Discord is up to date
2. **Web**: Try different browser or disable ad blockers
3. **Mobile**: Use desktop/web version for modal interactions

#### Step 2: Retry Command
Wait 30 seconds and run the command again:
```
/naffles-create-task type:twitter_follow title:"Test" description:"Test task" points:10
```

#### Step 3: Check Permissions
Verify you have permission to create tasks:
- Do you have "Manage Server" permission?
- Is the server linked to a community?
- Are there custom permission restrictions?

### Modal Submission Fails

**Symptoms**:
- Modal appears and can be filled out
- Clicking "Submit" shows error or no response
- Task is not created

**Possible Causes**:
- Invalid input data
- Session timeout
- API connectivity issues
- Database problems

**Solutions**:

#### Step 1: Validate Input Data
Check your modal inputs:
- **Twitter Username**: No @ symbol, valid username
- **Discord Invite**: Valid invite link format
- **Telegram Link**: Valid Telegram link format
- **Custom Instructions**: Within character limits

#### Step 2: Try Shorter Inputs
If using custom tasks, try shorter descriptions:
- Keep instructions under 500 characters
- Use simple, clear language
- Avoid special characters

#### Step 3: Check Session Timing
Modals expire after 5 minutes. If you took too long to fill it out:
1. Run the command again
2. Fill out the modal quickly
3. Submit within 5 minutes

### Task Posts Don't Appear in Discord

**Symptoms**:
- Task creation succeeds
- No task post appears in Discord channel
- Task exists in Naffles dashboard

**Possible Causes**:
- Missing Discord permissions
- Channel restrictions
- Bot can't access channel
- Posting failures

**Solutions**:

#### Step 1: Check Channel Permissions
Verify bot has these permissions in the target channel:
- ✅ Send Messages
- ✅ Embed Links
- ✅ Use External Emojis (optional)

#### Step 2: Try Different Channel
Test task creation in a different channel:
```
/naffles-create-task type:twitter_follow title:"Test Channel" description:"Testing different channel" points:10
```

#### Step 3: Check Channel Settings
- Is the channel restricted to certain roles?
- Are there any channel-specific bot restrictions?
- Can other bots post in this channel?

## Allowlist Connection Problems

### "Allowlist Not Found" Error

**Symptoms**:
```
❌ Allowlist not found
Please check the allowlist ID and try again
```

**Possible Causes**:
- Incorrect Allowlist ID
- Allowlist doesn't exist
- Allowlist is private or restricted
- Typo in Allowlist ID

**Solutions**:

#### Step 1: Verify Allowlist ID
1. Go to your Naffles community dashboard
2. Navigate to **Allowlists** section
3. Find the allowlist you want to connect
4. Copy the exact Allowlist ID (format: `allow_1234567890abcdef`)

#### Step 2: Check Allowlist Status
1. Verify allowlist is active (not expired or cancelled)
2. Confirm allowlist belongs to your community
3. Check if allowlist has connection restrictions

#### Step 3: Test with Different Allowlist
Try connecting a different allowlist to isolate the issue.

### Allowlist Connection Succeeds But No Post Appears

**Symptoms**:
- Connection command succeeds
- No allowlist post in Discord channel
- Allowlist shows as connected in dashboard

**Possible Causes**:
- Discord posting permissions missing
- Channel restrictions
- Embed display issues
- Network problems during posting

**Solutions**:

#### Step 1: Check Bot Permissions
Ensure bot has these permissions in the channel:
- ✅ Send Messages
- ✅ Embed Links
- ✅ Add Reactions
- ✅ Manage Messages (for updates)

#### Step 2: Try Different Channel
Test allowlist connection in a different channel with full bot permissions.

#### Step 3: Manually Refresh
Sometimes posts appear with a delay. Wait 2-3 minutes and check again.

### Allowlist Entry Buttons Don't Work

**Symptoms**:
- Allowlist post appears correctly
- Clicking "Enter Allowlist" button shows error
- Button interactions fail

**Possible Causes**:
- User account not linked
- Entry requirements not met
- Button interaction timeout
- API connectivity issues

**Solutions**:

#### Step 1: Check Account Linking
Ensure your Discord account is linked to Naffles:
1. Visit [Naffles Account Settings](https://naffles.com/account/discord)
2. Complete Discord OAuth if not already linked
3. Verify linking is successful

#### Step 2: Verify Entry Requirements
Check if you meet all allowlist requirements:
- Required social media follows
- NFT ownership requirements
- Community membership requirements
- Geographic restrictions

#### Step 3: Try Again Later
Button interactions can sometimes fail due to temporary issues:
- Wait 5-10 minutes
- Try clicking the button again
- Check if the issue persists

## Permission and Access Issues

### "Insufficient Permissions" Errors

**Symptoms**:
```
❌ You don't have permission to use this command
```

**Possible Causes**:
- Missing Discord permissions
- Custom permission configuration
- Role-based restrictions
- Server-specific settings

**Solutions**:

#### Step 1: Check Your Discord Permissions
Required permissions for different commands:
- **Community Linking**: `Manage Server`
- **Task Creation**: `Manage Server` (default, customizable)
- **Allowlist Connection**: `Manage Server` (default, customizable)
- **Viewing Commands**: Usually no special permissions required

#### Step 2: Check Custom Permissions
1. Go to **Server Settings** → **Integrations**
2. Find Naffles bot
3. Click **Manage**
4. Review command-specific permissions

#### Step 3: Contact Server Administrator
If you believe you should have access:
1. Contact a server administrator
2. Request appropriate permissions
3. Ask about custom permission configuration

### Bot Can't Send Messages

**Symptoms**:
- Commands execute but no response appears
- Bot seems to work but messages don't show
- Other users can see bot messages but you can't

**Possible Causes**:
- Channel permission issues
- User-specific restrictions
- Message filtering
- Client display issues

**Solutions**:

#### Step 1: Check Channel Permissions
Verify bot has permission to send messages in the channel:
1. **Channel Settings** → **Permissions**
2. Find Naffles bot or @everyone role
3. Ensure "Send Messages" is enabled

#### Step 2: Check Personal Settings
1. Verify you haven't blocked the bot
2. Check if you have message filtering enabled
3. Ensure you can see messages from other bots

#### Step 3: Test in Different Channel
Try using commands in a different channel to isolate the issue.

### Role-Based Access Issues

**Symptoms**:
- Some users can use commands, others can't
- Inconsistent permission behavior
- Role-specific restrictions

**Possible Causes**:
- Custom role configuration
- Permission hierarchy issues
- Role assignment problems
- Server permission overrides

**Solutions**:

#### Step 1: Review Role Configuration
1. Check which roles have bot permissions
2. Verify user has appropriate roles
3. Look for permission conflicts

#### Step 2: Test with Different Roles
If possible, temporarily assign different roles to test permission behavior.

#### Step 3: Simplify Permissions
Consider simplifying permission structure:
1. Use default permissions initially
2. Add custom restrictions gradually
3. Test each change thoroughly

## Performance and Response Issues

### Slow Command Responses

**Symptoms**:
- Commands take 5+ seconds to respond
- Frequent timeouts
- Inconsistent response times

**Possible Causes**:
- High server load
- Network connectivity issues
- Database performance problems
- API rate limiting

**Solutions**:

#### Step 1: Check System Status
```
/naffles-status
```
Look for performance indicators and response times.

#### Step 2: Monitor Response Times
Test commands at different times:
- Peak usage hours vs. off-peak
- Different days of the week
- Before and after server restarts

#### Step 3: Reduce Command Frequency
If you're running many commands quickly:
- Space out command usage
- Wait for previous commands to complete
- Avoid rapid-fire command execution

### Memory or Resource Issues

**Symptoms**:
- Bot becomes unresponsive over time
- Commands work initially but fail later
- Performance degrades gradually

**Possible Causes**:
- Memory leaks
- Resource exhaustion
- Database connection issues
- Cache problems

**Solutions**:

#### Step 1: Monitor Resource Usage
If self-hosting, check:
- Memory usage trends
- CPU utilization
- Database connection counts
- Cache hit rates

#### Step 2: Restart Services
For self-hosted instances:
```bash
# Restart bot service
pm2 restart naffles-discord-bot

# Or restart with npm
npm run restart
```

#### Step 3: Check Logs
Review logs for memory warnings or resource issues:
```bash
# View recent logs
pm2 logs naffles-discord-bot --lines 100

# Check for memory warnings
grep -i "memory\|heap\|gc" logs/bot.log
```

### Rate Limiting Issues

**Symptoms**:
```
⏰ Rate Limited
You're sending commands too quickly
```

**Possible Causes**:
- Too many commands in short time
- Multiple users using bot simultaneously
- API rate limits reached
- Automated command usage

**Solutions**:

#### Step 1: Understand Rate Limits
Default rate limits:
- **Per User**: 10 commands per minute
- **Per Server**: 100 commands per minute
- **Global**: 1000 commands per minute

#### Step 2: Space Out Usage
- Wait between commands
- Coordinate with other users
- Plan command usage during off-peak hours

#### Step 3: Request Rate Limit Increase
For high-usage communities:
1. Contact Naffles support
2. Provide usage statistics
3. Request custom rate limits

## Integration and API Problems

### Naffles API Connectivity Issues

**Symptoms**:
```
❌ Connection Error
Unable to connect to Naffles services
```

**Possible Causes**:
- Naffles API downtime
- Network connectivity issues
- API key problems
- Firewall restrictions

**Solutions**:

#### Step 1: Check Naffles Status
1. Visit [Naffles Status Page](https://status.naffles.com)
2. Check for ongoing incidents
3. Review recent updates

#### Step 2: Test API Connectivity
```
/naffles-status
```
This will show API response times and connectivity status.

#### Step 3: Wait and Retry
If it's a temporary issue:
- Wait 5-10 minutes
- Try commands again
- Monitor status page for updates

### Authentication and API Key Issues

**Symptoms**:
```
❌ Authentication Failed
Invalid API credentials
```

**Possible Causes**:
- Expired API key
- Invalid API key configuration
- Account permission changes
- API key revoked

**Solutions**:

#### Step 1: Check API Key Status
1. Go to Naffles dashboard
2. Navigate to **Settings** → **API Keys**
3. Verify Discord bot API key is active
4. Check expiration date

#### Step 2: Regenerate API Key
If key is expired or invalid:
1. Click **Regenerate Key**
2. Update bot configuration with new key
3. Restart bot service (if self-hosting)

#### Step 3: Verify Permissions
Ensure API key has correct permissions:
- Discord bot integration
- Community management
- Task creation
- Allowlist management

### Database Connectivity Problems

**Symptoms**:
- Commands fail with database errors
- Inconsistent data storage
- Connection timeout errors

**Possible Causes**:
- Database server issues
- Connection pool exhaustion
- Network connectivity problems
- Database authentication issues

**Solutions**:

#### Step 1: Check Database Status
For self-hosted instances:
```bash
# Check MongoDB status
systemctl status mongod

# Check Redis status
systemctl status redis

# Test database connectivity
mongo --eval "db.adminCommand('ismaster')"
```

#### Step 2: Review Connection Configuration
Verify database connection strings:
```env
MONGODB_URI=mongodb://localhost:27017/naffles-discord-bot
REDIS_URL=redis://localhost:6379
```

#### Step 3: Restart Database Services
If necessary:
```bash
# Restart MongoDB
sudo systemctl restart mongod

# Restart Redis
sudo systemctl restart redis
```

## Advanced Troubleshooting

### Log Analysis

#### Accessing Logs

**For Hosted Service**:
- Logs are managed by Naffles support
- Contact support for specific log analysis
- Provide timestamps and error descriptions

**For Self-Hosted Instances**:
```bash
# View real-time logs
pm2 logs naffles-discord-bot

# View specific log file
tail -f logs/bot.log

# Search for errors
grep -i "error\|fail\|exception" logs/bot.log

# View logs from specific time
grep "2024-01-15 14:" logs/bot.log
```

#### Important Log Patterns

**Successful Operations**:
```
[INFO] Command executed successfully: create-task by user123
[INFO] Task created: task789 for community comm_abc123
[INFO] API call successful: POST /api/communities/comm_abc123/tasks
```

**Error Patterns**:
```
[ERROR] Command failed: create-task - Permission denied
[ERROR] API call failed: 404 Community not found
[ERROR] Database connection lost, attempting reconnection
```

**Performance Issues**:
```
[WARN] Slow API response: 5.2s for GET /api/communities/comm_abc123/tasks
[WARN] High memory usage: 512MB (threshold: 256MB)
[WARN] Rate limit approaching: 95/100 requests in window
```

### Network Diagnostics

#### Testing Connectivity

**Discord API**:
```bash
# Test Discord API connectivity
curl -H "Authorization: Bot YOUR_BOT_TOKEN" https://discord.com/api/v10/users/@me

# Check Discord gateway
curl https://discord.com/api/v10/gateway
```

**Naffles API**:
```bash
# Test Naffles API connectivity
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.naffles.com/health

# Test specific endpoint
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.naffles.com/api/communities/YOUR_COMMUNITY_ID
```

#### DNS and Network Issues

```bash
# Check DNS resolution
nslookup discord.com
nslookup api.naffles.com

# Test network connectivity
ping discord.com
ping api.naffles.com

# Check port connectivity
telnet discord.com 443
telnet api.naffles.com 443
```

### Performance Monitoring

#### System Metrics

**Memory Usage**:
```bash
# Check memory usage
free -h

# Check process memory
ps aux | grep node

# Monitor memory over time
watch -n 5 'free -h && ps aux | grep node'
```

**CPU Usage**:
```bash
# Check CPU usage
top -p $(pgrep -f "naffles-discord-bot")

# Monitor CPU over time
iostat -x 1
```

**Database Performance**:
```bash
# MongoDB performance
mongo --eval "db.serverStatus().connections"
mongo --eval "db.serverStatus().opcounters"

# Redis performance
redis-cli info stats
redis-cli info memory
```

### Configuration Validation

#### Environment Variables

```bash
# Check required environment variables
echo $DISCORD_BOT_TOKEN
echo $NAFFLES_API_KEY
echo $MONGODB_URI
echo $REDIS_URL

# Validate configuration
node -e "
const config = require('./config');
console.log('Configuration valid:', config.validate());
"
```

#### Permission Validation

```javascript
// Test bot permissions
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    const guild = client.guilds.cache.get('YOUR_GUILD_ID');
    const botMember = guild.members.cache.get(client.user.id);
    
    console.log('Bot permissions:', botMember.permissions.toArray());
    
    const channel = guild.channels.cache.get('YOUR_CHANNEL_ID');
    const permissions = channel.permissionsFor(botMember);
    
    console.log('Channel permissions:', permissions.toArray());
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

## Getting Additional Help

### Before Contacting Support

Please gather the following information:

#### System Information
- Bot version (if self-hosting)
- Discord server ID
- Community ID
- Operating system (if self-hosting)
- Node.js version (if self-hosting)

#### Error Details
- Exact error messages (screenshots preferred)
- Commands that failed
- Time when issues occurred
- Steps to reproduce the problem

#### Environment Information
- Number of server members
- Bot usage frequency
- Recent changes to server or community
- Other bots in the server

### Support Channels

#### Naffles Support
- **Email**: [support@naffles.com](mailto:support@naffles.com)
- **Response Time**: 24-48 hours
- **Best For**: Account issues, API problems, billing questions

#### Community Support
- **Discord**: [discord.gg/naffles](https://discord.gg/naffles)
- **Response Time**: Usually within hours
- **Best For**: General questions, community help, tips and tricks

#### Technical Support
- **GitHub Issues**: [github.com/naffles/discord-bot/issues](https://github.com/naffles/discord-bot/issues)
- **Response Time**: 1-3 business days
- **Best For**: Bug reports, feature requests, technical issues

#### Documentation
- **Main Documentation**: [docs.naffles.com/discord-bot](https://docs.naffles.com/discord-bot)
- **API Documentation**: [docs.naffles.com/api](https://docs.naffles.com/api)
- **Community Guides**: [community.naffles.com](https://community.naffles.com)

### Emergency Support

For critical issues affecting multiple users or communities:

#### Immediate Actions
1. Check [Naffles Status Page](https://status.naffles.com)
2. Join [Naffles Discord](https://discord.gg/naffles) for real-time updates
3. Email [urgent@naffles.com](mailto:urgent@naffles.com) for critical issues

#### What Qualifies as Emergency
- Bot completely offline for multiple communities
- Data loss or corruption
- Security vulnerabilities
- Payment or billing issues affecting service

### Self-Help Resources

#### Documentation
- [Setup Guide](setup-guide.md) - Complete setup instructions
- [Commands Reference](commands.md) - Detailed command documentation
- [API Documentation](https://docs.naffles.com/api) - API reference
- [Security Guide](security.md) - Security best practices

#### Community Resources
- **Discord Community**: Active community with helpful members
- **FAQ Section**: Common questions and answers
- **Video Tutorials**: Step-by-step video guides
- **Blog Posts**: Tips, tricks, and best practices

#### Diagnostic Tools
- `/naffles-status` - Comprehensive system health check
- `/naffles-help` - Interactive help system
- **Monitoring Dashboard** - Real-time system metrics (if self-hosting)
- **Log Analysis Tools** - For detailed troubleshooting (if self-hosting)

---

**Still having issues?** Don't hesitate to reach out to our support team at [support@naffles.com](mailto:support@naffles.com) or join our [Discord community](https://discord.gg/naffles) for help from other users and our team.