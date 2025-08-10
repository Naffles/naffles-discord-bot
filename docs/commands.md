# Discord Bot Commands Reference

This document provides comprehensive information about all available Naffles Discord bot commands, their usage, parameters, and examples.

## Table of Contents

1. [Command Overview](#command-overview)
2. [Community Management Commands](#community-management-commands)
3. [Social Task Commands](#social-task-commands)
4. [Allowlist Commands](#allowlist-commands)
5. [Utility Commands](#utility-commands)
6. [Administrative Commands](#administrative-commands)
7. [Interactive Elements](#interactive-elements)
8. [Permission Requirements](#permission-requirements)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)

## Command Overview

The Naffles Discord bot uses Discord's slash command system for all interactions. All commands are prefixed with `naffles-` to avoid conflicts with other bots.

### Command Categories

| Category | Commands | Purpose |
|----------|----------|---------|
| **Community Management** | `link-community` | Connect Discord server to Naffles community |
| **Social Tasks** | `create-task`, `list-tasks` | Manage community social tasks |
| **Allowlists** | `connect-allowlist` | Connect and manage allowlist campaigns |
| **Utilities** | `status`, `help` | Bot status and help information |
| **Administrative** | `security`, `allowlist-analytics` | Advanced management features |

### Global Command Features

- **Slash Command Interface**: All commands use Discord's native slash command system
- **Auto-completion**: Parameters include helpful suggestions and validation
- **Ephemeral Responses**: Most responses are private to the user unless specified
- **Interactive Elements**: Commands include buttons, select menus, and modals
- **Real-time Updates**: Many commands provide live updates and status changes
- **Error Handling**: Comprehensive error messages with actionable suggestions

## Community Management Commands

### `/naffles-link-community`

Links your Discord server to a Naffles community, enabling all bot functionality.

#### Syntax
```
/naffles-link-community community_id:<community_id>
```

#### Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `community_id` | String | ✅ Yes | Your Naffles community ID | `comm_1234567890abcdef` |

#### Usage Examples

```bash
# Basic community linking
/naffles-link-community community_id:comm_1234567890abcdef

# The bot will respond with either:
# ✅ Success: Server linked to [Community Name]
# 🔗 OAuth Required: [Authentication Link]
# ❌ Error: [Error Message]
```

#### Response Types

**Successful Linking**:
```
✅ Server successfully linked to "Awesome NFT Community"!

🎯 You can now:
• Create social tasks with /naffles-create-task
• Connect allowlists with /naffles-connect-allowlist
• View community status with /naffles-status

📚 Need help? Use /naffles-help for more information.
```

**OAuth Authentication Required**:
```
🔗 Authentication Required

To complete the linking process, please authenticate your Naffles account:

[Authenticate Now] (Button)

This ensures you have permission to link this community to Discord.
```

**Error Response**:
```
❌ Community Linking Failed

Reason: Community not found
• Double-check your Community ID
• Ensure you own this community
• Verify the community is active

Need help? Contact support or use /naffles-help
```

#### Permission Requirements
- **Discord**: `Manage Server` permission
- **Naffles**: Community owner or administrator access

#### Common Issues
- **Community not found**: Verify Community ID from Naffles dashboard
- **Permission denied**: Ensure you own the Naffles community
- **Already linked**: Each community can only link to one Discord server

---

## Social Task Commands

### `/naffles-create-task`

Creates a new social task for your community with customizable parameters and rewards.

#### Syntax
```
/naffles-create-task type:<task_type> title:<title> description:<description> points:<points> [duration:<hours>]
```

#### Parameters

| Parameter | Type | Required | Description | Constraints | Example |
|-----------|------|----------|-------------|-------------|---------|
| `type` | Choice | ✅ Yes | Type of social task | twitter_follow, discord_join, telegram_join, custom | `twitter_follow` |
| `title` | String | ✅ Yes | Task title | Max 100 characters | `"Follow our Twitter"` |
| `description` | String | ✅ Yes | Task description | Max 500 characters | `"Follow @naffles for updates"` |
| `points` | Integer | ✅ Yes | Points reward | 1-10,000 | `100` |
| `duration` | Integer | ❌ No | Duration in hours | 1-8,760 (1 year) | `168` (1 week) |

#### Task Types

##### Twitter Follow Task
**Purpose**: Users follow a specified Twitter account

**Additional Modal Fields**:
- `twitter_username`: Twitter handle without @ symbol

**Example**:
```bash
/naffles-create-task type:twitter_follow title:"Follow Our Twitter" description:"Follow @naffles for the latest updates and announcements" points:50 duration:168
```

**Modal Input**:
```
Twitter Username (without @): naffles
```

##### Discord Join Task
**Purpose**: Users join a specified Discord server

**Additional Modal Fields**:
- `discord_invite`: Discord server invite link

**Example**:
```bash
/naffles-create-task type:discord_join title:"Join Our Discord" description:"Join our community Discord server for exclusive content" points:75 duration:72
```

**Modal Input**:
```
Discord Invite Link: https://discord.gg/naffles
```

##### Telegram Join Task
**Purpose**: Users join a Telegram group or channel

**Additional Modal Fields**:
- `telegram_link`: Telegram group/channel link

**Example**:
```bash
/naffles-create-task type:telegram_join title:"Join Telegram Group" description:"Join our Telegram for real-time discussions" points:60 duration:120
```

**Modal Input**:
```
Telegram Group/Channel Link: https://t.me/naffles
```

##### Custom Task
**Purpose**: Any custom action defined by the community

**Additional Modal Fields**:
- `custom_instructions`: Detailed task instructions (max 1,000 characters)
- `verification_method`: How completion will be verified (max 500 characters)

**Example**:
```bash
/naffles-create-task type:custom title:"Share Our Content" description:"Share our latest blog post on social media" points:150 duration:48
```

**Modal Input**:
```
Task Instructions: 
Share our latest blog post (link: https://blog.naffles.com/latest) on your preferred social media platform. Include the hashtags #Naffles #NFT #Community in your post.

Verification Method:
Submit a screenshot of your social media post showing the shared content and required hashtags. Manual review by community moderators.
```

#### Task Creation Flow

1. **Command Execution**: User runs `/naffles-create-task` with basic parameters
2. **Permission Check**: Bot verifies user has task creation permissions
3. **Community Verification**: Bot confirms server is linked to a community
4. **Modal Display**: Bot shows task-type-specific modal for additional details
5. **Task Creation**: Bot creates task via Naffles API
6. **Discord Posting**: Bot posts task to Discord channel with interactive elements
7. **Progress Tracking**: Bot begins real-time progress monitoring

#### Task Post Format

When a task is created, the bot posts an interactive embed:

```
🎯 Follow Our Twitter

Follow @naffles for the latest updates and announcements

💰 Reward: 50 points
🏷️ Type: 🐦 Twitter Follow  
⏰ Duration: 7 days
📊 Status: 🟢 Active

👥 Participants: 0
🎯 Completion Rate: 0%

[Complete Task] [View Details] [Share Task]

Created by @username • Ends in 7 days
```

#### Real-time Updates

Task posts update automatically with:
- Current participant count
- Completion statistics
- Time remaining
- Status changes

#### Permission Requirements
- **Default**: `Manage Server` permission
- **Customizable**: Can be configured per server
- **Community**: Server must be linked to a Naffles community

---

### `/naffles-list-tasks`

Displays all social tasks for your community with filtering and detailed information.

#### Syntax
```
/naffles-list-tasks [status:<status>]
```

#### Parameters

| Parameter | Type | Required | Description | Options | Default |
|-----------|------|----------|-------------|---------|---------|
| `status` | Choice | ❌ No | Filter tasks by status | active, completed, expired, all | `active` |

#### Usage Examples

```bash
# List active tasks (default)
/naffles-list-tasks

# List all tasks
/naffles-list-tasks status:all

# List completed tasks
/naffles-list-tasks status:completed

# List expired tasks
/naffles-list-tasks status:expired
```

#### Response Format

**Main Embed**:
```
📋 Social Tasks (active)

Found 5 active tasks for this community.

💰 Total Points Available: 450
✅ Completed Tasks: 0  
📊 Active Tasks: 5

📈 Total Completions (7d): 23
👥 Active Users (7d): 15
🎯 Success Rate: 87%

Select a task below to view details ⬇️
```

**Interactive Select Menu**:
```
🐦 Follow Our Twitter - 50 points • Twitter Follow • active
💬 Join Our Discord - 75 points • Discord Join • active  
📱 Join Telegram Group - 60 points • Telegram Join • active
🔧 Share Our Content - 150 points • Custom Task • active
🐦 Retweet Announcement - 25 points • Twitter Follow • active
```

#### Task Detail View

When a task is selected from the menu:

```
🎯 Follow Our Twitter

Follow @naffles for the latest updates and announcements

💰 Reward: 50 points
🏷️ Type: 🐦 Twitter Follow
📊 Status: 🟢 Active
⏰ Duration: 168 hours
✅ Completed By: 12 users
⏰ Ends: in 3 days

🐦 Twitter Account: @naffles

[Complete Task] [Share Task]

Powered by Naffles • Created 4 days ago
```

#### Analytics Data (Admin Users)

Community administrators see additional analytics:
- Total completions in the last 7 days
- Number of active users
- Success rate percentage
- Engagement metrics
- Performance comparisons

#### Permission Requirements
- **Everyone**: Can view task lists
- **Administrators**: See additional analytics data

---

## Allowlist Commands

### `/naffles-connect-allowlist`

Connects an existing Naffles allowlist to your Discord channel for easy community access.

#### Syntax
```
/naffles-connect-allowlist allowlist_id:<allowlist_id>
```

#### Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `allowlist_id` | String | ✅ Yes | The ID of the allowlist to connect | `allow_1234567890abcdef` |

#### Usage Examples

```bash
# Connect an allowlist to current channel
/naffles-connect-allowlist allowlist_id:allow_1234567890abcdef
```

#### Allowlist Post Format

When successfully connected, the bot posts an interactive allowlist embed:

```
🎫 Exclusive NFT Allowlist

Get early access to our upcoming NFT collection! Limited spots available.

🎯 Winner Selection: 100 winners
💰 Entry Cost: Free
⏰ Ends: in 5 days, 12 hours

👥 Current Entries: 47/∞
🎲 Your Odds: 1 in 1.47 (if 100 winners)

📋 Requirements:
✅ Follow @naffles on Twitter
✅ Join our Discord server  
✅ Hold 1+ Naffles NFT

[Enter Allowlist] [View Details] [Share]

🔗 Connected by @moderator • Ends March 15, 2024
```

#### Entry Process

When users click "Enter Allowlist":

1. **Requirement Check**: Bot verifies user meets all requirements
2. **Account Linking**: Automatic Discord-Naffles account linking if needed
3. **Entry Submission**: Entry is recorded in Naffles system
4. **Confirmation**: User receives confirmation message
5. **Real-time Update**: Allowlist post updates with new entry count

#### Entry Confirmation Messages

**Successful Entry**:
```
✅ Allowlist Entry Successful!

You've been entered into "Exclusive NFT Allowlist"

🎯 Your Entry: #48
🎲 Current Odds: 1 in 1.48 (if 100 winners)
⏰ Drawing: in 5 days, 12 hours

Good luck! 🍀
```

**Requirements Not Met**:
```
❌ Entry Requirements Not Met

To enter this allowlist, you need:

❌ Follow @naffles on Twitter
✅ Join our Discord server
❌ Hold 1+ Naffles NFT

Complete the missing requirements and try again.

[Complete Requirements] [Get Help]
```

**Already Entered**:
```
ℹ️ Already Entered

You're already entered in this allowlist!

🎯 Your Entry: #23
🎲 Current Odds: 1 in 1.47 (if 100 winners)
⏰ Drawing: in 5 days, 12 hours

[View Details] [Share with Friends]
```

#### Real-time Updates

Allowlist posts update automatically with:
- Current entry count
- Updated odds calculation
- Time remaining
- Status changes (active → drawing → completed)

#### Permission Requirements
- **Discord**: `Manage Server` permission to connect allowlists
- **Naffles**: Access to the specific allowlist
- **Entry**: Anyone can enter (subject to allowlist requirements)

---

## Utility Commands

### `/naffles-status`

Provides comprehensive status information about the bot, community connection, and system health.

#### Syntax
```
/naffles-status
```

#### Parameters
None - this command takes no parameters.

#### Usage Examples

```bash
# Check bot and community status
/naffles-status
```

#### Response Format

**Healthy System**:
```
🤖 Naffles Bot Status

✅ Bot Status: Online
✅ Community: Awesome NFT Community
✅ API Connection: Healthy (120ms)
✅ Database: Connected
✅ Cache: Operational
✅ Permissions: Configured

📊 Community Stats:
• Active Tasks: 5
• Total Members: 1,247
• Points Distributed: 15,420

🔧 System Info:
• Version: 1.2.3
• Uptime: 2 days, 14 hours
• Memory Usage: 156MB
• Response Time: 45ms

Last Updated: 2 minutes ago
```

**Issues Detected**:
```
🤖 Naffles Bot Status

✅ Bot Status: Online
❌ Community: Not Linked
⚠️ API Connection: Slow (2.1s)
✅ Database: Connected
❌ Cache: Disconnected
⚠️ Permissions: Incomplete

🔧 Issues Found:
• Server not linked to community - Use /naffles-link-community
• API response time high - May affect performance
• Cache disconnected - Some features may be slower
• Missing "Embed Links" permission in #general

🆘 Need Help?
Use /naffles-help or contact support

Last Updated: just now
```

#### Status Indicators

| Indicator | Meaning | Action Required |
|-----------|---------|-----------------|
| ✅ Green | System healthy | None |
| ⚠️ Yellow | Warning/degraded | Monitor, may need attention |
| ❌ Red | Error/offline | Immediate action required |

#### Diagnostic Information

The status command provides detailed diagnostic information:

**Connection Health**:
- Discord API connectivity
- Naffles API response times
- Database connection status
- Redis cache availability

**Community Information**:
- Linked community details
- Active task count
- Member statistics
- Recent activity

**System Metrics**:
- Bot version and uptime
- Memory and CPU usage
- Response time averages
- Error rates

#### Permission Requirements
- **Everyone**: Can check basic status
- **Administrators**: See additional diagnostic information

---

### `/naffles-help`

Provides comprehensive help information with interactive elements for easy navigation.

#### Syntax
```
/naffles-help
```

#### Parameters
None - this command takes no parameters.

#### Usage Examples

```bash
# Get help information
/naffles-help
```

#### Response Format

**For Linked Servers**:
```
🤖 Naffles Discord Bot Help

Welcome to the Naffles Discord bot! Here's everything you need to know.

✅ Server Status
This server is linked to Awesome NFT Community

📋 Available Commands
• /naffles-create-task - Create social tasks
• /naffles-list-tasks - View active tasks
• /naffles-connect-allowlist - Connect allowlists
• /naffles-status - Check connection status
• /naffles-help - Show this help

🎯 Social Tasks
Create Twitter follows, Discord joins, Telegram joins, and custom tasks with point rewards.

🎫 Allowlists
Connect existing Naffles allowlists to your Discord server for easy entry.

📊 Management
Check status, test connections, and manage your community integration.

[Command Details] [Setup Guide] [Documentation]

Choose a help topic below ⬇️
```

**For Unlinked Servers**:
```
🤖 Naffles Discord Bot Help

Welcome to the Naffles Discord bot! Here's everything you need to know.

⚠️ Server Status
This server is not linked to a Naffles community yet.

🚀 Getting Started
1. Get Community ID - Find it in your Naffles community settings
2. Link Server - Use /naffles-link-community with your ID
3. Verify Connection - Check with /naffles-status
4. Start Creating - Use /naffles-create-task and other commands

📋 Basic Commands
• /naffles-link-community - Link your community
• /naffles-status - Check bot status
• /naffles-help - Show this help

[Command Details] [Setup Guide] [Documentation]

Choose a help topic below ⬇️
```

#### Interactive Help Topics

The help command includes a select menu with detailed topics:

**Community Linking**:
- What is community linking
- Requirements and setup process
- Common issues and solutions
- Step-by-step linking guide

**Social Tasks**:
- Task types and creation process
- Point rewards and duration settings
- Task management and analytics
- Best practices for engagement

**Allowlists**:
- Connecting and managing allowlists
- Entry requirements and verification
- Winner selection and notifications
- Integration with Naffles platform

**Permissions**:
- Required Discord permissions
- User permission levels
- Customizing access control
- Troubleshooting permission issues

**Troubleshooting**:
- Common issues and solutions
- Diagnostic commands
- Error message explanations
- Getting additional support

#### Interactive Elements

**Action Buttons**:
- **Command Details**: Detailed command reference
- **Setup Guide**: Step-by-step setup instructions
- **Documentation**: Link to full documentation

**Help Topics Menu**:
- **Community Linking**: Server-community connection help
- **Social Tasks**: Task creation and management
- **Allowlists**: Allowlist integration guide
- **Permissions**: Permission configuration help
- **Troubleshooting**: Common issues and solutions

#### Permission Requirements
- **Everyone**: Can access help information
- **Context-Aware**: Shows relevant information based on server status

---

## Administrative Commands

### `/naffles-security`

Advanced security monitoring and management command for community administrators.

#### Syntax
```
/naffles-security [action:<action>] [timeframe:<timeframe>]
```

#### Parameters

| Parameter | Type | Required | Description | Options |
|-----------|------|----------|-------------|---------|
| `action` | Choice | ❌ No | Security action to perform | `status`, `report`, `audit`, `alerts` |
| `timeframe` | Choice | ❌ No | Time period for reports | `1h`, `24h`, `7d`, `30d` |

#### Usage Examples

```bash
# Check security status
/naffles-security action:status

# Generate security report
/naffles-security action:report timeframe:7d

# View audit log
/naffles-security action:audit timeframe:24h

# Check security alerts
/naffles-security action:alerts
```

#### Permission Requirements
- **Discord**: `Administrator` permission
- **Naffles**: Community owner or security administrator

---

### `/naffles-allowlist-analytics`

Detailed analytics for allowlist performance and engagement.

#### Syntax
```
/naffles-allowlist-analytics [allowlist_id:<allowlist_id>] [metric:<metric>]
```

#### Parameters

| Parameter | Type | Required | Description | Options |
|-----------|------|----------|-------------|---------|
| `allowlist_id` | String | ❌ No | Specific allowlist to analyze | Any valid allowlist ID |
| `metric` | Choice | ❌ No | Specific metric to focus on | `entries`, `engagement`, `conversion`, `demographics` |

#### Permission Requirements
- **Discord**: `Manage Server` permission
- **Naffles**: Community administrator access

---

## Interactive Elements

### Buttons

The bot uses various button types for interactive functionality:

#### Primary Action Buttons
- **Complete Task**: Initiates task completion flow
- **Enter Allowlist**: Starts allowlist entry process
- **View Details**: Shows detailed information
- **Share**: Generates shareable links

#### Secondary Action Buttons
- **Get Help**: Links to help resources
- **Contact Support**: Opens support channels
- **View Analytics**: Shows performance data (admin only)
- **Manage Settings**: Access configuration options (admin only)

#### Navigation Buttons
- **Back**: Returns to previous view
- **Next**: Advances to next step
- **Close**: Dismisses interactive elements
- **Refresh**: Updates current information

### Select Menus

#### Task Selection Menu
Used in `/naffles-list-tasks` for choosing specific tasks:
```
🐦 Follow Our Twitter - 50 points • Twitter Follow • active
💬 Join Our Discord - 75 points • Discord Join • active
📱 Join Telegram - 60 points • Telegram Join • active
```

#### Help Topic Menu
Used in `/naffles-help` for navigating help sections:
```
🔗 Community Linking - How to link your Discord server
🎯 Social Tasks - Creating and managing tasks
🎫 Allowlists - Connecting allowlist campaigns
🔐 Permissions - Required Discord permissions
🔧 Troubleshooting - Common issues and solutions
```

### Modals

#### Task Creation Modal
Appears after running `/naffles-create-task`:

**Twitter Follow Task**:
```
Create Social Task

Twitter Username (without @) *
[naffles                    ]

[Cancel] [Create Task]
```

**Custom Task**:
```
Create Social Task

Task Instructions *
[Detailed instructions for completing this task...]

Verification Method *
[How will completion be verified?]

[Cancel] [Create Task]
```

### Real-time Updates

Many interactive elements update in real-time:

#### Task Progress Updates
- Participant count changes
- Completion statistics
- Time remaining countdowns
- Status transitions

#### Allowlist Entry Updates
- Entry count increments
- Odds calculations
- Requirement status changes
- Drawing countdown

#### System Status Updates
- Health check results
- Performance metrics
- Error notifications
- Maintenance announcements

---

## Permission Requirements

### Discord Permission Levels

#### Server-Level Permissions

| Permission | Required For | Customizable |
|------------|--------------|--------------|
| `Manage Server` | Community linking, task creation, allowlist connection | ❌ No (linking), ✅ Yes (others) |
| `Manage Messages` | Task management, content moderation | ✅ Yes |
| `Administrator` | Security commands, advanced analytics | ❌ No |

#### Channel-Level Permissions

| Permission | Purpose | Impact if Missing |
|------------|---------|-------------------|
| `Send Messages` | Bot responses and posts | Commands fail silently |
| `Embed Links` | Rich embed display | Plain text responses only |
| `Use Slash Commands` | Command functionality | Commands not available |
| `Add Reactions` | Interactive buttons | Buttons don't work |
| `Read Message History` | Context awareness | Limited functionality |

### Naffles Platform Permissions

#### Community Roles

| Role | Discord Command Access | Naffles Dashboard Access |
|------|----------------------|-------------------------|
| **Owner** | All commands | Full administrative access |
| **Administrator** | All commands except linking | Administrative dashboard |
| **Manager** | Task and allowlist commands | Community management |
| **Moderator** | View commands only | Limited moderation tools |
| **Member** | View commands only | Basic member access |

#### API Access Levels

| Access Level | Available Endpoints | Command Restrictions |
|--------------|-------------------|---------------------|
| **Full Access** | All API endpoints | No restrictions |
| **Community Management** | Community-specific endpoints | Limited to owned communities |
| **Read Only** | GET endpoints only | View commands only |
| **No Access** | No API access | Commands fail |

### Permission Configuration

#### Default Configuration

```javascript
// Default permission structure
{
  "commands": {
    "naffles-link-community": {
      "requiredPermissions": ["ManageGuild"],
      "customizable": false
    },
    "naffles-create-task": {
      "requiredPermissions": ["ManageGuild"],
      "customizable": true
    },
    "naffles-connect-allowlist": {
      "requiredPermissions": ["ManageGuild"],
      "customizable": true
    },
    "naffles-list-tasks": {
      "requiredPermissions": [],
      "customizable": true
    },
    "naffles-status": {
      "requiredPermissions": [],
      "customizable": true
    },
    "naffles-help": {
      "requiredPermissions": [],
      "customizable": false
    }
  }
}
```

#### Custom Configuration

Server administrators can customize permissions through:

1. **Discord Server Settings**:
   - Server Settings → Integrations → Naffles Bot
   - Configure per-command permissions
   - Set role-based access control

2. **Bot Configuration** (self-hosted):
   - Edit permission configuration files
   - Set custom role requirements
   - Configure channel restrictions

---

## Error Handling

### Common Error Types

#### Permission Errors

**Insufficient Discord Permissions**:
```
❌ Permission Denied

You need the "Manage Server" permission to use this command.

Contact a server administrator to:
• Grant you the required permission
• Configure custom permissions for this command

[Get Help] [Contact Admin]
```

**Insufficient Naffles Permissions**:
```
❌ Community Access Denied

You don't have permission to manage this community.

Possible reasons:
• You're not the community owner
• Your account isn't linked properly
• Community permissions have changed

[Link Account] [Contact Support]
```

#### Connection Errors

**Server Not Linked**:
```
❌ Server Not Linked

This Discord server isn't linked to a Naffles community.

To use this command:
1. Link your server with /naffles-link-community
2. Provide your Community ID
3. Complete the authentication process

[Get Community ID] [Link Server]
```

**API Connection Failed**:
```
❌ Connection Error

Unable to connect to Naffles services.

This might be temporary. Please:
• Wait a few minutes and try again
• Check /naffles-status for system health
• Contact support if the issue persists

[Check Status] [Try Again] [Get Support]
```

#### Validation Errors

**Invalid Parameters**:
```
❌ Invalid Input

The following parameters have issues:
• Points: Must be between 1 and 10,000
• Duration: Must be between 1 and 8,760 hours
• Title: Cannot be empty

Please correct these issues and try again.

[Try Again] [Get Help]
```

**Resource Not Found**:
```
❌ Not Found

The requested resource couldn't be found:
• Community ID: comm_1234567890abcdef
• Allowlist ID: allow_9876543210fedcba

Please verify the ID and try again.

[Check ID] [Get Help]
```

#### Rate Limiting

**Rate Limit Exceeded**:
```
⏰ Rate Limited

You're sending commands too quickly.

Please wait 30 seconds before trying again.

Rate limits help ensure fair usage for all users.

[Learn More] [Try Again Later]
```

**Global Rate Limit**:
```
⏰ System Busy

The bot is currently handling many requests.

Please wait a moment and try again.

Estimated wait time: 2 minutes

[Check Status] [Try Again Later]
```

### Error Recovery

#### Automatic Recovery

The bot implements automatic recovery for:
- **Temporary Network Issues**: Automatic retry with exponential backoff
- **Database Disconnections**: Connection pooling and reconnection logic
- **API Timeouts**: Request queuing and retry mechanisms
- **Cache Failures**: Graceful degradation to direct API calls

#### Manual Recovery

Users can trigger manual recovery through:
- **Retry Buttons**: Available on most error messages
- **Status Commands**: `/naffles-status` provides diagnostic information
- **Help Commands**: `/naffles-help` offers troubleshooting guidance
- **Support Channels**: Direct access to help resources

### Error Reporting

#### User-Friendly Messages

All error messages include:
- **Clear Description**: What went wrong in simple terms
- **Possible Causes**: Why the error might have occurred
- **Action Steps**: What the user can do to resolve it
- **Help Resources**: Where to get additional assistance

#### Technical Logging

For administrators and developers:
- **Detailed Stack Traces**: Full error context for debugging
- **Request Context**: User, server, and command information
- **Performance Metrics**: Response times and resource usage
- **Correlation IDs**: For tracking issues across systems

---

## Best Practices

### Command Usage

#### Effective Task Creation

**Good Task Examples**:
```bash
# Clear, actionable, appropriate reward
/naffles-create-task type:twitter_follow title:"Follow for Updates" description:"Follow @naffles for project updates and announcements" points:50 duration:168

# Engaging custom task with clear instructions
/naffles-create-task type:custom title:"Share Your Story" description:"Share why you're excited about our community" points:200 duration:72
```

**Avoid These Patterns**:
```bash
# Too vague, unclear reward
/naffles-create-task type:custom title:"Do stuff" description:"Help us" points:1 duration:1

# Excessive reward, unrealistic duration
/naffles-create-task type:twitter_follow title:"Follow" description:"Follow us" points:10000 duration:8760
```

#### Strategic Allowlist Management

**Best Practices**:
- Connect allowlists at optimal times for your community
- Ensure clear entry requirements
- Provide adequate time for entries
- Communicate drawing dates clearly
- Follow up with winners promptly

**Timing Considerations**:
- **Peak Activity Hours**: Connect during high community activity
- **Advance Notice**: Give users time to complete requirements
- **Duration Planning**: Allow sufficient time for organic growth
- **Follow-up**: Plan post-drawing communication

### Community Engagement

#### Building Participation

**Effective Strategies**:
1. **Progressive Rewards**: Start with smaller tasks, build to larger ones
2. **Clear Communication**: Always explain task value and purpose
3. **Regular Updates**: Keep community informed of progress
4. **Recognition**: Celebrate active participants
5. **Feedback Loop**: Ask for community input on tasks

#### Maintaining Quality

**Content Guidelines**:
- Keep task descriptions clear and concise
- Ensure rewards match effort required
- Verify all links and requirements work
- Test tasks before publishing
- Monitor completion rates and adjust

### Security Considerations

#### Permission Management

**Recommended Setup**:
1. **Minimal Permissions**: Grant only necessary permissions
2. **Role-Based Access**: Use Discord roles for permission management
3. **Regular Audits**: Review permissions periodically
4. **Principle of Least Privilege**: Start restrictive, expand as needed

#### Data Protection

**Privacy Best Practices**:
- Only collect necessary user information
- Respect user privacy preferences
- Secure API keys and tokens
- Regular security updates
- Monitor for suspicious activity

### Performance Optimization

#### Efficient Usage

**Optimization Tips**:
- Use status commands to monitor system health
- Avoid rapid-fire command execution
- Plan task creation during off-peak hours
- Monitor community size and adjust accordingly
- Use analytics to optimize engagement

#### Resource Management

**Best Practices**:
- Regular cleanup of expired tasks
- Monitor bot memory and CPU usage
- Optimize database queries
- Use caching effectively
- Plan for growth and scaling

---

**Need more help with commands?** Check out our [troubleshooting guide](troubleshooting.md) or contact [support@naffles.com](mailto:support@naffles.com)