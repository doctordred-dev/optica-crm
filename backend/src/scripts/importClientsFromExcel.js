const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
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

// Нормализация номера телефона
const normalizePhone = (phone) => {
  if (!phone) return null;
  
  // Удаляем все символы кроме цифр и +
  let normalized = phone.toString().replace(/[^\d+]/g, '');
  
  // Если начинается с 380, добавляем +
  if (normalized.startsWith('380')) {
    normalized = '+' + normalized;
  }
  // Если начинается с 0, заменяем на +380
  else if (normalized.startsWith('0')) {
    normalized = '+38' + normalized;
  }
  // Если начинается с 8, заменяем на +380
  else if (normalized.startsWith('8')) {
    normalized = '+38' + normalized.substring(1);
  }
  // Если уже есть +, оставляем как есть
  else if (!normalized.startsWith('+')) {
    // Если ничего не подходит, добавляем +380
    normalized = '+380' + normalized;
  }
  
  return normalized;
};

// Импорт клиентов из Excel
const importClientsFromExcel = async () => {
  try {
    await connectDB();

    const Client = require('../models/Client');
    const User = require('../models/User');

    // Находим администратора для привязки клиентов
    const admin = await User.findOne({ role: 'admin' });
    
    if (!admin) {
      console.error('❌ Администратор не найден. Сначала создайте администратора.');
      process.exit(1);
    }

    // Путь к Excel файлу
    const excelFilePath = path.join(__dirname, '../../../Клієнтська база окулярів.xlsx');
    
    console.log(`📂 Чтение файла: ${excelFilePath}`);
    
    // Читаем Excel файл
    const workbook = XLSX.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0]; // Берем первый лист
    const worksheet = workbook.Sheets[sheetName];
    
    // Конвертируем в JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Найдено записей в Excel: ${rawData.length}`);
    console.log('');
    
    // Показываем первую запись для понимания структуры
    if (rawData.length > 0) {
      console.log('📋 Пример первой записи:');
      console.log(JSON.stringify(rawData[0], null, 2));
      console.log('');
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    console.log('🔄 Начинаем импорт...');
    console.log('');

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      
      try {
        // Определяем поля из Excel
        // Получаем все значения строки в массив
        const rowValues = Object.values(row);
        
        // Фамилия - первая колонка, Имя - вторая колонка
        const lastName = rowValues[0] || '';
        const firstName = rowValues[1] || '';
        
        // Объединяем Фамилию и Имя
        const name = `${lastName} ${firstName}`.trim();
        
        // Телефон - колонка "Мобільний"
        const phone = row['Мобільний'] || row['Мобильный'] || row['Mobile'] || 
                      row['Телефон'] || row['Phone'] || row['phone'];
        
        // Опциональные поля (если нужны в будущем)
        const birthDate = row['Дата народження'] || row['Дата рождения'] || row['Birth Date'];
        const comments = row['Коментарі'] || row['Комментарии'] || row['Comments'];
        const source = row['Джерело'] || row['Источник'] || row['Source'];
        
        // Проверяем обязательные поля
        if (!name || !phone) {
          console.log(`⚠️  Строка ${i + 1}: Пропущена (нет имени или телефона)`);
          skipped++;
          continue;
        }

        // Нормализуем телефон
        const normalizedPhone = normalizePhone(phone);
        
        if (!normalizedPhone) {
          console.log(`⚠️  Строка ${i + 1}: Пропущена (некорректный телефон: ${phone})`);
          skipped++;
          continue;
        }

        // Проверяем, существует ли клиент с таким телефоном
        const existingClient = await Client.findOne({ phone: normalizedPhone });
        
        if (existingClient) {
          console.log(`⚠️  Строка ${i + 1}: Клиент "${name}" (${normalizedPhone}) уже существует`);
          skipped++;
          continue;
        }

        // Создаем нового клиента
        const clientData = {
          name: name.trim(),
          phone: normalizedPhone,
          createdBy: admin._id
        };

        // Добавляем опциональные поля
        if (birthDate) {
          // Пытаемся распарсить дату
          const parsedDate = new Date(birthDate);
          if (!isNaN(parsedDate.getTime())) {
            clientData.birthDate = parsedDate;
          }
        }

        if (comments) {
          clientData.comments = comments.toString().trim();
        }

        if (source) {
          clientData.source = source.toString().trim();
        }

        // Создаем клиента
        const newClient = await Client.create(clientData);
        
        console.log(`✅ Строка ${i + 1}: Импортирован "${newClient.name}" (${newClient.phone})`);
        imported++;

      } catch (error) {
        console.error(`❌ Строка ${i + 1}: Ошибка импорта - ${error.message}`);
        errors++;
      }
    }

    console.log('');
    console.log('🎉 Импорт завершен!');
    console.log('');
    console.log('📊 Статистика:');
    console.log(`   ✅ Импортировано: ${imported}`);
    console.log(`   ⚠️  Пропущено: ${skipped}`);
    console.log(`   ❌ Ошибок: ${errors}`);
    console.log(`   📝 Всего обработано: ${rawData.length}`);

  } catch (error) {
    console.error('❌ Ошибка импорта:', error.message);
    console.error(error.stack);
  } finally {
    mongoose.connection.close();
  }
};

// Запуск скрипта
importClientsFromExcel();
