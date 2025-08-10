const mongoose = require('mongoose');

const interactionLogSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        index: true
    },
    result: {
        type: String,
        enum: ['success', 'error', 'warning'],
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    commandName: {
        type: String,
        default: null,
        index: true
    },
    customId: {
        type: String,
        default: null
    },
    metadata: {
        taskId: String,
        allowlistId: String,
        points: Number,
        duration: Number,
        errorMessage: String,
        responseTime: Number,
        userAgent: String,
        ipAddress: String
    },
    context: {
        channelId: String,
        messageId: String,
        interactionType: String,
        locale: String,
        guildLocale: String
    }
}, {
    timestamps: true
});

// Indexes
interactionLogSchema.index({ guildId: 1, timestamp: -1 });
interactionLogSchema.index({ userId: 1, timestamp: -1 });
interactionLogSchema.index({ action: 1, result: 1 });
interactionLogSchema.index({ commandName: 1, timestamp: -1 });
interactionLogSchema.index({ timestamp: -1 }); // For cleanup

// TTL index - automatically delete logs older than 90 days
interactionLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static methods
interactionLogSchema.statics.logInteraction = function(data) {
    return this.create(data);
};

interactionLogSchema.statics.getGuildStats = function(guildId, days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        { 
            $match: { 
                guildId, 
                timestamp: { $gte: cutoffDate } 
            } 
        },
        {
            $group: {
                _id: {
                    action: '$action',
                    result: '$result'
                },
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$metadata.responseTime' }
            }
        },
        {
            $group: {
                _id: '$_id.action',
                results: {
                    $push: {
                        result: '$_id.result',
                        count: '$count',
                        avgResponseTime: '$avgResponseTime'
                    }
                },
                totalCount: { $sum: '$count' }
            }
        }
    ]);
};

interactionLogSchema.statics.getUserStats = function(userId, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        { 
            $match: { 
                userId, 
                timestamp: { $gte: cutoffDate } 
            } 
        },
        {
            $group: {
                _id: '$action',
                count: { $sum: 1 },
                successCount: {
                    $sum: { $cond: [{ $eq: ['$result', 'success'] }, 1, 0] }
                },
                errorCount: {
                    $sum: { $cond: [{ $eq: ['$result', 'error'] }, 1, 0] }
                },
                lastActivity: { $max: '$timestamp' }
            }
        }
    ]);
};

interactionLogSchema.statics.getCommandStats = function(commandName, days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        { 
            $match: { 
                commandName, 
                timestamp: { $gte: cutoffDate } 
            } 
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    result: '$result'
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.date',
                results: {
                    $push: {
                        result: '$_id.result',
                        count: '$count'
                    }
                },
                totalCount: { $sum: '$count' }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};

interactionLogSchema.statics.getErrorLogs = function(guildId, limit = 50) {
    const query = { result: 'error' };
    if (guildId) {
        query.guildId = guildId;
    }
    
    return this.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .select('guildId userId username action timestamp metadata.errorMessage commandName');
};

interactionLogSchema.statics.getActivitySummary = function(days = 1) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        { 
            $match: { 
                timestamp: { $gte: cutoffDate } 
            } 
        },
        {
            $group: {
                _id: null,
                totalInteractions: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                uniqueGuilds: { $addToSet: '$guildId' },
                successCount: {
                    $sum: { $cond: [{ $eq: ['$result', 'success'] }, 1, 0] }
                },
                errorCount: {
                    $sum: { $cond: [{ $eq: ['$result', 'error'] }, 1, 0] }
                },
                commandCounts: {
                    $push: '$commandName'
                }
            }
        },
        {
            $project: {
                totalInteractions: 1,
                uniqueUserCount: { $size: '$uniqueUsers' },
                uniqueGuildCount: { $size: '$uniqueGuilds' },
                successCount: 1,
                errorCount: 1,
                successRate: { 
                    $multiply: [
                        { $divide: ['$successCount', '$totalInteractions'] }, 
                        100
                    ] 
                }
            }
        }
    ]);
};

module.exports = mongoose.model('InteractionLog', interactionLogSchema);