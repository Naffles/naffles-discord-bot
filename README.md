# Naffles Discord Bot

A comprehensive Discord bot for managing Naffles communities, social tasks, and allowlist campaigns directly within Discord servers. This bot provides seamless integration between Discord and the Naffles platform, enabling community managers to create engaging experiences for their members.

## 🚀 Features

- **🎯 Social Task Management**: Create Twitter follows, Discord joins, Telegram joins, and custom tasks with point rewards
- **🎫 Allowlist Integration**: Connect and manage allowlist campaigns with interactive Discord posts
- **🔗 Community Linking**: One-to-one server-community mapping with secure OAuth authentication
- **⚡ Real-time Synchronization**: Bidirectional sync between Discord and Naffles backend
- **🛡️ Security First**: Comprehensive security monitoring, rate limiting, and abuse prevention
- **📊 Analytics & Insights**: Detailed community analytics and engagement metrics
- **🎨 Rich Interactions**: Interactive embeds, buttons, select menus, and modals
- **🔧 Admin Tools**: Advanced configuration, user management, and content moderation

## 📚 Documentation

### 📖 User Guides
- **[Setup Guide](docs/setup-guide.md)** - Complete installation and configuration instructions
- **[Commands Reference](docs/commands.md)** - Detailed documentation of all bot commands
- **[Troubleshooting Guide](docs/troubleshooting.md)** - Solutions to common issues and problems

### 🔧 Administrator Resources
- **[Admin Guide](docs/admin-guide.md)** - Comprehensive administrator management guide
- **[Security Guide](docs/security.md)** - Security best practices and implementation details

### 👨‍💻 Developer Resources
- **[Developer Guide](docs/developer-guide.md)** - Development setup, architecture, and contribution guidelines
- **[API Integration](docs/api-integration.md)** - Detailed API integration documentation

## ⚡ Quick Start

### Prerequisites

- **Node.js** 18.x or higher
- **MongoDB** 5.0 or higher
- **Redis** 6.0 or higher
- **Discord Developer Account** with bot application
- **Naffles Community** with API access

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/naffles/discord-bot.git
cd naffles-discord-bot
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration (see Configuration section)
```

4. **Start the bot**:
```bash
npm start
```

### Docker Quick Start

```bash
# Using Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t naffles-discord-bot .
docker run -d --env-file .env naffles-discord-bot
```

## ⚙️ Configuration

### Required Environment Variables

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

### Discord Application Setup

1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application and bot
3. Configure bot permissions:
   - ✅ Send Messages
   - ✅ Use Slash Commands
   - ✅ Embed Links
   - ✅ Read Message History
   - ✅ Add Reactions
   - ✅ Manage Messages

For detailed setup instructions, see the [Setup Guide](docs/setup-guide.md).

## 🎮 Commands Overview

### Core Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/naffles-create-task` | Create social tasks for your community | Manage Server |
| `/naffles-list-tasks` | View active community tasks | Everyone |
| `/naffles-connect-allowlist` | Connect allowlist campaigns to Discord | Manage Server |
| `/naffles-status` | Check bot and community connection status | Everyone |
| `/naffles-help` | Interactive help system with detailed guides | Everyone |

### Example Usage

```bash
# Create a Twitter follow task
/naffles-create-task type:twitter_follow title:"Follow Our Twitter" description:"Follow @naffles for updates" points:50 duration:168

# List active tasks
/naffles-list-tasks status:active

# Connect an allowlist
/naffles-connect-allowlist allowlist_id:allow_1234567890abcdef

# Check system status
/naffles-status
```

For complete command documentation, see the [Commands Reference](docs/commands.md).

## 🏗️ Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discord API   │◄──►│ Naffles Discord │◄──►│  Naffles API    │
│                 │    │      Bot        │    │                 │
│ • Gateway       │    │                 │    │ • Communities   │
│ • REST API      │    │ • Commands      │    │ • Social Tasks  │
│ • Webhooks      │    │ • Events        │    │ • Allowlists    │
│ • OAuth2        │    │ • Services      │    │ • Users         │
└─────────────────┘    │ • Security      │    └─────────────────┘
                       │ • Analytics     │
┌─────────────────┐    │                 │    ┌─────────────────┐
│   Database      │◄──►│                 │◄──►│  External APIs  │
│                 │    └─────────────────┘    │                 │
│ • MongoDB       │                           │ • Twitter API   │
│ • Redis Cache   │                           │ • Telegram API  │
│ • Session Store │                           │ • Social APIs   │
└─────────────────┘                           └─────────────────┘
```

### Core Components

- **Command System**: Slash command processing with validation and error handling
- **Event Handlers**: Discord event processing and real-time updates
- **Service Layer**: Business logic and external API integration
- **Security System**: Authentication, authorization, and abuse prevention
- **Analytics Engine**: Community insights and performance metrics
- **Cache Layer**: Redis-based caching for optimal performance

## 🛡️ Security Features

### Built-in Security

- **🔐 Authentication**: Secure Discord OAuth and API key management
- **🚦 Rate Limiting**: Multi-tier rate limiting to prevent abuse
- **🛡️ Input Validation**: Comprehensive input sanitization and validation
- **📝 Audit Logging**: Complete interaction and security event logging
- **🔍 Monitoring**: Real-time security monitoring and threat detection
- **🚨 Incident Response**: Automated response to security violations

### Security Best Practices

- All sensitive data encrypted at rest and in transit
- Principle of least privilege for all permissions
- Regular security audits and vulnerability assessments
- Comprehensive error handling without information disclosure
- Secure configuration management and secrets handling

For detailed security information, see the [Security Guide](docs/security.md).

## 📊 Monitoring & Analytics

### Health Monitoring

Access the monitoring dashboard at `http://localhost:3001`:

- **System Health**: Real-time status of all services
- **Performance Metrics**: Response times, throughput, and resource usage
- **Error Tracking**: Comprehensive error logging and analysis
- **User Analytics**: Community engagement and interaction metrics

### API Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Metrics endpoint
curl http://localhost:3001/metrics

# System status
curl http://localhost:3001/status
```

## 🧪 Development

### Development Setup

```bash
# Clone and setup
git clone https://github.com/naffles/discord-bot.git
cd naffles-discord-bot
npm install

# Setup development environment
cp .env.example .env.development
# Edit .env.development with development configuration

# Start development server with hot reload
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint and format code
npm run lint
npm run format
```

### Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Security tests
npm run test:security

# Performance tests
npm run test:performance
```

### Code Quality

- **ESLint**: Comprehensive linting rules
- **Prettier**: Consistent code formatting
- **Jest**: Unit and integration testing
- **Husky**: Pre-commit hooks for quality assurance
- **SonarQube**: Code quality and security analysis

For detailed development information, see the [Developer Guide](docs/developer-guide.md).

## 🚀 Deployment

### Production Deployment

```bash
# Using PM2 (recommended)
npm install -g pm2
pm2 start ecosystem.config.js

# Using Docker
docker-compose -f docker-compose.production.yml up -d

# Manual deployment
npm run build
npm run start:production
```

### Environment Management

- **Development**: Local development with hot reload and debugging
- **Staging**: Production-like environment for testing
- **Production**: High-availability deployment with monitoring

### CI/CD Pipeline

Automated deployment pipeline with:
- Code quality checks and security scanning
- Comprehensive test suite execution
- Automated deployment to staging and production
- Post-deployment health verification

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Standards

- Follow existing code patterns and conventions
- Write comprehensive tests for new features
- Update documentation for any changes
- Ensure all tests pass and code quality checks succeed

## 📞 Support

### Documentation & Resources

- **📖 [Complete Documentation](docs/)** - Comprehensive guides and references
- **🐛 [Issue Tracker](https://github.com/naffles/discord-bot/issues)** - Bug reports and feature requests
- **💬 [Discord Community](https://discord.gg/naffles)** - Community support and discussions
- **📧 [Email Support](mailto:support@naffles.com)** - Direct technical support

### Getting Help

1. **Check Documentation**: Most questions are answered in our comprehensive docs
2. **Search Issues**: Look for existing solutions in GitHub issues
3. **Join Discord**: Get help from the community and team
4. **Contact Support**: For urgent issues or enterprise support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎉 Acknowledgments

- **Discord.js** - Powerful Discord API library
- **Naffles Team** - Platform development and support
- **Community Contributors** - Bug reports, feature requests, and contributions
- **Open Source Community** - Libraries and tools that make this possible

---

<div align="center">

**Built with ❤️ by the [Naffles Team](https://naffles.com)**

[Website](https://naffles.com) • [Discord](https://discord.gg/naffles) • [Twitter](https://twitter.com/naffles) • [Documentation](docs/)

</div>