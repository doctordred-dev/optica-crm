const { Client, ActionLog } = require('../models');
const logger = require('../utils/logger');

// @desc    Получить всех клиентов
// @route   GET /api/clients
// @access  Private (manager+)
const getClients = async (req, res) => {
  let searchFilter = {}; // Объявляем здесь для доступа в catch
  
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      source = '',
      ageMin = '',
      ageMax = '',
      hasOrders = '',
      createdFrom = '',
      createdTo = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeStats = 'true'
    } = req.query;
    
    // Поиск по имени или телефону
    if (search) {
      // Проверяем, является ли поиск номером телефона
      const isPhone = /^\+?\d/.test(search);
      
      if (isPhone) {
        // Нормализуем номер для поиска
        const normalizedSearch = search.replace(/[^\d+]/g, '');
        searchFilter.phone = { $regex: normalizedSearch, $options: 'i' };
      } else {
        // Поиск по имени
        searchFilter.name = { $regex: search, $options: 'i' };
      }
    }

    // Фильтр по источнику
    if (source) {
      searchFilter.source = source;
    }

    // Фильтр по возрасту
    if (ageMin || ageMax) {
      searchFilter.age = {};
      if (ageMin) searchFilter.age.$gte = parseInt(ageMin);
      if (ageMax) searchFilter.age.$lte = parseInt(ageMax);
    }

    // Фильтр по дате создания
    if (createdFrom || createdTo) {
      searchFilter.createdAt = {};
      if (createdFrom) searchFilter.createdAt.$gte = new Date(createdFrom);
      if (createdTo) searchFilter.createdAt.$lte = new Date(createdTo);
    }

    // Настройка сортировки
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Пагинация
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Получение клиентов
    let clients = await Client.find(searchFilter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip);

    // Подсчет общего количества
    const total = await Client.countDocuments(searchFilter);

    // Фильтр по наличию заказов (после получения из БД)
    if (hasOrders !== '') {
      const Order = require('../models/Order');
      const clientIds = clients.map(c => c._id);
      
      const clientsWithOrders = await Order.distinct('clientId', {
        clientId: { $in: clientIds }
      });

      if (hasOrders === 'true') {
        clients = clients.filter(c => 
          clientsWithOrders.some(id => id.toString() === c._id.toString())
        );
      } else {
        clients = clients.filter(c => 
          !clientsWithOrders.some(id => id.toString() === c._id.toString())
        );
      }
    }

    // Добавляем статистику заказов для каждого клиента (опционально)
    let clientsData = clients;
    if (includeStats === 'true') {
      clientsData = await Promise.all(
        clients.map(async (client) => {
          const stats = await client.getStats();
          return {
            ...client.toJSON(),
            stats
          };
        })
      );
    } else {
      clientsData = clients.map(c => c.toJSON());
    }

    res.json({
      success: true,
      data: {
        clients: clientsData,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        },
        filters: {
          search,
          source,
          ageMin,
          ageMax,
          hasOrders,
          createdFrom,
          createdTo
        }
      }
    });

  } catch (error) {
    logger.error('Ошибка получения клиентов:', error);
    logger.error('Stack trace:', error.stack);
    logger.error('Search filter:', JSON.stringify(searchFilter));
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении клиентов',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
