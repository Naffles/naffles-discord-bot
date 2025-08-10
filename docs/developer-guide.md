# Discord Bot Developer Guide

This guide provides comprehensive information for developers working on or extending the Naffles Discord bot, including architecture, development setup, API documentation, and contribution guidelines.

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Architecture Overview](#architecture-overview)
3. [Code Structure and Organization](#code-structure-and-organization)
4. [API Development](#api-development)
5. [Command Development](#command-development)
6. [Service Integration](#service-integration)
7. [Testing and Quality Assurance](#testing-and-quality-assurance)
8. [Deployment and CI/CD](#deployment-and-cicd)
9. [Performance Optimization](#performance-optimization)
10. [Contributing Guidelines](#contributing-guidelines)

## Development Environment Setup

### Prerequisites

Before starting development, ensure you have the following installed:

**Required Software**:
- Node.js 18.x or higher
- npm 8.x or higher
- Git 2.30 or higher
- MongoDB 5.0 or higher
- Redis 6.0 or higher

**Development Tools**:
- Visual Studio Code (recommended)
- Discord Developer Account
- Naffles Developer Account
- Postman or similar API testing tool

### Local Development Setup

**1. Clone the Repository**:
```bash
git clone https://github.com/naffles/discord-bot.git
cd naffles-discord-bot
```

**2. Install Dependencies**:
```bash
npm install
```

**3. Environment Configuration**:
```bash
cp .env.example .env.development
# Edit .env.development with your configuration
```

**4. Database Setup**:
```bash
# Start MongoDB
mongod --dbpath ./data/db

# Start Redis
redis-server

# Run database migrations
npm run migrate
```

**5. Start Development Server**:
```bash
npm run dev
```

### Development Environment Variables

```env
# Discord Configuration
DISCORD_BOT_TOKEN=your_development_bot_token
DISCORD_CLIENT_ID=your_development_client_id
DISCORD_CLIENT_SECRET=your_development_client_secret

# Naffles API Configuration
NAFFLES_API_BASE_URL=https://api-dev.naffles.com
NAFFLES_API_KEY=your_development_api_key

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/naffles-discord-bot-dev
REDIS_URL=redis://localhost:6379/0

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
DEBUG_MODE=true
```

## Architecture Overview

### System Architecture

The Naffles Discord bot follows a modular, service-oriented architecture designed for scalability, maintainability, and testability.

```
┌─────────────────────────────────────────────────────────────┐
│                    Discord Bot Application                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Commands   │  │  Handlers   │  │  Services   │         │
│  │             │  │             │  │             │         │
│  │ • create-   │  │ • Command   │  │ • Discord   │         │
│  │   task      │  │   Handler   │  │   Bot       │         │
│  │ • list-     │  │ • Button    │  │ • Naffles   │         │
│  │   tasks     │  │   Handler   │  │   API       │         │
│  │ • connect-  │  │ • Modal     │  │ • Database  │         │
│  │   allowlist │  │   Handler   │  │ • Cache     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Models    │  │ Middleware  │  │  Utilities  │         │
│  │             │  │             │  │             │         │
│  │ • User      │  │ • Auth      │  │ • Logger    │         │
│  │ • Task      │  │ • Rate      │  │ • Error     │         │
│  │ • Allowlist │  │   Limit     │  │   Handler   │         │
│  │ • Community │  │ • Validate  │  │ • Config    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    External Integrations                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Discord API │  │ Naffles API │  │  Database   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Core Design Principles

**1. Separation of Concerns**:
- Commands handle user interactions
- Services manage business logic
- Models define data structures
- Handlers process events

**2. Dependency Injection**:
- Services are injected into commands
- Easy testing and mocking
- Loose coupling between components

**3. Event-Driven Architecture**:
- Asynchronous event processing
- Scalable message handling
- Real-time updates and notifications

**4. Error Handling**:
- Comprehensive error catching
- Graceful degradation
- User-friendly error messages

## Code Structure and Organization

### Directory Structure

```
src/
├── commands/           # Slash command implementations
│   ├── createTask.js
│   ├── listTasks.js
│   ├── connectAllowlist.js
│   └── help.js
├── handlers/           # Event and interaction handlers
│   ├── commandHandler.js
│   ├── buttonHandler.js
│   └── eventHandler.js
├── services/           # Business logic services
│   ├── discordBotService.js
│   ├── nafflesApiService.js
│   ├── databaseService.js
│   └── cacheService.js
├── models/             # Data models and schemas
│   ├── user.js
│   ├── task.js
│   ├── allowlist.js
│   └── community.js
├── middleware/         # Request processing middleware
│   ├── authentication.js
│   ├── rateLimiting.js
│   └── validation.js
├── utils/              # Utility functions
│   ├── logger.js
│   ├── errorHandler.js
│   └── config.js
├── config/             # Configuration files
│   ├── database.js
│   ├── discord.js
│   └── naffles.js
└── index.js           # Application entry point
```

### Coding Standards

**JavaScript/Node.js Standards**:
- ES6+ syntax and features
- Async/await for asynchronous operations
- Consistent naming conventions (camelCase)
- Comprehensive error handling
- JSDoc comments for documentation

**Code Organization**:
- Single responsibility principle
- Modular design with clear interfaces
- Consistent file and folder naming
- Logical grouping of related functionality

**Error Handling Patterns**:
```javascript
// Consistent error handling pattern
async function exampleFunction() {
  try {
    const result = await someAsyncOperation();
    return result;
  } catch (error) {
    logger.error('Operation failed', {
      operation: 'exampleFunction',
      error: error.message,
      stack: error.stack
    });
    throw new CustomError('Operation failed', error);
  }
}
```

## API Development

### Naffles API Integration

**API Client Structure**:
```javascript
class NafflesApiClient {
  constructor(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.client = this.createHttpClient();
  }
  
  createHttpClient() {
    return axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  async makeRequest(method, endpoint, data = null) {
    try {
      const response = await this.client.request({
        method,
        url: endpoint,
        data
      });
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }
}
```

**API Service Implementation**:
```javascript
class CommunityApiService extends NafflesApiClient {
  async getCommunity(communityId) {
    return await this.makeRequest('GET', `/api/communities/${communityId}`);
  }
  
  async createSocialTask(communityId, taskData) {
    return await this.makeRequest('POST', `/api/communities/${communityId}/social-tasks`, taskData);
  }
  
  async connectAllowlist(allowlistId, connectionData) {
    return await this.makeRequest('POST', `/api/allowlists/${allowlistId}/connect`, connectionData);
  }
}
```

### Discord API Integration

**Discord Client Setup**:
```javascript
const { Client, GatewayIntentBits } = require('discord.js');

class DiscordBotClient {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
      ]
    });
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.client.on('ready', this.onReady.bind(this));
    this.client.on('interactionCreate', this.onInteraction.bind(this));
    this.client.on('error', this.onError.bind(this));
  }
  
  async onReady() {
    logger.info(`Bot logged in as ${this.client.user.tag}`);
    await this.registerCommands();
  }
  
  async onInteraction(interaction) {
    if (interaction.isChatInputCommand()) {
      await this.handleCommand(interaction);
    } else if (interaction.isButton()) {
      await this.handleButton(interaction);
    }
  }
}
```

## Command Development

### Command Structure

All commands follow a consistent structure for maintainability and testing:

```javascript
const { SlashCommandBuilder } = require('discord.js');

class ExampleCommand {
  constructor(botService) {
    this.botService = botService;
    this.name = 'example-command';
    this.data = new SlashCommandBuilder()
      .setName(this.name)
      .setDescription('Example command description')
      .addStringOption(option =>
        option.setName('parameter')
          .setDescription('Parameter description')
          .setRequired(true)
      );
  }
  
  async execute(interaction) {
    try {
      // Validate permissions
      const hasPermission = await this.validatePermissions(interaction);
      if (!hasPermission) {
        return await this.sendPermissionError(interaction);
      }
      
      // Process command logic
      const result = await this.processCommand(interaction);
      
      // Send response
      await this.sendResponse(interaction, result);
      
      // Log interaction
      await this.logInteraction(interaction, 'success');
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }
  
  async validatePermissions(interaction) {
    // Permission validation logic
    return true;
  }
  
  async processCommand(interaction) {
    // Command-specific logic
    return { success: true };
  }
  
  async sendResponse(interaction, result) {
    await interaction.reply({
      content: 'Command executed successfully!',
      ephemeral: true
    });
  }
  
  async handleError(interaction, error) {
    logger.error('Command execution failed', {
      command: this.name,
      error: error.message
    });
    
    await interaction.reply({
      content: 'An error occurred. Please try again.',
      ephemeral: true
    });
  }
}

module.exports = ExampleCommand;
```

### Command Registration

Commands are automatically registered using the command loader:

```javascript
class CommandLoader {
  constructor(client, botService) {
    this.client = client;
    this.botService = botService;
    this.commands = new Map();
  }
  
  async loadCommands() {
    const commandFiles = await this.getCommandFiles();
    
    for (const file of commandFiles) {
      const CommandClass = require(file);
      const command = new CommandClass(this.botService);
      
      this.commands.set(command.name, command);
    }
    
    await this.registerSlashCommands();
  }
  
  async registerSlashCommands() {
    const commandData = Array.from(this.commands.values())
      .map(command => command.data);
    
    await this.client.application.commands.set(commandData);
  }
}
```

## Service Integration

### Service Layer Architecture

Services encapsulate business logic and external integrations:

```javascript
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.initialized = false;
  }
  
  register(name, serviceClass, dependencies = []) {
    this.services.set(name, {
      class: serviceClass,
      dependencies,
      instance: null
    });
  }
  
  async initialize() {
    for (const [name, service] of this.services.entries()) {
      if (!service.instance) {
        const dependencies = await this.resolveDependencies(service.dependencies);
        service.instance = new service.class(...dependencies);
        
        if (service.instance.initialize) {
          await service.instance.initialize();
        }
      }
    }
    
    this.initialized = true;
  }
  
  get(name) {
    if (!this.initialized) {
      throw new Error('Service container not initialized');
    }
    
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }
    
    return service.instance;
  }
}
```

### Database Service

```javascript
class DatabaseService {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.connection = null;
  }
  
  async initialize() {
    this.connection = await mongoose.connect(this.connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    logger.info('Database connected successfully');
  }
  
  async findUser(discordId) {
    return await User.findOne({ discordId });
  }
  
  async createUser(userData) {
    const user = new User(userData);
    return await user.save();
  }
  
  async updateUser(discordId, updates) {
    return await User.findOneAndUpdate(
      { discordId },
      updates,
      { new: true }
    );
  }
}
```

### Cache Service

```javascript
class CacheService {
  constructor(redisUrl) {
    this.redisUrl = redisUrl;
    this.client = null;
  }
  
  async initialize() {
    this.client = redis.createClient({ url: this.redisUrl });
    await this.client.connect();
    
    logger.info('Cache service connected');
  }
  
  async get(key) {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }
  
  async set(key, value, ttl = 3600) {
    await this.client.setEx(key, ttl, JSON.stringify(value));
  }
  
  async delete(key) {
    await this.client.del(key);
  }
  
  async exists(key) {
    return await this.client.exists(key);
  }
}
```

## Testing and Quality Assurance

### Testing Strategy

The project uses a comprehensive testing approach:

**Unit Tests**:
- Individual function and method testing
- Mock external dependencies
- High code coverage requirements
- Fast execution for development feedback

**Integration Tests**:
- Service integration testing
- Database interaction testing
- API endpoint testing
- End-to-end workflow testing

**End-to-End Tests**:
- Complete user journey testing
- Discord interaction simulation
- Real API integration testing
- Performance and load testing

### Test Structure

```javascript
// Example unit test
describe('CommunityService', () => {
  let communityService;
  let mockApiClient;
  
  beforeEach(() => {
    mockApiClient = {
      getCommunity: jest.fn(),
      createTask: jest.fn()
    };
    
    communityService = new CommunityService(mockApiClient);
  });
  
  describe('getCommunity', () => {
    it('should return community data when API call succeeds', async () => {
      const mockCommunity = { id: 'comm_123', name: 'Test Community' };
      mockApiClient.getCommunity.mockResolvedValue(mockCommunity);
      
      const result = await communityService.getCommunity('comm_123');
      
      expect(result).toEqual(mockCommunity);
      expect(mockApiClient.getCommunity).toHaveBeenCalledWith('comm_123');
    });
    
    it('should throw error when API call fails', async () => {
      mockApiClient.getCommunity.mockRejectedValue(new Error('API Error'));
      
      await expect(communityService.getCommunity('comm_123'))
        .rejects.toThrow('API Error');
    });
  });
});
```

### Testing Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=communityService

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

### Quality Assurance Tools

**ESLint Configuration**:
```javascript
module.exports = {
  extends: ['eslint:recommended', 'node'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
```

**Prettier Configuration**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

## Deployment and CI/CD

### Deployment Pipeline

The deployment process uses automated CI/CD pipelines for consistent and reliable deployments:

**Pipeline Stages**:
1. **Code Quality**: Linting, formatting, security scanning
2. **Testing**: Unit, integration, and end-to-end tests
3. **Build**: Application bundling and optimization
4. **Deploy**: Environment-specific deployment
5. **Verification**: Post-deployment health checks

**GitHub Actions Workflow**:
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:coverage
      - run: npm run test:integration

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build
      - run: npm run deploy:production
```

### Environment Management

**Development Environment**:
- Local development setup
- Hot reloading and debugging
- Mock services and data
- Comprehensive logging

**Staging Environment**:
- Production-like configuration
- Integration testing
- Performance testing
- User acceptance testing

**Production Environment**:
- High availability setup
- Monitoring and alerting
- Backup and recovery
- Security hardening

## Performance Optimization

### Performance Monitoring

**Key Metrics**:
- Response time monitoring
- Memory usage tracking
- CPU utilization analysis
- Database query performance
- API call success rates

**Monitoring Tools**:
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }
  
  startTimer(operation) {
    const startTime = process.hrtime.bigint();
    return () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to ms
      this.recordMetric(operation, duration);
    };
  }
  
  recordMetric(operation, value) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    this.metrics.get(operation).push({
      value,
      timestamp: Date.now()
    });
  }
  
  getAverageResponseTime(operation) {
    const values = this.metrics.get(operation) || [];
    if (values.length === 0) return 0;
    
    const sum = values.reduce((acc, metric) => acc + metric.value, 0);
    return sum / values.length;
  }
}
```

### Optimization Strategies

**Caching**:
- Redis-based response caching
- In-memory caching for frequently accessed data
- Cache invalidation strategies
- Cache warming techniques

**Database Optimization**:
- Query optimization and indexing
- Connection pooling
- Read replicas for scaling
- Data archiving strategies

**API Optimization**:
- Request batching and deduplication
- Response compression
- Rate limiting and throttling
- Circuit breaker patterns

## Contributing Guidelines

### Development Workflow

**1. Fork and Clone**:
```bash
git clone https://github.com/your-username/naffles-discord-bot.git
cd naffles-discord-bot
git remote add upstream https://github.com/naffles/discord-bot.git
```

**2. Create Feature Branch**:
```bash
git checkout -b feature/your-feature-name
```

**3. Development Process**:
- Write code following established patterns
- Add comprehensive tests
- Update documentation
- Follow commit message conventions

**4. Submit Pull Request**:
- Ensure all tests pass
- Update CHANGELOG.md
- Provide detailed PR description
- Request code review

### Code Review Process

**Review Criteria**:
- Code quality and consistency
- Test coverage and quality
- Documentation completeness
- Performance considerations
- Security implications

**Review Checklist**:
- [ ] Code follows established patterns
- [ ] Tests are comprehensive and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance impact is acceptable
- [ ] Breaking changes are documented

### Commit Message Format

```
type(scope): brief description

Detailed description of changes made.

Fixes #issue-number
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks

### Documentation Standards

**Code Documentation**:
- JSDoc comments for all public methods
- Inline comments for complex logic
- README updates for new features
- API documentation updates

**Architecture Documentation**:
- Design decision documentation
- Integration guides
- Troubleshooting guides
- Performance optimization guides

---

**For questions about development or to contribute to the project, contact the development team at [dev@naffles.com](mailto:dev@naffles.com) or join our [Discord community](https://discord.gg/naffles-dev)**