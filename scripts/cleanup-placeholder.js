const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupPlaceholder() {
    try {
        console.log('🧹 Cleaning up placeholder records...');

        // Delete placeholder records
        const deletedCount = await prisma.userIntegration.deleteMany({
            where: {
                accountId: 'pending_property_selection'
            }
        });

        console.log(`✅ Deleted ${deletedCount.count} placeholder records`);

        // Check remaining records
        const remaining = await prisma.userIntegration.findMany({
            where: {
                providerName: 'google_analytics'
            }
        });

        console.log(`📊 Remaining Analytics integrations: ${remaining.length}`);
        remaining.forEach((integration, index) => {
            console.log(`  ${index + 1}. ${integration.propertyName || integration.accountName} (${integration.accountId})`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupPlaceholder(); 