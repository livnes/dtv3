const { Client } = require('pg');

const connectionString = "postgres://3056c70f7975222a561cdbd741da1624d04c9ebc57b2629626e397b9fa019093:sk_tsY9VZoOaJGLHHzEb-PMR@db.prisma.io:5432/?sslmode=require";

const client = new Client({
    connectionString: connectionString,
});

async function testConnection() {
    try {
        console.log('Attempting to connect...');
        await client.connect();
        console.log('✅ Direct PostgreSQL connection successful!');

        const result = await client.query('SELECT NOW()');
        console.log('✅ Query test successful:', result.rows[0]);

        await client.end();
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Error code:', error.code);
    }
}

testConnection(); 