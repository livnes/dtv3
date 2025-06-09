import winston from 'winston'

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
            return `${timestamp} ${level.toUpperCase()}: ${stack || message}`
        })
    ),
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ],
})

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
    logger.add(
        new winston.transports.File({
            filename: 'app.log',
            maxsize: 10000000, // 10MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    )
}

/**
 * Log info message
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
export function logInfo(message, context = {}) {
    logger.info(message, context)
}

/**
 * Log warning message
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
export function logWarn(message, context = {}) {
    logger.warn(message, context)
}

/**
 * Log error message
 * @param {string} message - Log message
 * @param {Error|object} error - Error object or context
 */
export function logError(message, error = {}) {
    if (error instanceof Error) {
        logger.error(message, { error: error.message, stack: error.stack })
    } else {
        logger.error(message, error)
    }
}

export default logger 