/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-10
 *      Design Name: logger.js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT
 *        Path Name: < src/utils/logger.js >
 * 
 * Description:
 * - This file contains the logger configuration for the application.
 * - The logger uses the Winston library to log messages to a file.
 * - The logger rotates log files daily and compresses them.
 * - The logger logs messages with a timestamp and stack trace.
 * - The logger is used to log system events and errors.
 * - The logger is configured to log warnings and errors by default.
 * 
*-----------------------------------------------------------*/

import winston from 'winston';
import path from 'path';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
    level: 'warn',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new DailyRotateFile({
            filename: path.join(process.cwd(), 'src', 'systemlogs', 'app-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
        }),
    ],
});

export default logger;