const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupAllAnalytics() {
    try {
        console.log('🧹 Cleaning up all Analytics integrations...');

        // Delete all Analytics integrations
        const deletedAnalytics = await prisma.userIntegration.deleteMany({
            where: {
                providerName: 'google_analytics'
            }
        });

        console.log(`✅ Deleted ${deletedAnalytics.count} Analytics integrations`);

        // Check remaining integrations
        const remaining = await prisma.userIntegration.findMany({
            where: {
                providerName: {
                    in: ['google_analytics', 'google_search_console']
                }
            }
        });

        console.log(`📊 Remaining Google integrations: ${remaining.length}`);
        remaining.forEach((integration, index) => {
            console.log(`  ${index + 1}. ${integration.providerName}: ${integration.propertyName || integration.accountName} (${integration.accountId})`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupAllAnalytics(); 