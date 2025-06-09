const { PrismaClient } = require('@prisma/client');
const { discoverAndStoreAnalyticsProperties } = require('../lib/property-discovery.js');

const prisma = new PrismaClient();

async function fixProperties() {
    try {
        console.log('🔧 Starting property fix process...');

        // Find the user with the placeholder record
        const placeholderIntegration = await prisma.userIntegration.findFirst({
            where: {
                providerName: 'google_analytics',
                accountId: 'pending_property_selection'
            }
        });

        if (!placeholderIntegration) {
            console.log('❌ No placeholder record found');
            return;
        }

        console.log('✅ Found placeholder record:', {
            id: placeholderIntegration.id,
            userId: placeholderIntegration.userId,
            accountName: placeholderIntegration.accountName
        });

        // Trigger property discovery for this user/integration
        console.log('🔍 Running property discovery...');
        await discoverAndStoreAnalyticsProperties(placeholderIntegration.userId, placeholderIntegration);

        console.log('✅ Property discovery completed!');

        // Check the results
        const newIntegrations = await prisma.userIntegration.findMany({
            where: {
                userId: placeholderIntegration.userId,
                providerName: 'google_analytics'
            }
        });

        console.log(`🎉 Now have ${newIntegrations.length} Analytics integrations:`);
        newIntegrations.forEach((integration, index) => {
            console.log(`  ${index + 1}. ${integration.propertyName} (${integration.accountId})`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

fixProperties(); 