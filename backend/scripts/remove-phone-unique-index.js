const mongoose = require('mongoose');
require('dotenv').config();

const removePhoneUniqueIndex = async () => {
  try {
    console.log('Подключение к MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Подключено к MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('clients');

    console.log('\nПроверка существующих индексов...');
    const indexes = await collection.indexes();
    console.log('Существующие индексы:', JSON.stringify(indexes, null, 2));

    // Ищем индекс на поле phone
    const phoneIndex = indexes.find(index => index.key && index.key.phone);
    
    if (phoneIndex) {
      console.log(`\nНайден индекс на поле phone: ${phoneIndex.name}`);
      
      if (phoneIndex.unique) {
        console.log('Индекс является уникальным. Удаляем...');
        await collection.dropIndex(phoneIndex.name);
        console.log('✓ Уникальный индекс успешно удален');
      } else {
        console.log('Индекс не является уникальным. Удаление не требуется.');
      }
    } else {
      console.log('\nИндекс на поле phone не найден.');
    }

    console.log('\nПроверка индексов после удаления...');
    const indexesAfter = await collection.indexes();
    console.log('Индексы после удаления:', JSON.stringify(indexesAfter, null, 2));

    console.log('\n✓ Миграция завершена успешно!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Ошибка при выполнении миграции:', error);
    process.exit(1);
  }
};

removePhoneUniqueIndex();
