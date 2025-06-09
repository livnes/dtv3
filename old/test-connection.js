const { PrismaClient } = require('@prisma/client');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

console.log('Testing DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');

const prisma = new PrismaClient();

async function testConnection() {
    try {
        await prisma.$connect();
        console.log('✅ Database connection successful!');
        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
}

testConnection(); 