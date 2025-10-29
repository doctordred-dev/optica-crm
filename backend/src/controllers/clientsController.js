const { Client, ActionLog } = require('../models');
const logger = require('../utils/logger');

// @desc    Получить всех клиентов
// @route   GET /api/clients
// @access  Private (manager+)
const getClients = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      source = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Построение фильтра поиска
    const searchFilter = {};
    
    if (search) {
      searchFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (source) {
      searchFilter.source = source;
    }

    // Настройка сортировки
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Пагинация
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Получение клиентов
    const clients = await Client.find(searchFilter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip);

    // Подсчет общего количества
    const total = await Client.countDocuments(searchFilter);

    // Добавляем статистику заказов для каждого клиента
    const clientsWithStats = await Promise.all(
      clients.map(async (client) => {
        const stats = await client.getStats();
        return {
          ...client.toJSON(),
          stats
        };
      })
    );

    res.json({
      success: true,
      data: {
        clients: clientsWithStats,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Ошибка получения клиентов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении клиентов'
    });
  }
};

// @desc    Получить клиента по ID
// @route   GET /api/clients/:id
// @access  Private (manager+)
const getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Клиент не найден'
      });
    }

    // Получаем статистику клиента
    const stats = await client.getStats();

    res.json({
      success: true,
      data: {
        client: {
          ...client.toJSON(),
          stats
        }
      }
    });

  } catch (error) {
    logger.error('Ошибка получения клиента:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении клиента'
    });
  }
};

// @desc    Создать нового клиента
// @route   POST /api/clients
// @access  Private (manager+)
const createClient = async (req, res) => {
  try {
    const clientData = {
      ...req.body,
      createdBy: req.user._id
    };

    const client = await Client.create(clientData);

    // Популяция данных создателя
    await client.populate('createdBy', 'name email');

    // Логирование создания клиента
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'create_client',
      entityType: 'client',
      entityId: client._id,
      details: {
        newValues: clientData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Создан новый клиент: ${client.name} (${client.phone})`);

    res.status(201).json({
      success: true,
      message: 'Клиент успешно создан',
      data: { client }
    });

  } catch (error) {
    logger.error('Ошибка создания клиента:', error);
    
    // Обработка ошибки дублирования телефона
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Клиент с таким номером телефона уже существует'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при создании клиента'
    });
  }
};

// @desc    Обновить клиента
// @route   PUT /api/clients/:id
// @access  Private (manager+)
const updateClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Клиент не найден'
      });
    }

    // Сохраняем старые значения для логирования
    const oldValues = client.toJSON();

    // Обновляем данные
    const updateData = {
      ...req.body,
      updatedBy: req.user._id
    };

    const updatedClient = await Client.findByIdAndUpdate(
      req.params.id,
      updateData,
      { 
        new: true, 
        runValidators: true 
      }
    ).populate('createdBy updatedBy', 'name email');

    // Логирование обновления
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'update_client',
      entityType: 'client',
      entityId: client._id,
      details: {
        oldValues,
        newValues: updateData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Обновлен клиент: ${updatedClient.name} (${updatedClient.phone})`);

    res.json({
      success: true,
      message: 'Клиент успешно обновлен',
      data: { client: updatedClient }
    });

  } catch (error) {
    logger.error('Ошибка обновления клиента:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Клиент с таким номером телефона уже существует'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при обновлении клиента'
    });
  }
};

// @desc    Удалить клиента
// @route   DELETE /api/clients/:id
// @access  Private (admin only)
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Клиент не найден'
      });
    }

    // Проверяем, есть ли у клиента заказы
    const { Order } = require('../models');
    const ordersCount = await Order.countDocuments({ clientId: client._id });

    if (ordersCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Нельзя удалить клиента, у которого есть заказы (${ordersCount})`
      });
    }

    // Сохраняем данные для логирования
    const clientData = client.toJSON();

    await Client.findByIdAndDelete(req.params.id);

    // Логирование удаления
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'delete_client',
      entityType: 'client',
      entityId: client._id,
      details: {
        oldValues: clientData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Удален клиент: ${client.name} (${client.phone})`);

    res.json({
      success: true,
      message: 'Клиент успешно удален'
    });

  } catch (error) {
    logger.error('Ошибка удаления клиента:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при удалении клиента'
    });
  }
};

// @desc    Поиск клиентов по телефону
// @route   GET /api/clients/search/phone/:phone
// @access  Private (manager+)
const searchByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    
    // Нормализуем номер телефона
    let normalizedPhone = phone.replace(/[^\d+]/g, '');
    
    if (normalizedPhone.startsWith('380')) {
      normalizedPhone = '+' + normalizedPhone;
    } else if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '+38' + normalizedPhone;
    }

    const client = await Client.findOne({ 
      phone: normalizedPhone
    }).populate('createdBy', 'name email');

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Клиент с таким номером не найден'
      });
    }

    // Получаем статистику клиента
    const stats = await client.getStats();

    res.json({
      success: true,
      data: {
        client: {
          ...client.toJSON(),
          stats
        }
      }
    });

  } catch (error) {
    logger.error('Ошибка поиска клиента по телефону:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при поиске клиента'
    });
  }
};

// @desc    Получить заказы клиента
// @route   GET /api/clients/:id/orders
// @access  Private (manager+)
const getClientOrders = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Клиент не найден'
      });
    }

    const { Order } = require('../models');
    const orders = await Order.find({ clientId: client._id })
      .populate('employeeId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        client: {
          id: client._id,
          name: client.name,
          phone: client.phone
        },
        orders
      }
    });

  } catch (error) {
    logger.error('Ошибка получения заказов клиента:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении заказов'
    });
  }
};

module.exports = {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  searchByPhone,
  getClientOrders
};
