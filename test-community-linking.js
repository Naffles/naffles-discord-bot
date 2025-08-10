const CommunityLinkingService = require('./src/services/communityLinkingService');

// Mock bot service for testing
const mockBotService = {
    db: {
        ServerMapping: {
            findOne: async (query) => {
                console.log('Mock DB query:', query);
                return null; // No existing mapping
            }
        },
        createServerCommunityMapping: async (data) => {
            console.log('Mock creating mapping:', data);
            return { _id: 'mock-id', ...data };
        }
    },
    redis: {
        setex: async (key, ttl, value) => {
            console.log('Mock Redis set:', { key, ttl, value });
        },
        get: async (key) => {
            console.log('Mock Redis get:', key);
            return null;
        }
    }
};

async function testCommunityLinking() {
    console.log('🧪 Testing Community Linking Service...\n');

    const service = new CommunityLinkingService(mockBotService);

    try {
        // Test OAuth URL generation
        console.log('1. Testing OAuth URL generation...');
        const oauthUrl = service.generateOAuthUrl('guild123', 'user456', 'community789');
        console.log('✅ OAuth URL generated:', oauthUrl.substring(0, 100) + '...\n');

        // Test state verification
        console.log('2. Testing OAuth state generation and verification...');
        const state = service.generateSecureState('guild123', 'user456', 'community789');
        console.log('✅ State generated:', state.substring(0, 50) + '...');
        
        const decodedState = service.verifyOAuthState(state);
        console.log('✅ State verified:', decodedState);
        console.log('');

        // Test server link status check
        console.log('3. Testing server link status check...');
        const serverStatus = await service.checkServerLinkStatus('guild123');
        console.log('✅ Server status:', serverStatus);
        console.log('');

        // Test community link status check
        console.log('4. Testing community link status check...');
        const communityStatus = await service.checkCommunityLinkStatus('community789');
        console.log('✅ Community status:', communityStatus);
        console.log('');

        // Test health check
        console.log('5. Testing health check...');
        const health = await service.healthCheck();
        console.log('✅ Health check result:', health);
        console.log('');

        console.log('🎉 All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testCommunityLinking();
}

module.exports = { testCommunityLinking };