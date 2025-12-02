const XLSX = require('xlsx');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Подключаем модели
const Client = require('../src/models/Client');
const Order = require('../src/models/Order');
const User = require('../src/models/User');

// Функция для нормализации телефона
function normalizePhone(phone) {
  if (!phone) return null;
  
  let cleaned = String(phone).replace(/\D/g, '');
  
  if (cleaned.length === 9) {
    return '+380' + cleaned;
  }
  
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return '+380' + cleaned.slice(1);
  }
  
  if (cleaned.length === 12 && cleaned.startsWith('380')) {
    return '+' + cleaned;
  }
  
  if (cleaned.length === 10 && cleaned.startsWith('8')) {
    return '+380' + cleaned.slice(1);
  }
  
  return null;
}

// Функция для извлечения первого телефона
function extractFirstPhone(phoneStr) {
  if (!phoneStr) return null;
  
  phoneStr = String(phoneStr).trim();
  
  if (!phoneStr || phoneStr === '') return null;
  
  const phones = phoneStr.split(/[,;\/]/);
  
  return phones[0].trim();
}

// Функция для парсинга числа из строки (например "+3,5" или "sph-3,25")
function parseNumber(str) {
  if (!str) return null;
  
  // Убираем все кроме цифр, точек, запятых, плюсов и минусов
  let cleaned = String(str).replace(/[^\d.,+\-]/g, '');
  
  // Заменяем запятую на точку
  cleaned = cleaned.replace(',', '.');
  
  // Парсим число
  const num = parseFloat(cleaned);
  
  return isNaN(num) ? null : num;
}

// Функция для парсинга рецепта из текста
function parsePrescription(prescriptionText) {
  if (!prescriptionText) return null;
  
  const text = String(prescriptionText).toUpperCase().trim();
  
  const prescription = {
    rightEye: {},
    leftEye: {},
    pd: null,
    purpose: null
  };
  
  // Разбиваем текст на строки
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l);
  
  // Объединяем все строки в одну для парсинга
  const fullText = lines.join(' ');
  
  // Парсинг OD (правый глаз) - улучшенный regex
  const odPattern = /OD[:\s]*(?:SPH)?[:\s]*([+-]?\d+[.,]?\d*)(?:[\s,]*(?:CYL)?[:\s]*([+-]?\d+[.,]?\d*))?(?:[\s,]*(?:AX)?[:\s]*(\d+[.,]?\d*))?/i;
  const odMatch = fullText.match(odPattern);
  if (odMatch) {
    prescription.rightEye.sphere = parseNumber(odMatch[1]);
    if (odMatch[2]) prescription.rightEye.cylinder = parseNumber(odMatch[2]);
    if (odMatch[3]) prescription.rightEye.axis = parseNumber(odMatch[3]);
  }
  
  // Парсинг OS (левый глаз) - улучшенный regex
  const osPattern = /OS[:\s]*(?:SPH)?[:\s]*([+-]?\d+[.,]?\d*)(?:[\s,]*(?:CYL)?[:\s]*([+-]?\d+[.,]?\d*))?(?:[\s,]*(?:AX)?[:\s]*(\d+[.,]?\d*))?/i;
  const osMatch = fullText.match(osPattern);
  if (osMatch) {
    prescription.leftEye.sphere = parseNumber(osMatch[1]);
    if (osMatch[2]) prescription.leftEye.cylinder = parseNumber(osMatch[2]);
    if (osMatch[3]) prescription.leftEye.axis = parseNumber(osMatch[3]);
  }
  
  // Парсинг OU (оба глаза одинаково) - улучшенный regex
  const ouPattern = /OU[:\s]*(?:SPH)?[:\s]*([+-]?\d+[.,]?\d*)(?:[\s,]*(?:CYL)?[:\s]*([+-]?\d+[.,]?\d*))?(?:[\s,]*(?:AX)?[:\s]*(\d+[.,]?\d*))?/i;
  const ouMatch = fullText.match(ouPattern);
  if (ouMatch) {
    const sphere = parseNumber(ouMatch[1]);
    const cylinder = ouMatch[2] ? parseNumber(ouMatch[2]) : null;
    const axis = ouMatch[3] ? parseNumber(ouMatch[3]) : null;
    
    prescription.rightEye.sphere = sphere;
    prescription.leftEye.sphere = sphere;
    if (cylinder) {
      prescription.rightEye.cylinder = cylinder;
      prescription.leftEye.cylinder = cylinder;
    }
    if (axis) {
      prescription.rightEye.axis = axis;
      prescription.leftEye.axis = axis;
    }
  }
  
  // Парсинг PD (межзрачковое расстояние) - поддержка диапазонов типа "57-58" или "30/29"
  const pdPattern = /PD[:\s]*(\d+[.,]?\d*)(?:[-\/](\d+[.,]?\d*))?/i;
  const pdMatch = fullText.match(pdPattern);
  if (pdMatch) {
    const pd1 = parseNumber(pdMatch[1]);
    const pd2 = pdMatch[2] ? parseNumber(pdMatch[2]) : null;
    // Если диапазон, берем среднее
    prescription.pd = pd2 ? (pd1 + pd2) / 2 : pd1;
  }
  
  // Парсинг ADD (аддидация)
  const addPattern = /ADD[:\s]*([+-]?\d+[.,]?\d*)/i;
  const addMatch = fullText.match(addPattern);
  if (addMatch) {
    const addition = parseNumber(addMatch[1]);
    if (addition) {
      prescription.rightEye.addition = addition;
      prescription.leftEye.addition = addition;
    }
  }
  
  // Определяем назначение рецепта из текста
  if (text.includes('ДЛЯ ЧИТАННЯ') || text.includes('ЧИТАННЯ')) {
    prescription.purpose = 'для читання';
  } else if (text.includes('ДЛЯ ДАЛІ') || text.includes('ДАЛЬ')) {
    prescription.purpose = 'для дали';
  } else if (text.includes('ДЛЯ ПОСТІЙНОГО') || text.includes('ПОСТІЙНОГО НОСІННЯ')) {
    prescription.purpose = 'для постоянного ношения';
  }
  
  return prescription;
}

// Функция для нормализации назначения рецепта
function normalizePurpose(purposeText) {
  if (!purposeText) return null;
  
  const text = String(purposeText).toLowerCase().trim();
  
  if (text.includes('далі') || text.includes('даль')) {
    return 'для дали';
  } else if (text.includes('читання') || text.includes('близі') || text.includes('близь')) {
    return 'для читання';
  } else if (text.includes('постійного') || text.includes('постоянного')) {
    return 'для постоянного ношения';
  }
  
  return null;
}

async function importOrdersFromExcel() {
  try {
    console.log('🔌 Подключение к MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключено к MongoDB');

    // Находим системного пользователя для импорта
    let systemUser = await User.findOne({ email: 'system.import@optica.com' });
    
    if (!systemUser) {
      console.log('📝 Создание системного пользователя для импорта...');
      systemUser = await User.create({
        email: 'system.import@optica.com',
        name: 'System Import',
        password: 'system-import-' + Date.now(),
        role: 'admin',
        isActive: false
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
      const phoneRaw = row[8]; // Колонка I: Мобільний
      const frameBrand = row[4] ? String(row[4]).trim() : ''; // Колонка E: Назва оправи
      const lensBrand = row[5] ? String(row[5]).trim() : ''; // Колонка F: Бренд линзы
      const prescriptionText = row[6]; // Колонка G: Рецепт
      const purposeText = row[7]; // Колонка H: Призначення рецепту
      const orderDateRaw = row[10]; // Колонка K: Дата замовлення

      // Извлекаем и нормализуем телефон
      const firstPhone = extractFirstPhone(phoneRaw);
      const phone = normalizePhone(firstPhone);

      // Если нет телефона, пропускаем
      if (!phone) {
        skipped++;
        continue;
      }

      // Если нет данных о заказе (нет оправы, линз и рецепта), пропускаем
      if (!frameBrand && !lensBrand && !prescriptionText) {
        skipped++;
        continue;
      }

      try {
        // Ищем клиента по телефону
        const client = await Client.findOne({ phone });

        if (!client) {
          console.log(`⚠️  Строка ${i + 1}: Клиент с телефоном ${phone} не найден - пропущена`);
          skipped++;
          continue;
        }

        // Парсим рецепт
        const prescription = parsePrescription(prescriptionText);
        
        // Нормализуем назначение рецепта
        const purpose = normalizePurpose(purposeText) || prescription?.purpose;

        // Парсим дату заказа
        let orderDate = null;
        if (orderDateRaw) {
          // Excel хранит даты как числа (дни с 1900-01-01)
          if (typeof orderDateRaw === 'number') {
            // Конвертируем Excel дату в JavaScript Date
            const excelEpoch = new Date(1899, 11, 30);
            orderDate = new Date(excelEpoch.getTime() + orderDateRaw * 86400000);
          } else {
            // Пробуем распарсить как строку
            orderDate = new Date(orderDateRaw);
            if (isNaN(orderDate.getTime())) {
              orderDate = null;
            }
          }
        }

        // Создаем заказ
        const orderData = {
          clientId: client._id,
          employeeId: systemUser._id,
          productType: 'очки', // По умолчанию очки
          status: 'выдан', // Старые заказы считаем выданными
          paymentStatus: 'оплачен', // Старые заказы считаем оплаченными
          totalPrice: 0, // Цена неизвестна
          createdBy: systemUser._id
        };
        
        // Добавляем дату заказа если есть
        if (orderDate) {
          orderData.orderDate = orderDate;
        }

        // Добавляем информацию об оправе
        if (frameBrand) {
          orderData.frame = {
            brand: frameBrand
          };
        }

        // Добавляем информацию о линзах
        if (lensBrand) {
          orderData.lenses = {
            brand: lensBrand
          };
        }

        // Добавляем рецепт
        if (prescription && (prescription.rightEye.sphere !== undefined || prescription.leftEye.sphere !== undefined)) {
          orderData.prescription = {
            rightEye: prescription.rightEye,
            leftEye: prescription.leftEye
          };
          
          if (prescription.pd) {
            orderData.prescription.pd = prescription.pd;
          }
          
          if (purpose) {
            orderData.prescription.purpose = purpose;
          }
        }

        // Создаем заказ
        const newOrder = new Order(orderData);
        await newOrder.save();
        
        console.log(`✅ Строка ${i + 1}: Заказ для ${client.name} (${phone}) - Импортирован`);
        imported++;
      } catch (error) {
        console.error(`❌ Строка ${i + 1}: Ошибка: ${error.message}`);
        errors++;
      }
    }

    console.log('\n📈 Результаты импорта заказов:');
    console.log(`✅ Импортировано: ${imported}`);
    console.log(`⚠️  Пропущено: ${skipped}`);
    console.log(`❌ Ошибок: ${errors}`);
    console.log(`📊 Всего обработано: ${data.length - 2} строк`);

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Соединение с MongoDB закрыто');
  }
}

// Запускаем импорт
importOrdersFromExcel();
