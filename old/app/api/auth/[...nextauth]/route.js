callbacks: {
  async signIn({ user, account, profile }) {
        if (account?.provider === 'google') {
            try {
                // Save encrypted tokens
                const integration = await saveUserIntegration(user.id, account);

                // 🚀 TRIGGER IMMEDIATE BACKFILL
                const immediateBackfill = require('@/lib/immediateBackfill');
                await immediateBackfill.triggerUserBackfill(user.id, integration.id);

                return true;
            } catch (error) {
                logger.error('Error in signIn callback:', error);
                return false;
            }
        }
        return true;
    }
} 