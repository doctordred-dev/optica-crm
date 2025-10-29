const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Подключение к базе данных
connectDB();

const app = express();

// Middleware безопасности
app.use(helmet());
app.use(compression());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 минут
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // лимит запросов
  message: {
    error: 'Слишком много запросов, попробуйте позже'
  }
});
app.use('/api/', limiter);

// Логирование запросов
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// Парсинг JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы
app.use('/uploads', express.static('uploads'));

// Базовый роут
app.get('/', (req, res) => {
  res.json({
    message: 'Optika CRM API',
    version: process.env.API_VERSION || 'v1',
    status: 'running'
  });
});

// API роуты
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/sms', require('./routes/sms'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/upload', require('./routes/upload'));

// Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Маршрут не найден'
  });
});

// Обработчик ошибок
app.use(errorHandler);

const PORT = process.env.PORT || 7001;

app.listen(PORT, () => {
  logger.info(`Сервер запущен на порту ${PORT}`);
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
