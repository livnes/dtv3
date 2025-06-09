// Test environment variable loading
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

console.log('=== Environment Variables Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length);
console.log('DATABASE_URL first 50 chars:', process.env.DATABASE_URL?.substring(0, 50));

// Check all DATABASE related vars
const dbVars = Object.keys(process.env).filter(key => key.includes('DATABASE'));
console.log('All DATABASE vars:', dbVars); 