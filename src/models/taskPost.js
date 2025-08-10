const mongoose = require('mongoose');

const taskPostSchema = new mongoose.Schema({
    taskId: {
        type: String,
        required: true,
        index: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    channelId: {
        type: String,
        required: true
    },
    messageId: {
        type: String,
        required: true,
        unique: true
    },
    createdBy: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    taskData: {
        title: String,
        description: String,
        type: String,
        points: Number,
        status: String,
        endTime: Date
    },
    interactions: {
        views: {
            type: Number,
            default: 0
        },
        completions: {
            type: Number,
            default: 0
        },
        lastInteraction: Date
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes
taskPostSchema.index({ taskId: 1, guildId: 1 });
taskPostSchema.index({ messageId: 1 });
taskPostSchema.index({ createdBy: 1 });
taskPostSchema.index({ isActive: 1 });
taskPostSchema.index({ 'taskData.status': 1 });

// Methods
taskPostSchema.methods.incrementViews = function() {
    this.interactions.views += 1;
    this.interactions.lastInteraction = new Date();
    return this.save();
};

taskPostSchema.methods.incrementCompletions = function() {
    this.interactions.completions += 1;
    this.interactions.lastInteraction = new Date();
    return this.save();
};

taskPostSchema.methods.updateTaskData = function(taskData) {
    this.taskData = { ...this.taskData, ...taskData };
    return this.save();
};

taskPostSchema.methods.deactivate = function() {
    this.isActive = false;
    return this.save();
};

// Static methods
taskPostSchema.statics.findByTask = function(taskId) {
    return this.find({ taskId, isActive: true });
};

taskPostSchema.statics.findByGuild = function(guildId) {
    return this.find({ guildId, isActive: true }).sort({ createdAt: -1 });
};

taskPostSchema.statics.findByMessage = function(messageId) {
    return this.findOne({ messageId, isActive: true });
};

taskPostSchema.statics.getActiveCount = function() {
    return this.countDocuments({ isActive: true });
};

taskPostSchema.statics.getCompletionStats = function(guildId) {
    return this.aggregate([
        { $match: { guildId, isActive: true } },
        {
            $group: {
                _id: null,
                totalTasks: { $sum: 1 },
                totalViews: { $sum: '$interactions.views' },
                totalCompletions: { $sum: '$interactions.completions' },
                avgViewsPerTask: { $avg: '$interactions.views' },
                avgCompletionsPerTask: { $avg: '$interactions.completions' }
            }
        }
    ]);
};

module.exports = mongoose.model('TaskPost', taskPostSchema);