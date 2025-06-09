const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestIntegration() {
    try {
        console.log('🔧 Creating test Google Analytics integration...');

        // Find the user ID from existing data
        const user = await prisma.user.findFirst({
            where: {
                email: 'web@livnes.com'
            }
        });

        if (!user) {
            console.log('❌ User not found');
            return;
        }

        console.log('✅ Found user:', user.email, 'ID:', user.id);

        // Check if there's already a Search Console integration to copy OAuth tokens from
        const existingIntegration = await prisma.userIntegration.findFirst({
            where: {
                userId: user.id,
                providerName: 'google_search_console'
            }
        });

        if (!existingIntegration) {
            console.log('❌ No existing Google integration found to copy OAuth tokens from');
            return;
        }

        console.log('✅ Found existing Google integration to copy OAuth tokens from');

        // Create a basic Analytics integration record
        const newIntegration = await prisma.userIntegration.create({
            data: {
                userId: user.id,
                providerName: 'google_analytics',
                accountId: 'sync_required',
                accountName: 'Sync with Google Analytics Required',
                propertyName: null,
                encryptedAccessToken: existingIntegration.encryptedAccessToken,
                encryptedRefreshToken: existingIntegration.encryptedRefreshToken,
                tokenExpiresAt: existingIntegration.tokenExpiresAt,
                scopes: existingIntegration.scopes || 'https://www.googleapis.com/auth/analytics.readonly',
                isActive: true,
                lastFetchAt: new Date()
            }
        });

        console.log('✅ Created Analytics integration record:', {
            id: newIntegration.id,
            accountId: newIntegration.accountId
        });

        console.log('🎉 Ready for property sync! Visit the integrations page now.');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

createTestIntegration(); 