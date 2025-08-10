# Naffles Discord Bot Documentation

Welcome to the comprehensive documentation for the Naffles Discord bot. This documentation provides everything you need to set up, use, manage, and develop with the Naffles Discord bot.

## 📚 Documentation Overview

### 🚀 Getting Started

**New to the Naffles Discord bot?** Start here for a quick introduction and setup.

- **[Setup Guide](setup-guide.md)** - Complete installation and configuration instructions
- **[Quick Start Tutorial](#quick-start-tutorial)** - Get up and running in 10 minutes
- **[FAQ](#frequently-asked-questions)** - Common questions and answers

### 👥 User Documentation

**For Discord server administrators and community managers:**

- **[Commands Reference](commands.md)** - Detailed documentation of all bot commands
- **[Community Linking Guide](#community-linking)** - How to connect your Discord server to Naffles
- **[Social Tasks Guide](#social-tasks)** - Creating and managing social tasks
- **[Allowlist Management](#allowlist-management)** - Connecting and managing allowlists
- **[Troubleshooting Guide](troubleshooting.md)** - Solutions to common issues and problems

### 🔧 Administrator Documentation

**For system administrators and advanced users:**

- **[Admin Guide](admin-guide.md)** - Comprehensive administrator management guide
- **[Security Guide](security.md)** - Security best practices and implementation details
- **[Performance Monitoring](#performance-monitoring)** - System monitoring and optimization
- **[User Management](#user-management)** - Managing users and permissions
- **[Analytics & Reporting](#analytics-reporting)** - Community insights and reporting

### 👨‍💻 Developer Documentation

**For developers working on or extending the bot:**

- **[Developer Guide](developer-guide.md)** - Development setup, architecture, and contribution guidelines
- **[API Integration](api-integration.md)** - Detailed API integration documentation
- **[Architecture Overview](#architecture-overview)** - System design and component relationships
- **[Contributing Guidelines](#contributing)** - How to contribute to the project

## 🎯 Quick Start Tutorial

### Step 1: Prerequisites

Before you begin, ensure you have:
- A Discord server with Administrator permissions
- A Naffles community (create at [naffles.com](https://naffles.com))
- Basic understanding of Discord server management

### Step 2: Bot Installation

**Option A: Use Hosted Service (Recommended)**
1. Visit [Naffles Discord Integration](https://naffles.com/discord-setup)
2. Select your community and Discord server
3. Complete the authorization process

**Option B: Self-Host**
1. Follow the [Setup Guide](setup-guide.md) for detailed instructions
2. Configure your environment variables
3. Deploy the bot to your preferred hosting platform

### Step 3: Link Your Community

1. In your Discord server, run:
   ```
   /naffles-link-community community_id:your_community_id
   ```
2. Complete OAuth authentication if prompted
3. Verify connection with `/naffles-status`

### Step 4: Create Your First Task

1. Create a social task:
   ```
   /naffles-create-task type:twitter_follow title:"Follow Our Twitter" description:"Follow @yourcommunity for updates" points:50
   ```
2. Fill out the modal with your Twitter username
3. The task will be posted to your Discord channel automatically

### Step 5: Explore Features

- Use `/naffles-list-tasks` to see all active tasks
- Try `/naffles-help` for interactive help
- Connect an allowlist with `/naffles-connect-allowlist`

## 🔗 Community Linking

### Understanding Community Linking

Community linking connects your Discord server to your Naffles community, enabling:
- Social task creation and management
- Allowlist integration and management
- User account synchronization
- Analytics and reporting
- Points system integration

### Linking Process

1. **Get Your Community ID**:
   - Log in to your Naffles community dashboard
   - Navigate to Settings → General
   - Copy your Community ID (format: `comm_1234567890abcdef`)

2. **Link Your Server**:
   ```
   /naffles-link-community community_id:comm_1234567890abcdef
   ```

3. **Complete Authentication** (if required):
   - Click the provided OAuth link
   - Authorize the Discord integration
   - Return to Discord to verify connection

4. **Verify Connection**:
   ```
   /naffles-status
   ```

### Troubleshooting Linking Issues

**Common Issues**:
- **Community not found**: Double-check your Community ID
- **Permission denied**: Ensure you own the Naffles community
- **Already linked**: Each community can only link to one Discord server

For detailed troubleshooting, see the [Troubleshooting Guide](troubleshooting.md).

## 🎯 Social Tasks

### Task Types

**Twitter Follow Tasks**:
- Users follow a specified Twitter account
- Automatic verification through Twitter API
- Customizable point rewards

**Discord Join Tasks**:
- Users join a specified Discord server
- Invite link validation and tracking
- Member verification and rewards

**Telegram Join Tasks**:
- Users join Telegram groups or channels
- Link validation and member tracking
- Automated reward distribution

**Custom Tasks**:
- Flexible task creation for any activity
- Manual or automated verification
- Custom instructions and requirements

### Creating Effective Tasks

**Best Practices**:
- Use clear, actionable titles
- Provide detailed descriptions
- Set appropriate point rewards
- Choose reasonable durations
- Test tasks before publishing

**Example Task Creation**:
```
/naffles-create-task 
  type:twitter_follow 
  title:"Follow for Alpha Updates" 
  description:"Follow @yourcommunity for exclusive alpha updates and announcements" 
  points:100 
  duration:168
```

### Task Management

- **View Tasks**: `/naffles-list-tasks` shows all community tasks
- **Filter Tasks**: Use status filters (active, completed, expired)
- **Task Analytics**: View completion rates and engagement metrics
- **Task Moderation**: Remove or modify inappropriate tasks

## 🎫 Allowlist Management

### Allowlist Integration

The bot seamlessly integrates with Naffles allowlists, providing:
- Direct Discord posting of allowlist campaigns
- Interactive entry buttons and real-time updates
- Requirement verification and validation
- Winner selection and notification

### Connecting Allowlists

1. **Create Allowlist** on Naffles platform
2. **Get Allowlist ID** from your community dashboard
3. **Connect to Discord**:
   ```
   /naffles-connect-allowlist allowlist_id:allow_1234567890abcdef
   ```
4. **Allowlist Posted** automatically with entry button

### Allowlist Features

**Interactive Elements**:
- Entry buttons with requirement checking
- Real-time entry count updates
- Odds calculation and display
- Winner announcement integration

**Entry Requirements**:
- Social media follows (Twitter, Discord, Telegram)
- NFT ownership verification
- Community membership requirements
- Custom requirement validation

## 📊 Performance Monitoring

### System Health Dashboard

Access the monitoring dashboard at `http://localhost:3001` (or configured port):

**Key Metrics**:
- Discord API connection status and latency
- Database performance and query times
- Cache hit rates and response times
- API call success rates and error tracking
- Memory usage and system resources

**Real-time Monitoring**:
- Live system status indicators
- Performance graphs and trends
- Error logs and debugging information
- User interaction analytics

### Health Check Endpoints

```bash
# Basic health check
curl http://localhost:3001/health

# Detailed system metrics
curl http://localhost:3001/metrics

# Service status overview
curl http://localhost:3001/status
```

### Performance Optimization

**Caching Strategy**:
- Redis-based response caching
- Database query result caching
- API response caching with TTL
- Session and user data caching

**Database Optimization**:
- Indexed queries for fast lookups
- Connection pooling for efficiency
- Query optimization and monitoring
- Data archiving and cleanup

## 👥 User Management

### User Roles and Permissions

**Permission Hierarchy**:
1. **System Administrator**: Full platform access
2. **Community Administrator**: Community-specific management
3. **Server Administrator**: Discord server configuration
4. **Moderator**: Content moderation capabilities
5. **Member**: Basic user access

### User Administration

**User Overview**:
- Discord account information and linking status
- Community memberships and roles
- Activity history and engagement metrics
- Moderation history and restrictions

**Moderation Tools**:
- Warning system with escalation
- Temporary and permanent restrictions
- Content removal and editing
- Ban management with appeal process

### Permission Management

**Custom Roles**:
- Create roles with specific permissions
- Assign roles to users or groups
- Time-based role assignments
- Conditional role requirements

**Access Control**:
- Command-specific permissions
- Channel-based restrictions
- Role-based feature access
- User-level overrides

## 📈 Analytics & Reporting

### Community Analytics

**Member Analytics**:
- Total member count and growth trends
- Active member identification
- New member acquisition rates
- Member retention analysis

**Content Performance**:
- Task creation and completion rates
- Allowlist participation metrics
- Content engagement analysis
- Popular content identification

**Engagement Metrics**:
- Daily and monthly active users
- Session duration and frequency
- Feature utilization rates
- Community interaction patterns

### Custom Reporting

**Report Builder**:
- Drag-and-drop report creation
- Custom metric selection
- Flexible filtering options
- Multiple visualization types

**Scheduled Reports**:
- Automated report generation
- Email delivery to stakeholders
- Custom recipient lists
- Historical report archiving

**Export Options**:
- PDF, CSV, and JSON formats
- API access for data integration
- Real-time data streaming
- Bulk data export capabilities

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Discord Bot Application                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Commands   │  │  Handlers   │  │  Services   │         │
│  │             │  │             │  │             │         │
│  │ • Slash     │  │ • Command   │  │ • Discord   │         │
│  │   Commands  │  │   Handler   │  │   API       │         │
│  │ • Button    │  │ • Event     │  │ • Naffles   │         │
│  │   Handlers  │  │   Handler   │  │   API       │         │
│  │ • Modal     │  │ • Error     │  │ • Database  │         │
│  │   Handlers  │  │   Handler   │  │ • Cache     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Models    │  │ Middleware  │  │  Utilities  │         │
│  │             │  │             │  │             │         │
│  │ • Data      │  │ • Auth      │  │ • Logger    │         │
│  │   Models    │  │ • Rate      │  │ • Config    │         │
│  │ • Schema    │  │   Limiting  │  │ • Error     │         │
│  │   Validation│  │ • Security  │  │   Handling  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

**Command System**:
- Slash command registration and handling
- Interactive component processing
- Permission validation and enforcement
- Error handling and user feedback

**Service Layer**:
- Business logic implementation
- External API integration
- Data processing and validation
- Caching and performance optimization

**Data Layer**:
- MongoDB for persistent data storage
- Redis for caching and session management
- Data models and schema validation
- Migration and backup systems

## 🤝 Contributing

### How to Contribute

We welcome contributions from the community! Here's how you can help:

**Types of Contributions**:
- 🐛 Bug reports and fixes
- ✨ New features and enhancements
- 📚 Documentation improvements
- 🧪 Test coverage expansion
- 🎨 UI/UX improvements

### Contribution Process

1. **Fork the Repository**:
   ```bash
   git clone https://github.com/your-username/naffles-discord-bot.git
   ```

2. **Create Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**:
   - Follow existing code patterns
   - Add comprehensive tests
   - Update documentation
   - Ensure code quality standards

4. **Submit Pull Request**:
   - Provide detailed description
   - Include test results
   - Reference related issues
   - Request code review

### Development Standards

**Code Quality**:
- Follow ESLint and Prettier configurations
- Write comprehensive unit and integration tests
- Document all public APIs and complex logic
- Follow semantic versioning for releases

**Testing Requirements**:
- Unit tests for all new functionality
- Integration tests for API endpoints
- End-to-end tests for user workflows
- Performance tests for critical paths

## 🆘 Frequently Asked Questions

### General Questions

**Q: What is the Naffles Discord bot?**
A: The Naffles Discord bot is a comprehensive tool that integrates Discord servers with the Naffles platform, enabling community managers to create social tasks, manage allowlists, and engage their communities directly through Discord.

**Q: Is the bot free to use?**
A: The bot is free for basic usage. Advanced features and higher usage limits may require a Naffles subscription. Check [naffles.com/pricing](https://naffles.com/pricing) for details.

**Q: Can I self-host the bot?**
A: Yes! The bot is open-source and can be self-hosted. See the [Setup Guide](setup-guide.md) for detailed instructions.

### Technical Questions

**Q: What permissions does the bot need?**
A: The bot requires Send Messages, Use Slash Commands, Embed Links, Read Message History, Add Reactions, and Manage Messages permissions.

**Q: How do I update the bot?**
A: For hosted service, updates are automatic. For self-hosted instances, pull the latest code and restart the service.

**Q: Can I customize the bot's appearance?**
A: Yes, community administrators can customize embed colors, branding, and some visual elements through the admin interface.

### Troubleshooting Questions

**Q: The bot isn't responding to commands. What should I do?**
A: Check the [Troubleshooting Guide](troubleshooting.md) for step-by-step solutions to common issues.

**Q: How do I report a bug or request a feature?**
A: Use our [GitHub Issues](https://github.com/naffles/discord-bot/issues) page or contact support at [support@naffles.com](mailto:support@naffles.com).

**Q: Where can I get help if I'm stuck?**
A: Join our [Discord community](https://discord.gg/naffles) for community support, or check our comprehensive documentation.

## 📞 Support & Resources

### Getting Help

1. **📖 Documentation**: Start with our comprehensive guides
2. **🔍 Search**: Look for existing solutions in GitHub issues
3. **💬 Community**: Join our Discord for community support
4. **📧 Support**: Contact our team for technical assistance

### Useful Links

- **🌐 [Naffles Platform](https://naffles.com)** - Main platform and community creation
- **💬 [Discord Community](https://discord.gg/naffles)** - Community support and discussions
- **🐛 [GitHub Issues](https://github.com/naffles/discord-bot/issues)** - Bug reports and feature requests
- **📧 [Email Support](mailto:support@naffles.com)** - Direct technical support
- **🐦 [Twitter](https://twitter.com/naffles)** - Updates and announcements

### Documentation Feedback

Help us improve this documentation:
- **Found an error?** [Report it here](https://github.com/naffles/discord-bot/issues)
- **Missing information?** [Request additions](https://github.com/naffles/discord-bot/issues)
- **Have suggestions?** [Share your ideas](https://discord.gg/naffles)

---

<div align="center">

**📚 Comprehensive Documentation for the Naffles Discord Bot**

[🏠 Home](../README.md) • [🚀 Setup](setup-guide.md) • [📖 Commands](commands.md) • [🔧 Admin](admin-guide.md) • [👨‍💻 Developer](developer-guide.md)

**Built with ❤️ by the [Naffles Team](https://naffles.com)**

</div>