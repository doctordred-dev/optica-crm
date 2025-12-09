const { Order, Client } = require('../models');
const logger = require('../utils/logger');

// Функция для конвертации JSON в CSV
const jsonToCSV = (data, headers) => {
  if (!data || data.length === 0) {
    return '';
  }

  // Заголовки
  const csvHeaders = headers.join(',');
  
  // Данные
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // Экранируем запятые и кавычки
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });

  return [csvHeaders, ...csvRows].join('\n');
};

// @desc    Экспорт клиентов в CSV
// @route   GET /api/export/clients
// @access  Private (manager+)
const exportClients = async (req, res) => {
  try {
    console.log('[EXPORT v2.0] exportClients called from:', req.headers.origin);
    // Явно устанавливаем CORS заголовки для экспорта
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    console.log('[EXPORT v2.0] CORS headers set for exportClients');
    
    const {
      source = '',
      ageMin = '',
      ageMax = '',
      createdFrom = '',
      createdTo = ''
    } = req.query;

    // Построение фильтра
    const filter = {};
    
    if (source) filter.source = source;
    
    if (ageMin || ageMax) {
      filter.age = {};
      if (ageMin) filter.age.$gte = parseInt(ageMin);
      if (ageMax) filter.age.$lte = parseInt(ageMax);
    }
    
    if (createdFrom || createdTo) {
      filter.createdAt = {};
      if (createdFrom) filter.createdAt.$gte = new Date(createdFrom);
      if (createdTo) filter.createdAt.$lte = new Date(createdTo);
    }

    // Получаем клиентов
    const clients = await Client.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Получаем статистику заказов для каждого клиента
    const clientsWithStats = await Promise.all(
      clients.map(async (client) => {
        const Order = require('../models/Order');
        const orders = await Order.find({ clientId: client._id });
        
        const totalOrders = orders.length;
        const totalSpent = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
        const lastOrder = orders.length > 0 ? orders[orders.length - 1].createdAt : null;

        return {
          'ID': client._id.toString(),
          'Имя': client.name,
          'Телефон': client.phone,
          'Возраст': client.age || '',
          'Дата рождения': client.birthDate ? new Date(client.birthDate).toLocaleDateString('ru-RU') : '',
          'Источник': client.source || '',
          'Комментарии': client.comments || '',
          'Всего заказов': totalOrders,
          'Общая сумма': totalSpent,
          'Последний заказ': lastOrder ? new Date(lastOrder).toLocaleDateString('ru-RU') : '',
          'Создан': new Date(client.createdAt).toLocaleDateString('ru-RU'),
          'Создал': client.createdBy?.name || ''
        };
      })
    );

    const headers = [
      'ID', 'Имя', 'Телефон', 'Возраст', 'Дата рождения', 'Источник', 
      'Комментарии', 'Всего заказов', 'Общая сумма', 'Последний заказ', 
      'Создан', 'Создал'
    ];

    const csv = jsonToCSV(clientsWithStats, headers);

    // Устанавливаем заголовки для скачивания файла
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=clients_${Date.now()}.csv`);
    
    // Добавляем BOM для корректного отображения кириллицы в Excel
    res.write('\uFEFF');
    res.send(csv);

    logger.info(`Экспорт клиентов выполнен пользователем ${req.user.email}`);

  } catch (error) {
    logger.error('Ошибка экспорта клиентов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при экспорте клиентов'
    });
  }
};

// @desc    Экспорт заказов в CSV
// @route   GET /api/export/orders
// @access  Private (manager+)
const exportOrders = async (req, res) => {
  try {
    // Явно устанавливаем CORS заголовки для экспорта
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const {
      status = '',
      clientId = '',
      employeeId = '',
      startDate = '',
      endDate = ''
    } = req.query;

    // Построение фильтра
    const filter = {};
    
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;
    if (employeeId) filter.employeeId = employeeId;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Получаем заказы
    const orders = await Order.find(filter)
      .populate('clientId', 'name phone')
      .populate('employeeId', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Форматируем данные для CSV
    const ordersData = orders.map(order => {
      const discountAmount = (order.totalPrice * (order.discount || 0)) / 100;
      const finalPrice = order.totalPrice - discountAmount;
      const remainingPayment = Math.max(0, finalPrice - (order.prepayment || 0));

      return {
        'ID заказа': order._id.toString().slice(-8),
        'Клиент': order.clientId?.name || '',
        'Телефон': order.clientId?.phone || '',
        'Сотрудник': order.employeeId?.name || '',
        'Дата заказа': new Date(order.orderDate).toLocaleDateString('ru-RU'),
        'Дата выдачи': order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('ru-RU') : '',
        'Тип изделия': order.productType || '',
        'Бренд оправы': order.frame?.brand || '',
        'Модель оправы': order.frame?.model || '',
        'Цена оправы': order.frame?.price || 0,
        'Бренд линз': order.lenses?.brand || '',
        'Тип линз': order.lenses?.type || '',
        'Цена линз': order.lenses?.price || 0,
        'Общая стоимость': order.totalPrice || 0,
        'Скидка %': order.discount || 0,
        'Скидка сумма': discountAmount,
        'Итого': finalPrice,
        'Предоплата': order.prepayment || 0,
        'К доплате': remainingPayment,
        'Способ оплаты': order.paymentMethod || '',
        'Статус оплаты': order.paymentStatus || '',
        'Статус заказа': order.status || '',
        'Комментарий мастера': order.masterComments || '',
        'Комментарий к заказу': order.orderComments || '',
        'Создан': new Date(order.createdAt).toLocaleDateString('ru-RU'),
        'Создал': order.createdBy?.name || ''
      };
    });

    const headers = [
      'ID заказа', 'Клиент', 'Телефон', 'Сотрудник', 'Дата заказа', 'Дата выдачи',
      'Тип изделия', 'Бренд оправы', 'Модель оправы', 'Цена оправы',
      'Бренд линз', 'Тип линз', 'Цена линз', 'Общая стоимость', 'Скидка %',
      'Скидка сумма', 'Итого', 'Предоплата', 'К доплате', 'Способ оплаты',
      'Статус оплаты', 'Статус заказа', 'Комментарий мастера', 
      'Комментарий к заказу', 'Создан', 'Создал'
    ];

    const csv = jsonToCSV(ordersData, headers);

    // Устанавливаем заголовки для скачивания файла
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=orders_${Date.now()}.csv`);
    
    // Добавляем BOM для корректного отображения кириллицы в Excel
    res.write('\uFEFF');
    res.send(csv);

    logger.info(`Экспорт заказов выполнен пользователем ${req.user.email}`);

  } catch (error) {
    logger.error('Ошибка экспорта заказов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при экспорте заказов'
    });
  }
};

// @desc    Экспорт аналитики продаж в CSV
// @route   GET /api/export/sales
// @access  Private (manager+)
const exportSales = async (req, res) => {
  try {
    // Явно устанавливаем CORS заголовки для экспорта
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Получаем статистику продаж по дням
    const salesByDay = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $ne: 'отменен' }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' },
          avgOrderValue: { $avg: '$totalPrice' },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'выдан'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const salesData = salesByDay.map(day => ({
      'Дата': day._id,
      'Всего заказов': day.totalOrders,
      'Выполнено': day.completedOrders,
      'Общая выручка': Math.round(day.totalRevenue),
      'Средний чек': Math.round(day.avgOrderValue)
    }));

    const headers = ['Дата', 'Всего заказов', 'Выполнено', 'Общая выручка', 'Средний чек'];
    const csv = jsonToCSV(salesData, headers);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=sales_${Date.now()}.csv`);
    res.write('\uFEFF');
    res.send(csv);

    logger.info(`Экспорт продаж выполнен пользователем ${req.user.email}`);

  } catch (error) {
    logger.error('Ошибка экспорта продаж:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при экспорте продаж'
    });
  }
};

module.exports = {
  exportClients,
  exportOrders,
  exportSales
};
