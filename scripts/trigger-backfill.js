#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function triggerBackfill() {
    try {
        console.log('🔄 Triggering analytics backfill...');

        // Make request to backfill API
        const response = await fetch('http://localhost:3000/api/cron/analytics-backfill', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Backfill triggered successfully');
            console.log('📊 Results:', result);
        } else {
            console.error('❌ Backfill failed:', result);
        }

    } catch (error) {
        console.error('❌ Error triggering backfill:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

triggerBackfill(); 