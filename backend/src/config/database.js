const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    logger.info(`MongoDB подключена: ${conn.connection.host}`);
    console.log(`✅ MongoDB подключена: ${conn.connection.host}`);
  } catch (error) {
    logger.error('Ошибка подключения к MongoDB:', error.message);
    console.error(`❌ Ошибка подключения к MongoDB: ${error.message}`);
    
    // В режиме разработки не останавливаем сервер при ошибке БД
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.log('⚠️ Сервер запущен без подключения к БД (режим разработки)');
    }
  }
};

// Обработка отключения
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB отключена');
  console.log('⚠️ MongoDB отключена');
});

// Обработка ошибок подключения
mongoose.connection.on('error', (err) => {
  logger.error('Ошибка MongoDB:', err);
  console.error('❌ Ошибка MongoDB:', err);
});

module.exports = connectDB;
