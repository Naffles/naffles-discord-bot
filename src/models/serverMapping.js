const mongoose = require('mongoose');

const serverMappingSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    communityId: {
        type: String,
        required: true,
        index: true
    },
    linkedBy: {
        type: String,
        required: true
    },
    linkedAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    settings: {
        autoPostTasks: {
            type: Boolean,
            default: true
        },
        autoPostAllowlists: {
            type: Boolean,
            default: true
        },
        defaultChannel: {
            type: String,
            default: null
        },
        allowedRoles: [{
            type: String
        }],
        permissions: {
            createTasks: {
                type: [String],
                default: ['ManageGuild']
            },
            connectAllowlists: {
                type: [String],
                default: ['ManageGuild']
            }
        }
    },
    metadata: {
        guildName: String,
        guildIcon: String,
        memberCount: Number,
        lastActivity: Date
    }
}, {
    timestamps: true
});

// Indexes
serverMappingSchema.index({ guildId: 1, communityId: 1 });
serverMappingSchema.index({ linkedBy: 1 });
serverMappingSchema.index({ isActive: 1 });

// Methods
serverMappingSchema.methods.updateActivity = function() {
    this.metadata.lastActivity = new Date();
    return this.save();
};

serverMappingSchema.methods.updateGuildInfo = function(guildInfo) {
    this.metadata.guildName = guildInfo.name;
    this.metadata.guildIcon = guildInfo.iconURL();
    this.metadata.memberCount = guildInfo.memberCount;
    return this.save();
};

// Static methods
serverMappingSchema.statics.findByGuild = function(guildId) {
    return this.findOne({ guildId, isActive: true });
};

serverMappingSchema.statics.findByCommunity = function(communityId) {
    return this.find({ communityId, isActive: true });
};

serverMappingSchema.statics.getActiveCount = function() {
    return this.countDocuments({ isActive: true });
};

module.exports = mongoose.model('ServerMapping', serverMappingSchema);