const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Подключение к БД
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB подключена');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    process.exit(1);
  }
};

// Создание администратора
const createAdmin = async () => {
  try {
    await connectDB();

    const User = require('../models/User');

    // Данные администратора
    const adminData = {
      email: 'admin@optica.com',
      password: 'admin123456', // Измените на безопасный пароль
      name: 'Администратор',
      role: 'admin'
    };

    // Проверяем, существует ли уже администратор
    const existingAdmin = await User.findOne({ email: adminData.email });
    
    if (existingAdmin) {
      console.log('⚠️ Администратор с таким email уже существует');
      console.log(`Email: ${existingAdmin.email}`);
      console.log(`Имя: ${existingAdmin.name}`);
      console.log(`Роль: ${existingAdmin.role}`);
      process.exit(0);
    }

    // Создаем администратора
    const admin = await User.create(adminData);

    console.log('🎉 Администратор успешно создан!');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Пароль:', adminData.password);
    console.log('👤 Имя:', admin.name);
    console.log('🛡️ Роль:', admin.role);
    console.log('');
    console.log('⚠️ ВАЖНО: Обязательно смените пароль после первого входа!');
    console.log('');
    console.log('Для входа в систему используйте:');
    console.log(`POST http://localhost:${process.env.PORT || 3001}/api/auth/login`);
    console.log('Body: {');
    console.log(`  "email": "${admin.email}",`);
    console.log(`  "password": "${adminData.password}"`);
    console.log('}');

  } catch (error) {
    console.error('❌ Ошибка создания администратора:', error.message);
    
    if (error.code === 11000) {
      console.log('⚠️ Пользователь с таким email уже существует');
    }
  } finally {
    mongoose.connection.close();
  }
};

// Запуск скрипта
createAdmin();
