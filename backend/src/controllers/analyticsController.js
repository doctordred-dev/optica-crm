const { Order, Client, User, ActionLog } = require('../models');
const logger = require('../utils/logger');

// @desc    Статистика продаж
// @route   GET /api/analytics/sales
// @access  Private (manager+)
const getSalesAnalytics = async (req, res) => {
  try {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 дней назад
      endDate = new Date(),
      groupBy = 'day' // day, week, month
    } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Формат группировки по датам
    const dateFormats = {
      day: '%Y-%m-%d',
      week: '%Y-W%U',
      month: '%Y-%m'
    };

    // Статистика продаж по периодам
    const salesByPeriod = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $ne: 'отменен' }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormats[groupBy] || dateFormats.day,
              date: '$createdAt'
            }
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' },
          avgOrderValue: { $avg: '$totalPrice' },
          totalDiscount: { $sum: { $multiply: ['$totalPrice', { $divide: ['$discount', 100] }] } },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'выдан'] }, 1, 0] }
          },
          inProgressOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'в_работе'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Общая статистика за период
    const totalStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $ne: 'отменен' }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' },
          avgOrderValue: { $avg: '$totalPrice' },
          maxOrderValue: { $max: '$totalPrice' },
          minOrderValue: { $min: '$totalPrice' },
          totalDiscount: { $sum: { $multiply: ['$totalPrice', { $divide: ['$discount', 100] }] } }
        }
      }
    ]);

    // Статистика по статусам
    const statusStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' }
        }
      }
    ]);

    // Статистика по способам оплаты
    const paymentStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'выдан'
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period: {
          startDate: start,
          endDate: end,
          groupBy
        },
        salesByPeriod,
        totalStats: totalStats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          maxOrderValue: 0,
          minOrderValue: 0,
          totalDiscount: 0
        },
        statusStats,
        paymentStats
      }
    });

  } catch (error) {
    logger.error('Ошибка получения статистики продаж:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении статистики продаж'
    });
  }
};

// @desc    Статистика по сотрудникам
// @route   GET /api/analytics/employees
// @access  Private (manager+)
const getEmployeesAnalytics = async (req, res) => {
  try {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Статистика по сотрудникам
    const employeeStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $ne: 'отменен' }
        }
      },
      {
        $group: {
          _id: '$employeeId',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' },
          avgOrderValue: { $avg: '$totalPrice' },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'выдан'] }, 1, 0] }
          },
          inProgressOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'в_работе'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'employee'
        }
      },
      {
        $unwind: '$employee'
      },
      {
        $project: {
          employeeId: '$_id',
          employeeName: '$employee.name',
          employeeEmail: '$employee.email',
          employeeRole: '$employee.role',
          totalOrders: 1,
          totalRevenue: 1,
          avgOrderValue: 1,
          completedOrders: 1,
          inProgressOrders: 1,
          conversionRate: {
            $cond: [
              { $eq: ['$totalOrders', 0] },
              0,
              { $multiply: [{ $divide: ['$completedOrders', '$totalOrders'] }, 100] }
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // Активность сотрудников (логи)
    const activityStats = await ActionLog.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$userId',
          totalActions: { $sum: 1 },
          successfulActions: {
            $sum: { $cond: ['$success', 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userId: '$_id',
          userName: '$user.name',
          totalActions: 1,
          successfulActions: 1,
          successRate: {
            $multiply: [{ $divide: ['$successfulActions', '$totalActions'] }, 100]
          }
        }
      },
      { $sort: { totalActions: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        period: {
          startDate: start,
          endDate: end
        },
        employeeStats,
        activityStats
      }
    });

  } catch (error) {
    logger.error('Ошибка получения статистики сотрудников:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении статистики сотрудников'
    });
  }
};

// @desc    Популярные бренды
// @route   GET /api/analytics/brands
// @access  Private (manager+)
const getBrandsAnalytics = async (req, res) => {
  try {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      limit = 20
    } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Популярные бренды оправ
    const frameBrands = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'выдан',
          'frame.brand': { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$frame.brand',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$frame.price' },
          avgPrice: { $avg: '$frame.price' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Популярные бренды линз
    const lensBrands = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'выдан',
          'lenses.brand': { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$lenses.brand',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$lenses.price' },
          avgPrice: { $avg: '$lenses.price' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Популярные типы изделий
    const productTypes = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'выдан'
        }
      },
      {
        $group: {
          _id: '$productType',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' },
          avgPrice: { $avg: '$totalPrice' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Популярные покрытия линз
    const coatings = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'выдан',
          'lenses.coating': { $exists: true, $ne: [] }
        }
      },
      { $unwind: '$lenses.coating' },
      {
        $group: {
          _id: '$lenses.coating',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        period: {
          startDate: start,
          endDate: end
        },
        frameBrands,
        lensBrands,
        productTypes,
        coatings
      }
    });

  } catch (error) {
    logger.error('Ошибка получения статистики брендов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении статистики брендов'
    });
  }
};

// @desc    Общая статистика (dashboard)
// @route   GET /api/analytics/overview
// @access  Private (manager+)
const getOverview = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Статистика за сегодня
    const todayStats = await Order.getOrderStats(today, now);

    // Статистика за текущий месяц
    const thisMonthStats = await Order.getOrderStats(thisMonth, now);

    // Статистика за прошлый месяц
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const lastMonthStats = await Order.getOrderStats(lastMonth, lastMonthEnd);

    // Общее количество клиентов
    const totalClients = await Client.countDocuments();

    // Новые клиенты за месяц
    const newClientsThisMonth = await Client.countDocuments({
      createdAt: { $gte: thisMonth }
    });

    // Активные заказы
    const activeOrders = await Order.countDocuments({
      status: { $in: ['в_работе', 'готов'] }
    });

    // Заказы требующие внимания (просрочены)
    const overdueOrders = await Order.countDocuments({
      status: { $in: ['в_работе', 'готов'] },
      deliveryDate: { $lt: now }
    });

    // Последние заказы
    const recentOrders = await Order.find()
      .populate('clientId', 'name phone')
      .populate('employeeId', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('clientId employeeId status totalPrice createdAt deliveryDate');

    // Топ клиенты
    const topClients = await Order.aggregate([
      {
        $match: {
          status: 'выдан'
        }
      },
      {
        $group: {
          _id: '$clientId',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalPrice' }
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: '$client' },
      {
        $project: {
          clientId: '$_id',
          clientName: '$client.name',
          clientPhone: '$client.phone',
          totalOrders: 1,
          totalSpent: 1
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        today: todayStats[0] || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, completedOrders: 0 },
        thisMonth: thisMonthStats[0] || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, completedOrders: 0 },
        lastMonth: lastMonthStats[0] || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, completedOrders: 0 },
        clients: {
          total: totalClients,
          newThisMonth: newClientsThisMonth
        },
        orders: {
          active: activeOrders,
          overdue: overdueOrders
        },
        recentOrders,
        topClients
      }
    });

  } catch (error) {
    logger.error('Ошибка получения общей статистики:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении общей статистики'
    });
  }
};

// @desc    Статистика по клиентам
// @route   GET /api/analytics/clients
// @access  Private (manager+)
const getClientsAnalytics = async (req, res) => {
  try {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Новые клиенты по периодам
    const newClientsByPeriod = await Client.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Источники привлечения
    const sourceStats = await Client.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Возрастная статистика
    const ageStats = await Client.aggregate([
      {
        $match: {
          age: { $exists: true, $ne: null }
        }
      },
      {
        $bucket: {
          groupBy: '$age',
          boundaries: [0, 18, 30, 45, 60, 100],
          default: 'unknown',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    // Клиенты с наибольшим количеством заказов
    const mostActiveClients = await Order.aggregate([
      {
        $group: {
          _id: '$clientId',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$totalPrice' },
          lastOrderDate: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: '$client' },
      {
        $project: {
          clientId: '$_id',
          clientName: '$client.name',
          clientPhone: '$client.phone',
          orderCount: 1,
          totalSpent: 1,
          lastOrderDate: 1,
          avgOrderValue: { $divide: ['$totalSpent', '$orderCount'] }
        }
      },
      { $sort: { orderCount: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      success: true,
      data: {
        period: {
          startDate: start,
          endDate: end
        },
        newClientsByPeriod,
        sourceStats,
        ageStats,
        mostActiveClients
      }
    });

  } catch (error) {
    logger.error('Ошибка получения статистики клиентов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении статистики клиентов'
    });
  }
};

module.exports = {
  getSalesAnalytics,
  getEmployeesAnalytics,
  getBrandsAnalytics,
  getOverview,
  getClientsAnalytics
};
