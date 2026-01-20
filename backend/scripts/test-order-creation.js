const mongoose = require('mongoose');
require('dotenv').config();

const testOrderCreation = async () => {
  try {
    console.log('Подключение к MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Подключено к MongoDB\n');

    // Загружаем модель Order
    const Order = require('../src/models/Order');

    // Точные данные из вашего запроса
    const orderData = {
      clientId: "696f87382984737a309c3b16",
      productType: "очки",
      status: "черновик",
      frame: {
        brand: "орпорп",
        material: "пластик",
        price: 1000
      },
      lenses: {
        brand: "ывавыа",
        type: "однофокальные",
        material: "пластик",
        price: 1000
      },
      prescription: {
        rightEye: {
          sphere: "+2.5",
          cylinder: "+2.4",
          axis: 3,
          addition: 0
        },
        leftEye: {
          sphere: "+2.5",
          cylinder: "+2.4",
          axis: 3,
          addition: 0
        },
        pd: 63,
        purpose: "для постоянного ношения",
        masterWorkCost: 1000,
        prescriptionOrderDate: "2026-01-08"
      },
      totalPrice: 2000,
      prepayment: 0,
      discount: 0,
      paymentMethod: "наличные",
      employeeId: "696f87382984737a309c3b16", // Используем тот же ID для теста
      createdBy: "696f87382984737a309c3b16"
    };

    console.log('Попытка создать заказ с данными:');
    console.log(JSON.stringify(orderData, null, 2));
    console.log('\n');

    // Пробуем создать заказ
    const order = new Order(orderData);
    
    // Валидация
    const validationError = order.validateSync();
    if (validationError) {
      console.log('✗ ОШИБКА ВАЛИДАЦИИ:');
      console.log(validationError.message);
      console.log('\nДетали ошибок:');
      Object.keys(validationError.errors).forEach(key => {
        console.log(`  - ${key}: ${validationError.errors[key].message}`);
      });
    } else {
      console.log('✓ Валидация прошла успешно!');
      console.log('\nСохранение в базу данных...');
      
      try {
        await order.save();
        console.log('✓ Заказ успешно создан!');
        console.log('ID заказа:', order._id);
        
        // Удаляем тестовый заказ
        await Order.findByIdAndDelete(order._id);
        console.log('✓ Тестовый заказ удален');
      } catch (saveError) {
        console.log('✗ ОШИБКА ПРИ СОХРАНЕНИИ:');
        console.log(saveError.message);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('✗ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
    console.error(error);
    process.exit(1);
  }
};

testOrderCreation();
