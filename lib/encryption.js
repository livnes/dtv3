import crypto from 'crypto'

const algorithm = 'aes-256-gcm' // Upgraded from CBC to GCM for better security

// For development, we'll use a hardcoded key if none provided
const getEncryptionKey = () => {
    if (process.env.ENCRYPTION_KEY) {
        const keyBuffer = Buffer.from(process.env.ENCRYPTION_KEY, 'base64')
        if (keyBuffer.length === 32) {
            return keyBuffer
        }
    }

    // Development fallback - use a consistent key
    console.warn('Using development encryption key. DO NOT use in production!')
    return Buffer.from('dev-key-32-bytes-1234567890123456', 'utf8')
}

/**
 * Encrypt text using AES-256-GCM (enhanced from original CBC)
 * @param {string} text - The text to encrypt
 * @returns {string} - The encrypted text in format: iv:authTag:encryptedData
 */
export function encrypt(text) {
    if (!text) return text

    try {
        // Generate a random initialization vector
        const iv = crypto.randomBytes(16)
        const key = getEncryptionKey()

        // Create cipher with IV
        const cipher = crypto.createCipheriv(algorithm, key, iv)

        // Encrypt the text
        let encrypted = cipher.update(text, 'utf8', 'hex')
        encrypted += cipher.final('hex')

        // Get authentication tag for GCM
        const authTag = cipher.getAuthTag()

        // Return IV, auth tag and encrypted data separated by colons
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
    } catch (error) {
        console.error('Encryption error:', error)
        throw new Error('Failed to encrypt data')
    }
}

/**
 * Decrypt text using AES-256-GCM (enhanced from original CBC)
 * @param {string} encryptedText - The encrypted text in format: iv:authTag:encryptedData
 * @returns {string} - The decrypted text
 */
export function decrypt(encryptedText) {
    if (!encryptedText) return encryptedText

    try {
        // Handle old format (iv:encryptedData) for backward compatibility
        const parts = encryptedText.split(':')

        if (parts.length === 2) {
            // Legacy CBC format - fallback to old decryption
            return decryptLegacy(encryptedText)
        }

        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format')
        }

        // New GCM format: iv:authTag:encryptedData
        const [ivHex, authTagHex, encrypted] = parts

        // Convert back to buffers
        const iv = Buffer.from(ivHex, 'hex')
        const authTag = Buffer.from(authTagHex, 'hex')
        const key = getEncryptionKey()

        // Create decipher with IV
        const decipher = crypto.createDecipheriv(algorithm, key, iv)
        decipher.setAuthTag(authTag)

        // Decrypt the data
        let decrypted = decipher.update(encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    } catch (error) {
        console.error('Decryption error:', error)
        throw new Error('Failed to decrypt data')
    }
}

/**
 * Legacy decryption for backward compatibility with old CBC format
 * @param {string} encryptedText - The encrypted text in old format: iv:encryptedData
 * @returns {string} - The decrypted text
 */
function decryptLegacy(encryptedText) {
    try {
        const [ivHex, encrypted] = encryptedText.split(':')

        if (!ivHex || !encrypted) {
            throw new Error('Invalid legacy encrypted data format')
        }

        // Convert IV back to buffer
        const iv = Buffer.from(ivHex, 'hex')
        const key = getEncryptionKey()

        // Create decipher with IV using old CBC algorithm
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)

        // Decrypt the data
        let decrypted = decipher.update(encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    } catch (error) {
        console.error('Legacy decryption error:', error)
        throw new Error('Failed to decrypt legacy data')
    }
}

/**
 * Generate a random 32-byte key for encryption
 * @returns {string} - Base64-encoded key
 */
export function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('base64')
}

/**
 * Hash sensitive data (like user IDs) for secure storage
 * @param {string} data - The data to hash
 * @returns {string} - SHA-256 hash as hex string
 */
export function hash(data) {
    if (!data) return null
    return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Generate a secure random token
 * @param {number} length - Length of the token in bytes (default: 32)
 * @returns {string} - Random token as hex string
 */
export function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex')
}

/**
 * Verify if encrypted data is valid (can be decrypted)
 * @param {string} encryptedData - The encrypted data to verify
 * @returns {boolean} - True if data can be decrypted
 */
export function verifyEncryptedData(encryptedData) {
    try {
        const decrypted = decrypt(encryptedData)
        return decrypted !== null
    } catch (error) {
        return false
    }
}

/**
 * Encrypt OAuth token data for database storage
 * @param {Object} tokenData - OAuth token object
 * @returns {Object} - Encrypted token data
 */
export function encryptTokenData(tokenData) {
    if (!tokenData) return null

    const encrypted = {
        access_token: tokenData.access_token ? encrypt(tokenData.access_token) : null,
        refresh_token: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        client_id: tokenData.client_id ? encrypt(tokenData.client_id) : null,
        client_secret: tokenData.client_secret ? encrypt(tokenData.client_secret) : null,
        token_uri: tokenData.token_uri || null,
        expires_at: tokenData.expires_at || null,
        scopes: tokenData.scopes || null
    }

    return encrypted
}

/**
 * Decrypt OAuth token data from database
 * @param {Object} encryptedTokenData - Encrypted token object
 * @returns {Object} - Decrypted token data
 */
export function decryptTokenData(encryptedTokenData) {
    if (!encryptedTokenData) return null

    const decrypted = {
        access_token: encryptedTokenData.access_token ? decrypt(encryptedTokenData.access_token) : null,
        refresh_token: encryptedTokenData.refresh_token ? decrypt(encryptedTokenData.refresh_token) : null,
        client_id: encryptedTokenData.client_id ? decrypt(encryptedTokenData.client_id) : null,
        client_secret: encryptedTokenData.client_secret ? decrypt(encryptedTokenData.client_secret) : null,
        token_uri: encryptedTokenData.token_uri || null,
        expires_at: encryptedTokenData.expires_at || null,
        scopes: encryptedTokenData.scopes || null
    }

    return decrypted
} 