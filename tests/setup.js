// Jest setup file for Discord bot tests

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DISCORD_BOT_TOKEN = 'test-token';
process.env.DISCORD_CLIENT_ID = 'test-client-id';
process.env.NAFFLES_API_BASE_URL = 'https://api.test.com';
process.env.NAFFLES_API_KEY = 'test-api-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.LOG_LEVEL = 'error';

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock timers
jest.useFakeTimers();

// Global test utilities
global.createMockInteraction = (customId = 'test_action', userId = 'user123') => ({
  customId,
  user: { id: userId, tag: `TestUser#1234` },
  guildId: '123456789',
  channelId: 'channel123',
  reply: jest.fn().mockResolvedValue(),
  followUp: jest.fn().mockResolvedValue(),
  deferReply: jest.fn().mockResolvedValue(),
  editReply: jest.fn().mockResolvedValue()
});

global.createMockGuild = (id = '123456789', name = 'Test Guild') => ({
  id,
  name,
  memberCount: 100,
  joinedAt: new Date(),
  systemChannel: null,
  fetchOwner: jest.fn().mockResolvedValue({
    createDM: jest.fn().mockResolvedValue({
      send: jest.fn().mockResolvedValue()
    })
  })
});

global.createMockClient = () => ({
  isReady: jest.fn(() => true),
  guilds: {
    cache: new Map([
      ['123456789', createMockGuild()]
    ])
  },
  ws: { ping: 50 },
  uptime: 3600000,
  user: { tag: 'TestBot#1234' },
  login: jest.fn().mockResolvedValue(),
  destroy: jest.fn().mockResolvedValue()
});

// Test environment setup utilities
global.setupTestEnvironment = async () => {
  // Mock database connection
  const mockDb = {
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    isConnected: jest.fn().mockReturnValue(true)
  };

  // Mock Redis connection
  const mockRedis = {
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn()
  };

  return {
    db: mockDb,
    redis: mockRedis
  };
};

global.cleanupTestEnvironment = async (testEnv) => {
  // Cleanup test environment
  if (testEnv && testEnv.db && testEnv.db.disconnect) {
    await testEnv.db.disconnect();
  }
  if (testEnv && testEnv.redis && testEnv.redis.disconnect) {
    await testEnv.redis.disconnect();
  }
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});