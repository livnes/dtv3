console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('All env vars that start with DATABASE:',
    Object.keys(process.env).filter(key => key.includes('DATABASE'))
); 