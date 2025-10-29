const winston = require('winston');
const path = require('path');

// Создание директории для логов
const logDir = 'logs';
const fs = require('fs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Конфигурация логгера
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'optica-crm' },
  transports: [
    // Запись ошибок в отдельный файл
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    // Запись всех логов
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log')
    })
  ]
});

// В режиме разработки также выводить в консоль
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
