const mongoose = require('mongoose');
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

// Обновление SMS шаблонов
const updateSMSTemplates = async () => {
  try {
    await connectDB();

    const SMSTemplate = require('../models/SMSTemplate');

    console.log('📱 Обновление SMS шаблонов...');

    // Обновляем шаблон "Заказ готов"
    const orderReadyTemplate = await SMSTemplate.findOne({ name: 'Заказ готов' });
    
    if (orderReadyTemplate) {
      orderReadyTemplate.template = 'Добрий день, {clientName}! Ваше замовлення готове. {shopName}, тел. {shopPhone}. {shopAddress}';
      await orderReadyTemplate.save();
      console.log('✅ Обновлен шаблон: "Заказ готов"');
      
      // Тестируем рендеринг
      const testData = {
        clientName: 'Іван Петров',
        shopName: 'Оптика Нивки',
        shopPhone: '+380679157706',
        shopAddress: 'бул. Павла Вірського, 6, Київ (в аптеці "Доброго Дня")'
      };
      
      const renderedMessage = orderReadyTemplate.render(testData);
      console.log(`   Приклад: "${renderedMessage}"`);
      console.log(`   Довжина: ${renderedMessage.length} символів`);
    } else {
      console.log('⚠️ Шаблон "Заказ готов" не найден');
    }

    console.log('');
    console.log('🎉 SMS шаблоны успешно обновлены!');

  } catch (error) {
    console.error('❌ Ошибка обновления SMS шаблонов:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

// Запуск скрипта
updateSMSTemplates();
