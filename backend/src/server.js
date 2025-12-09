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

// Trust proxy - необходимо для работы за Render/Cloudflare
app.set('trust proxy', 1);

// Middleware безопасности
app.use(helmet());
app.use(compression());

// CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'https://optica-crm.vercel.app'
];

// Добавляем дополнительные origins из переменной окружения
if (process.env.CORS_ORIGIN) {
  const envOrigins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  allowedOrigins.push(...envOrigins);
}

app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (мобильные приложения, Postman и т.д.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Не разрешено CORS политикой'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // для поддержки старых браузеров
}));

// Rate limiting - разные лимиты для разных эндпоинтов
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 минут
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // увеличен лимит
  message: {
    error: 'Слишком много запросов, попробуйте позже'
  },
  standardHeaders: true, // Возвращает информацию о лимитах в заголовках
  legacyHeaders: false,
});

// Более строгий лимит для аутентификации (защита от брутфорса)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // только 10 попыток входа
  message: {
    error: 'Слишком много попыток входа, попробуйте позже'
  },
  skipSuccessfulRequests: true, // не считаем успешные запросы
});

// Применяем общий лимит ко всем API
app.use('/api/', generalLimiter);

// Строгий лимит для логина
app.use('/api/auth/login', authLimiter);

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

// Health check endpoint для мониторинга
app.get('/api/health', async (req, res) => {
  try {
    // Проверяем подключение к базе данных
    const mongoose = require('mongoose');
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      memory: process.memoryUsage(),
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API роуты
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sms', require('./routes/sms'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/export', require('./routes/export'));

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
