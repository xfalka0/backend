const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

// Log format configuration
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `[${info.timestamp}] [${info.level}]: ${info.message}`
    )
);

// Transports configuration
const transports = [
    // Colored console logging
    new winston.transports.Console({
        format: format,
        level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
    }),
    // Error file logging
    new winston.transports.File({
        filename: path.join(__dirname, '../logs/error.log'),
        level: 'error',
        format: winston.format.combine(
            winston.format.uncolorize(),
            winston.format.json()
        )
    }),
    // Combined all file logging
    new winston.transports.File({
        filename: path.join(__dirname, '../logs/combined.log'),
        level: 'info',
        format: winston.format.combine(
            winston.format.uncolorize(),
            winston.format.json()
        )
    })
];

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    levels,
    transports
});

module.exports = logger;
