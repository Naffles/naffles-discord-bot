const logger = require('../utils/logger');

/**
 * Task Eligibility Service
 * Handles comprehensive requirement validation for social tasks
 * Provides detailed eligibility checking and requirement guidance
 */
class TaskEligibilityService {
    constructor(botService) {
        this.botService = botService;
        
        // Eligibility cache to reduce API calls
        this.eligibilityCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        
        // Requirement validators
        this.validators = {
            'minimum_level': this.validateMinimumLevel.bind(this),
            'required_tasks': this.validateRequiredTasks.bind(this),
            'cooldown_period': this.validateCooldownPeriod.bind(this),
            'max_completions': this.validateMaxCompletions.bind(this),
            'account_age': this.validateAccountAge.bind(this),
            'community_membership': this.validateCommunityMembership.bind(this),
            'discord_role': this.validateDiscordRole.bind(this),
            'nft_ownership': this.validateNFTOwnership.bind(this),
            'token_balance': this.validateTokenBalance.bind(this)
        };
    }

    /**
     * Check comprehensive task eligibility for user
     * @param {string} taskId - Task ID
     * @param {string} userId - User ID (Naffles)
     * @param {string} discordId - Discord user ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Eligibility result with detailed feedback
     */
    async checkTaskEligibility(taskId, userId, discordId, options = {}) {
        try {
            logger.debug('Checking task eligibility:', {
                taskId,
                userId,
                discordId
            });

            // Check cache first
            const cacheKey = `eligibility_${taskId}_${userId}`;
            const cached = this.eligibilityCache.get(cacheKey);
            
            if (cached && !options.forceRefresh && (Date.now() - cached.timestamp) < this.cacheExpiry) {
                return cached.data;
            }

            // Get task details
            const task = await this.getTaskDetails(taskId);
            if (!task) {
                return {
                    eligible: false,
                    reason: 'task_not_found',
                    message: 'Task not found or no longer available',
                    requirements: [],
                    canComplete: false
                };
            }

            // Get user data
            const userData = await this.getUserData(userId, discordId);
            if (!userData) {
                return {
                    eligible: false,
                    reason: 'user_not_found',
                    message: 'User data not found',
                    requirements: [],
                    canComplete: false
                };
            }

            // Perform comprehensive eligibility check
            const eligibilityResult = await this.performEligibilityCheck(task, userData, options);

            // Cache the result
            this.eligibilityCache.set(cacheKey, {
                data: eligibilityResult,
                timestamp: Date.now()
            });

            logger.debug('Task eligibility check completed:', {
                taskId,
                userId,
                eligible: eligibilityResult.eligible
            });

            return eligibilityResult;

        } catch (error) {
            logger.error('Error checking task eligibility:', error);
            return {
                eligible: false,
                reason: 'eligibility_check_failed',
                message: 'Unable to check eligibility at this time',
                requirements: [],
                canComplete: false
            };
        }
    }

    /**
     * Validate specific requirement for user
     * @param {string} requirementType - Type of requirement
     * @param {Object} requirementData - Requirement configuration
     * @param {Object} userData - User data
     * @param {Object} taskData - Task data
     * @returns {Promise<Object>} Validation result
     */
    async validateRequirement(requirementType, requirementData, userData, taskData) {
        try {
            const validator = this.validators[requirementType];
            if (!validator) {
                logger.warn('Unknown requirement type:', requirementType);
                return {
                    valid: false,
                    reason: 'unknown_requirement_type',
                    message: `Unknown requirement type: ${requirementType}`
                };
            }

            return await validator(requirementData, userData, taskData);

        } catch (error) {
            logger.error('Error validating requirement:', error);
            return {
                valid: false,
                reason: 'validation_error',
                message: 'Requirement validation failed'
            };
        }
    }

    /**
     * Get detailed requirement guidance for user
     * @param {string} taskId - Task ID
     * @param {string} userId - User ID
     * @param {string} discordId - Discord user ID
     * @returns {Promise<Object>} Requirement guidance
     */
    async getRequirementGuidance(taskId, userId, discordId) {
        try {
            const eligibility = await this.checkTaskEligibility(taskId, userId, discordId);
            
            if (eligibility.eligible) {
                return {
                    eligible: true,
                    message: 'You are eligible to complete this task!',
                    guidance: []
                };
            }

            // Generate specific guidance for failed requirements
            const guidance = await this.generateRequirementGuidance(eligibility.requirements);

            return {
                eligible: false,
                message: eligibility.message,
                reason: eligibility.reason,
                guidance
            };

        } catch (error) {
            logger.error('Error getting requirement guidance:', error);
            return {
                eligible: false,
                message: 'Unable to provide requirement guidance',
                guidance: []
            };
        }
    }

    /**
     * Check if user can retry task after failure
     * @param {string} taskId - Task ID
     * @param {string} userId - User ID
     * @param {Object} failureReason - Previous failure reason
     * @returns {Promise<Object>} Retry eligibility
     */
    async checkRetryEligibility(taskId, userId, failureReason) {
        try {
            logger.debug('Checking retry eligibility:', {
                taskId,
                userId,
                failureReason: failureReason.reason
            });

            // Get task configuration
            const task = await this.getTaskDetails(taskId);
            if (!task) {
                return {
                    canRetry: false,
                    reason: 'task_not_found',
                    message: 'Task not found'
                };
            }

            // Check retry limits
            const retryLimits = task.retryConfiguration || {
                maxRetries: 3,
                cooldownMinutes: 5
            };

            // Get user's retry history
            const retryHistory = await this.getUserRetryHistory(taskId, userId);
            
            if (retryHistory.length >= retryLimits.maxRetries) {
                return {
                    canRetry: false,
                    reason: 'max_retries_exceeded',
                    message: `Maximum retry attempts (${retryLimits.maxRetries}) exceeded`
                };
            }

            // Check cooldown period
            const lastRetry = retryHistory[retryHistory.length - 1];
            if (lastRetry) {
                const cooldownEnd = new Date(lastRetry.timestamp.getTime() + (retryLimits.cooldownMinutes * 60 * 1000));
                if (new Date() < cooldownEnd) {
                    const remainingMinutes = Math.ceil((cooldownEnd - new Date()) / (60 * 1000));
                    return {
                        canRetry: false,
                        reason: 'cooldown_active',
                        message: `Please wait ${remainingMinutes} minutes before retrying`,
                        cooldownEnd
                    };
                }
            }

            // Check if failure reason allows retry
            const retryableReasons = [
                'verification_failed',
                'network_error',
                'temporary_unavailable',
                'rate_limited'
            ];

            if (!retryableReasons.includes(failureReason.reason)) {
                return {
                    canRetry: false,
                    reason: 'non_retryable_failure',
                    message: 'This type of failure cannot be retried'
                };
            }

            return {
                canRetry: true,
                retriesRemaining: retryLimits.maxRetries - retryHistory.length,
                message: 'You can retry this task'
            };

        } catch (error) {
            logger.error('Error checking retry eligibility:', error);
            return {
                canRetry: false,
                reason: 'retry_check_failed',
                message: 'Unable to check retry eligibility'
            };
        }
    }

    /**
     * Get user's task completion history for eligibility checking
     * @param {string} userId - User ID
     * @param {string} communityId - Community ID
     * @returns {Promise<Array>} Task completion history
     */
    async getUserTaskHistory(userId, communityId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/user/${userId}/history?communityId=${communityId}`
            );
        } catch (error) {
            logger.error('Error getting user task history:', error);
            return [];
        }
    }

    /**
     * Validate task prerequisites
     * @param {Object} task - Task object
     * @param {Object} userData - User data
     * @returns {Promise<Object>} Prerequisites validation result
     */
    async validateTaskPrerequisites(task, userData) {
        try {
            const prerequisites = task.prerequisites || [];
            const validationResults = [];

            for (const prerequisite of prerequisites) {
                const result = await this.validateRequirement(
                    prerequisite.type,
                    prerequisite.configuration,
                    userData,
                    task
                );

                validationResults.push({
                    type: prerequisite.type,
                    required: prerequisite.required || false,
                    ...result
                });
            }

            // Check if all required prerequisites are met
            const failedRequired = validationResults.filter(r => r.required && !r.valid);
            
            return {
                valid: failedRequired.length === 0,
                results: validationResults,
                failedRequired,
                message: failedRequired.length > 0 
                    ? `Missing required prerequisites: ${failedRequired.map(r => r.type).join(', ')}`
                    : 'All prerequisites met'
            };

        } catch (error) {
            logger.error('Error validating task prerequisites:', error);
            return {
                valid: false,
                results: [],
                failedRequired: [],
                message: 'Prerequisites validation failed'
            };
        }
    }

    // Private helper methods

    /**
     * Perform comprehensive eligibility check
     * @private
     */
    async performEligibilityCheck(task, userData, options) {
        try {
            const checks = [];

            // Basic task status check
            if (task.status !== 'active') {
                return {
                    eligible: false,
                    reason: 'task_inactive',
                    message: 'This task is not currently active',
                    requirements: [],
                    canComplete: false
                };
            }

            // Task schedule check
            const scheduleCheck = this.checkTaskSchedule(task);
            if (!scheduleCheck.valid) {
                return {
                    eligible: false,
                    reason: scheduleCheck.reason,
                    message: scheduleCheck.message,
                    requirements: [],
                    canComplete: false
                };
            }

            // Previous completion check
            const completionCheck = await this.checkPreviousCompletion(task.id, userData.id);
            if (!completionCheck.valid) {
                return {
                    eligible: false,
                    reason: completionCheck.reason,
                    message: completionCheck.message,
                    requirements: [],
                    canComplete: false
                };
            }

            // Validate all requirements
            const requirements = task.requirements || {};
            const requirementChecks = await this.validateAllRequirements(requirements, userData, task);

            // Check prerequisites
            const prerequisiteCheck = await this.validateTaskPrerequisites(task, userData);

            // Combine all checks
            const allValid = requirementChecks.every(check => check.valid) && prerequisiteCheck.valid;

            return {
                eligible: allValid,
                reason: allValid ? 'eligible' : 'requirements_not_met',
                message: allValid 
                    ? 'You are eligible to complete this task'
                    : 'Some requirements are not met',
                requirements: requirementChecks,
                prerequisites: prerequisiteCheck.results,
                canComplete: allValid,
                guidance: allValid ? [] : await this.generateRequirementGuidance(requirementChecks)
            };

        } catch (error) {
            logger.error('Error performing eligibility check:', error);
            throw error;
        }
    }

    /**
     * Check task schedule validity
     * @private
     */
    checkTaskSchedule(task) {
        const now = new Date();
        
        if (task.schedule?.startDate && now < new Date(task.schedule.startDate)) {
            return {
                valid: false,
                reason: 'task_not_started',
                message: 'This task has not started yet'
            };
        }
        
        if (task.schedule?.endDate && now > new Date(task.schedule.endDate)) {
            return {
                valid: false,
                reason: 'task_expired',
                message: 'This task has expired'
            };
        }
        
        return { valid: true };
    }

    /**
     * Check if user has already completed the task
     * @private
     */
    async checkPreviousCompletion(taskId, userId) {
        try {
            const completion = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/completions/${userId}`
            ).catch(() => null);

            if (completion && (completion.status === 'completed' || completion.status === 'approved')) {
                return {
                    valid: false,
                    reason: 'already_completed',
                    message: 'You have already completed this task'
                };
            }

            return { valid: true };

        } catch (error) {
            logger.error('Error checking previous completion:', error);
            return { valid: true }; // Allow if check fails
        }
    }

    /**
     * Validate all requirements
     * @private
     */
    async validateAllRequirements(requirements, userData, task) {
        const checks = [];

        for (const [requirementType, requirementData] of Object.entries(requirements)) {
            if (requirementData === null || requirementData === undefined) continue;

            const check = await this.validateRequirement(requirementType, requirementData, userData, task);
            checks.push({
                type: requirementType,
                data: requirementData,
                ...check
            });
        }

        return checks;
    }

    /**
     * Generate requirement guidance
     * @private
     */
    async generateRequirementGuidance(requirements) {
        const guidance = [];

        for (const requirement of requirements) {
            if (requirement.valid) continue;

            const guidanceItem = this.getRequirementGuidance(requirement.type, requirement.data, requirement);
            if (guidanceItem) {
                guidance.push(guidanceItem);
            }
        }

        return guidance;
    }

    /**
     * Get specific requirement guidance
     * @private
     */
    getRequirementGuidance(requirementType, requirementData, validationResult) {
        const guidanceMap = {
            'minimum_level': {
                title: 'Level Requirement',
                message: `You need to reach level ${requirementData} to complete this task`,
                action: 'Complete more tasks to increase your level'
            },
            'required_tasks': {
                title: 'Required Tasks',
                message: 'You must complete certain tasks before this one',
                action: 'Complete the required prerequisite tasks first'
            },
            'cooldown_period': {
                title: 'Cooldown Period',
                message: 'You must wait before attempting this task again',
                action: `Wait ${requirementData} hours before retrying`
            },
            'account_age': {
                title: 'Account Age',
                message: `Your account must be at least ${requirementData} days old`,
                action: 'Wait for your account to meet the age requirement'
            },
            'community_membership': {
                title: 'Community Membership',
                message: 'You must be a member of the required community',
                action: 'Join the required community to complete this task'
            },
            'discord_role': {
                title: 'Discord Role',
                message: 'You need a specific Discord role',
                action: 'Contact server administrators to get the required role'
            },
            'nft_ownership': {
                title: 'NFT Ownership',
                message: 'You must own specific NFTs',
                action: 'Acquire the required NFTs to complete this task'
            },
            'token_balance': {
                title: 'Token Balance',
                message: 'You need sufficient token balance',
                action: 'Ensure you have the required token balance'
            }
        };

        const guidance = guidanceMap[requirementType];
        if (!guidance) return null;

        return {
            ...guidance,
            type: requirementType,
            severity: validationResult.severity || 'error'
        };
    }

    // Requirement validators

    /**
     * Validate minimum level requirement
     * @private
     */
    async validateMinimumLevel(requirementData, userData, taskData) {
        const userLevel = userData.level || 0;
        const requiredLevel = requirementData;

        return {
            valid: userLevel >= requiredLevel,
            reason: userLevel >= requiredLevel ? 'level_sufficient' : 'level_insufficient',
            message: userLevel >= requiredLevel 
                ? `Level requirement met (${userLevel}/${requiredLevel})`
                : `Level too low (${userLevel}/${requiredLevel})`,
            currentValue: userLevel,
            requiredValue: requiredLevel
        };
    }

    /**
     * Validate required tasks completion
     * @private
     */
    async validateRequiredTasks(requirementData, userData, taskData) {
        try {
            const requiredTaskIds = Array.isArray(requirementData) ? requirementData : [requirementData];
            const userHistory = await this.getUserTaskHistory(userData.id, taskData.communityId);
            
            const completedTaskIds = userHistory
                .filter(completion => completion.status === 'completed' || completion.status === 'approved')
                .map(completion => completion.taskId);

            const missingTasks = requiredTaskIds.filter(taskId => !completedTaskIds.includes(taskId));

            return {
                valid: missingTasks.length === 0,
                reason: missingTasks.length === 0 ? 'required_tasks_completed' : 'required_tasks_missing',
                message: missingTasks.length === 0 
                    ? 'All required tasks completed'
                    : `Missing ${missingTasks.length} required tasks`,
                missingTasks,
                completedTasks: completedTaskIds.filter(id => requiredTaskIds.includes(id))
            };

        } catch (error) {
            logger.error('Error validating required tasks:', error);
            return {
                valid: false,
                reason: 'validation_error',
                message: 'Could not validate required tasks'
            };
        }
    }

    /**
     * Validate cooldown period
     * @private
     */
    async validateCooldownPeriod(requirementData, userData, taskData) {
        try {
            const cooldownHours = requirementData;
            const lastCompletion = await this.getLastTaskCompletion(taskData.id, userData.id);
            
            if (!lastCompletion) {
                return {
                    valid: true,
                    reason: 'no_previous_completion',
                    message: 'No cooldown period applies'
                };
            }

            const cooldownEnd = new Date(lastCompletion.completedAt.getTime() + (cooldownHours * 60 * 60 * 1000));
            const now = new Date();

            return {
                valid: now >= cooldownEnd,
                reason: now >= cooldownEnd ? 'cooldown_expired' : 'cooldown_active',
                message: now >= cooldownEnd 
                    ? 'Cooldown period has expired'
                    : `Cooldown active until ${cooldownEnd.toLocaleString()}`,
                cooldownEnd,
                remainingTime: now < cooldownEnd ? cooldownEnd - now : 0
            };

        } catch (error) {
            logger.error('Error validating cooldown period:', error);
            return {
                valid: true, // Allow if validation fails
                reason: 'validation_error',
                message: 'Could not validate cooldown period'
            };
        }
    }

    /**
     * Validate maximum completions limit
     * @private
     */
    async validateMaxCompletions(requirementData, userData, taskData) {
        try {
            const maxCompletions = requirementData;
            if (maxCompletions === 0) {
                return {
                    valid: true,
                    reason: 'unlimited_completions',
                    message: 'Unlimited completions allowed'
                };
            }

            const completionCount = await this.getUserTaskCompletionCount(taskData.id, userData.id);

            return {
                valid: completionCount < maxCompletions,
                reason: completionCount < maxCompletions ? 'under_completion_limit' : 'completion_limit_reached',
                message: completionCount < maxCompletions 
                    ? `${completionCount}/${maxCompletions} completions used`
                    : `Maximum completions reached (${maxCompletions})`,
                currentCompletions: completionCount,
                maxCompletions
            };

        } catch (error) {
            logger.error('Error validating max completions:', error);
            return {
                valid: true, // Allow if validation fails
                reason: 'validation_error',
                message: 'Could not validate completion limit'
            };
        }
    }

    /**
     * Validate account age requirement
     * @private
     */
    async validateAccountAge(requirementData, userData, taskData) {
        const requiredDays = requirementData;
        const accountAge = Math.floor((new Date() - new Date(userData.createdAt)) / (24 * 60 * 60 * 1000));

        return {
            valid: accountAge >= requiredDays,
            reason: accountAge >= requiredDays ? 'account_age_sufficient' : 'account_age_insufficient',
            message: accountAge >= requiredDays 
                ? `Account age requirement met (${accountAge}/${requiredDays} days)`
                : `Account too new (${accountAge}/${requiredDays} days)`,
            currentAge: accountAge,
            requiredAge: requiredDays
        };
    }

    /**
     * Validate community membership
     * @private
     */
    async validateCommunityMembership(requirementData, userData, taskData) {
        try {
            const requiredCommunityId = requirementData;
            const membership = await this.botService.makeNafflesApiCall(
                `/api/communities/${requiredCommunityId}/members/${userData.id}`
            ).catch(() => null);

            return {
                valid: !!membership && membership.isActive,
                reason: !!membership && membership.isActive ? 'community_member' : 'not_community_member',
                message: !!membership && membership.isActive 
                    ? 'Community membership verified'
                    : 'You must be a member of the required community',
                communityId: requiredCommunityId
            };

        } catch (error) {
            logger.error('Error validating community membership:', error);
            return {
                valid: false,
                reason: 'validation_error',
                message: 'Could not validate community membership'
            };
        }
    }

    /**
     * Validate Discord role requirement
     * @private
     */
    async validateDiscordRole(requirementData, userData, taskData) {
        try {
            const { guildId, roleId } = requirementData;
            
            const guild = this.botService.client.guilds.cache.get(guildId);
            if (!guild) {
                return {
                    valid: false,
                    reason: 'guild_not_found',
                    message: 'Discord server not accessible'
                };
            }

            const member = await guild.members.fetch(userData.discordId).catch(() => null);
            if (!member) {
                return {
                    valid: false,
                    reason: 'not_guild_member',
                    message: 'You are not a member of the required Discord server'
                };
            }

            const hasRole = member.roles.cache.has(roleId);

            return {
                valid: hasRole,
                reason: hasRole ? 'role_verified' : 'role_missing',
                message: hasRole 
                    ? 'Discord role requirement met'
                    : 'You do not have the required Discord role',
                guildId,
                roleId
            };

        } catch (error) {
            logger.error('Error validating Discord role:', error);
            return {
                valid: false,
                reason: 'validation_error',
                message: 'Could not validate Discord role'
            };
        }
    }

    /**
     * Validate NFT ownership requirement
     * @private
     */
    async validateNFTOwnership(requirementData, userData, taskData) {
        try {
            const { contractAddress, tokenIds, minimumCount } = requirementData;
            
            // This would integrate with NFT ownership verification service
            const ownedNFTs = await this.botService.makeNafflesApiCall(
                `/api/nft/ownership/${userData.id}?contract=${contractAddress}`
            ).catch(() => []);

            let validCount = 0;
            
            if (tokenIds && tokenIds.length > 0) {
                // Check specific token IDs
                validCount = ownedNFTs.filter(nft => tokenIds.includes(nft.tokenId)).length;
            } else {
                // Check any NFTs from the contract
                validCount = ownedNFTs.length;
            }

            const required = minimumCount || 1;

            return {
                valid: validCount >= required,
                reason: validCount >= required ? 'nft_ownership_verified' : 'insufficient_nft_ownership',
                message: validCount >= required 
                    ? `NFT ownership verified (${validCount}/${required})`
                    : `Insufficient NFT ownership (${validCount}/${required})`,
                ownedCount: validCount,
                requiredCount: required,
                contractAddress
            };

        } catch (error) {
            logger.error('Error validating NFT ownership:', error);
            return {
                valid: false,
                reason: 'validation_error',
                message: 'Could not validate NFT ownership'
            };
        }
    }

    /**
     * Validate token balance requirement
     * @private
     */
    async validateTokenBalance(requirementData, userData, taskData) {
        try {
            const { tokenAddress, minimumBalance } = requirementData;
            
            const balance = await this.botService.makeNafflesApiCall(
                `/api/tokens/balance/${userData.id}?token=${tokenAddress}`
            ).catch(() => ({ balance: 0 }));

            const userBalance = parseFloat(balance.balance || 0);
            const required = parseFloat(minimumBalance);

            return {
                valid: userBalance >= required,
                reason: userBalance >= required ? 'token_balance_sufficient' : 'token_balance_insufficient',
                message: userBalance >= required 
                    ? `Token balance sufficient (${userBalance}/${required})`
                    : `Insufficient token balance (${userBalance}/${required})`,
                currentBalance: userBalance,
                requiredBalance: required,
                tokenAddress
            };

        } catch (error) {
            logger.error('Error validating token balance:', error);
            return {
                valid: false,
                reason: 'validation_error',
                message: 'Could not validate token balance'
            };
        }
    }

    // Utility methods

    /**
     * Get task details
     * @private
     */
    async getTaskDetails(taskId) {
        try {
            return await this.botService.makeNafflesApiCall(`/api/social-tasks/${taskId}`);
        } catch (error) {
            logger.error('Error getting task details:', error);
            return null;
        }
    }

    /**
     * Get user data
     * @private
     */
    async getUserData(userId, discordId) {
        try {
            const userData = await this.botService.makeNafflesApiCall(`/api/users/${userId}`);
            return {
                ...userData,
                discordId
            };
        } catch (error) {
            logger.error('Error getting user data:', error);
            return null;
        }
    }

    /**
     * Get user retry history
     * @private
     */
    async getUserRetryHistory(taskId, userId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/retries/${userId}`
            );
        } catch (error) {
            logger.error('Error getting user retry history:', error);
            return [];
        }
    }

    /**
     * Get last task completion
     * @private
     */
    async getLastTaskCompletion(taskId, userId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/completions/${userId}/latest`
            );
        } catch (error) {
            logger.error('Error getting last task completion:', error);
            return null;
        }
    }

    /**
     * Get user task completion count
     * @private
     */
    async getUserTaskCompletionCount(taskId, userId) {
        try {
            const completions = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/completions/${userId}/count`
            );
            return completions.count || 0;
        } catch (error) {
            logger.error('Error getting user task completion count:', error);
            return 0;
        }
    }
}

module.exports = TaskEligibilityService;