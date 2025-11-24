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

// Создание базовых SMS шаблонов
const createSMSTemplates = async () => {
  try {
    await connectDB();

    const SMSTemplate = require('../models/SMSTemplate');
    const User = require('../models/User');

    // Находим администратора для привязки шаблонов
    const admin = await User.findOne({ role: 'admin' });
    
    if (!admin) {
      console.error('❌ Администратор не найден. Сначала создайте администратора.');
      process.exit(1);
    }

    // Базовые шаблоны SMS
    const templates = [
      {
        name: 'Заказ готов',
        template: 'Добрий день, {clientName}! Ваше замовлення готове. {shopName}, тел. {shopPhone}. {shopAddress}',
        triggerEvent: 'order_ready',
        description: 'Уведомление о готовности заказа',
        availablePlaceholders: [
          'clientName',
          'orderNumber', 
          'shopName',
          'shopPhone',
          'shopAddress'
        ],
        isActive: true,
        createdBy: admin._id
      },
      {
        name: 'Заказ выдан',
        template: 'Спасибо за покупку, {clientName}! Заказ №{orderNumber} выдан. {shopName}',
        triggerEvent: 'order_delivered',
        description: 'Подтверждение выдачи заказа',
        availablePlaceholders: [
          'clientName',
          'orderNumber',
          'totalPrice',
          'shopName'
        ],
        isActive: true,
        createdBy: admin._id
      },
      {
        name: 'Напоминание об оплате',
        template: '{clientName}, напоминаем о доплате {remainingPayment} за заказ. {shopName}, тел. {shopPhone}',
        triggerEvent: 'payment_reminder',
        description: 'Напоминание о необходимости доплаты',
        availablePlaceholders: [
          'clientName',
          'orderNumber',
          'remainingPayment',
          'shopName',
          'shopPhone'
        ],
        isActive: true,
        createdBy: admin._id
      },
      {
        name: 'Персональное предложение',
        template: '{clientName}, специальное предложение для Вас! Скидка 10% на новую коллекцию. {shopName}',
        triggerEvent: 'custom',
        description: 'Персональное предложение для клиента',
        availablePlaceholders: [
          'clientName',
          'shopName',
          'shopPhone'
        ],
        isActive: true,
        createdBy: admin._id
      }
    ];

    console.log('📱 Создание SMS шаблонов...');

    for (const templateData of templates) {
      // Проверяем, существует ли уже такой шаблон
      const existingTemplate = await SMSTemplate.findOne({ name: templateData.name });
      
      if (existingTemplate) {
        console.log(`⚠️ Шаблон "${templateData.name}" уже существует`);
        continue;
      }

      const template = await SMSTemplate.create(templateData);
      console.log(`✅ Создан шаблон: "${template.name}"`);
      
      // Тестируем рендеринг шаблона
      const testData = {
        clientName: 'Иван Петров',
        orderNumber: '123456',
        totalPrice: '2500',
        remainingPayment: '1000',
        shopName: 'Оптика',
        shopPhone: '+380501234567',
        shopAddress: 'ул. Примерная, 1'
      };
      
      const renderedMessage = template.render(testData);
      console.log(`   Пример: "${renderedMessage}"`);
      console.log(`   Длина: ${renderedMessage.length} символов`);
      console.log('');
    }

    console.log('🎉 Все SMS шаблоны созданы успешно!');
    console.log('');
    console.log('📋 Доступные плейсхолдеры:');
    console.log('   {clientName} - имя клиента');
    console.log('   {orderNumber} - номер заказа');
    console.log('   {deliveryDate} - дата выдачи');
    console.log('   {totalPrice} - общая стоимость');
    console.log('   {remainingPayment} - остаток к доплате');
    console.log('   {shopName} - название магазина');
    console.log('   {shopPhone} - телефон магазина');
    console.log('   {shopAddress} - адрес магазина');

  } catch (error) {
    console.error('❌ Ошибка создания SMS шаблонов:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

// Запуск скрипта
createSMSTemplates();
