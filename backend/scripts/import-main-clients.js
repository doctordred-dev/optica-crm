const XLSX = require('xlsx');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Подключаем модели
const Client = require('../src/models/Client');
const User = require('../src/models/User');

// Функция для нормализации телефона
function normalizePhone(phone) {
  if (!phone) return null;
  
  // Преобразуем в строку и удаляем все нечисловые символы
  let cleaned = String(phone).replace(/\D/g, '');
  
  // Если номер из 9 цифр (Excel убрал ведущий 0), это украинский номер
  if (cleaned.length === 9) {
    return '+380' + cleaned;
  }
  
  // Если номер начинается с 0 (10 цифр)
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return '+380' + cleaned.slice(1);
  }
  
  // Если номер начинается с 380 (12 цифр)
  if (cleaned.length === 12 && cleaned.startsWith('380')) {
    return '+' + cleaned;
  }
  
  // Если номер начинается с 8 (10 цифр)
  if (cleaned.length === 10 && cleaned.startsWith('8')) {
    return '+380' + cleaned.slice(1);
  }
  
  // Если уже есть +380 (13 символов с +)
  if (cleaned.length === 12 && cleaned.startsWith('380')) {
    return '+' + cleaned;
  }
  
  return null; // Неверный формат
}

// Функция для извлечения первого телефона если их несколько
function extractFirstPhone(phoneStr) {
  if (!phoneStr) return null;
  
  // Преобразуем в строку
  phoneStr = String(phoneStr).trim();
  
  // Если пусто, возвращаем null
  if (!phoneStr || phoneStr === '') return null;
  
  // Разделяем по запятой, точке с запятой или слешу
  const phones = phoneStr.split(/[,;\/]/);
  
  // Берем первый телефон
  return phones[0].trim();
}

async function importMainClients() {
  try {
    // Подключаемся к MongoDB
    console.log('🔌 Подключение к MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключено к MongoDB');

    // Находим или создаем системного пользователя для импорта
    let systemUser = await User.findOne({ email: 'system.import@optica.com' });
    
    if (!systemUser) {
      console.log('📝 Создание системного пользователя для импорта...');
      systemUser = await User.create({
        email: 'system.import@optica.com',
        name: 'System Import',
        password: 'system-import-' + Date.now(),
        role: 'admin',
        isActive: false // Деактивируем, чтобы нельзя было войти
      });
      console.log('✅ Системный пользователь создан');
    }

    // Путь к файлу Excel
    const filePath = path.join(__dirname, '../../Клієнтська база.xlsx');
    console.log(`📂 Чтение файла: ${filePath}`);

    // Читаем файл Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Конвертируем в JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`📊 Найдено строк в файле: ${data.length}`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Пропускаем заголовок (первые 2 строки)
    for (let i = 2; i < data.length; i++) {
      const row = data[i];

      // Пропускаем пустые строки
      if (!row || row.length === 0) {
        skipped++;
        continue;
      }

      // Извлекаем данные из колонок
      const lastName = row[0] ? String(row[0]).trim() : '';  // Колонка A: Прізвище
      const firstName = row[1] ? String(row[1]).trim() : ''; // Колонка B: Ім'я
      const phoneRaw = row[8]; // Колонка I: Мобільний (индекс 8, так как нумерация с 0)

      // Формируем полное имя
      const fullName = `${lastName} ${firstName}`.trim();

      // Если нет имени, пропускаем
      if (!fullName) {
        skipped++;
        continue;
      }

      // Извлекаем первый телефон
      const firstPhone = extractFirstPhone(phoneRaw);
      
      // Нормализуем телефон
      const phone = normalizePhone(firstPhone);

      // Если нет телефона, пропускаем
      if (!phone) {
        console.log(`⚠️  Строка ${i + 1}: ${fullName} - Пропущена (нет телефона)`);
        skipped++;
        continue;
      }

      try {
        // Проверяем, существует ли клиент с таким телефоном
        const existingClient = await Client.findOne({ phone });

        if (existingClient) {
          console.log(`ℹ️  Строка ${i + 1}: ${fullName} (${phone}) - Уже существует`);
          skipped++;
          continue;
        }

        // Создаем нового клиента
        const newClient = new Client({
          name: fullName,
          phone: phone,
          source: 'другое', // Устанавливаем источник по умолчанию
          createdBy: systemUser._id,
        });

        await newClient.save();
        console.log(`✅ Строка ${i + 1}: ${fullName} (${phone}) - Импортирован`);
        imported++;
      } catch (error) {
        console.error(`❌ Строка ${i + 1}: ${fullName} (${phone}) - Ошибка: ${error.message}`);
        errors++;
      }
    }

    console.log('\n📈 Результаты импорта:');
    console.log(`✅ Импортировано: ${imported}`);
    console.log(`⚠️  Пропущено: ${skipped}`);
    console.log(`❌ Ошибок: ${errors}`);
    console.log(`📊 Всего обработано: ${data.length - 2} строк`);

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
  } finally {
    // Закрываем соединение с БД
    await mongoose.connection.close();
    console.log('\n🔌 Соединение с MongoDB закрыто');
  }
}

// Запускаем импорт
importMainClients();
