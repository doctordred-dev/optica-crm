const { Order, Client, ActionLog } = require('../models');
const logger = require('../utils/logger');
const smsService = require('../services/smsService');

// @desc    Получить все заказы
// @route   GET /api/orders
// @access  Private (manager+)
const getOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = '',
      clientId = '',
      employeeId = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Построение фильтра
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (clientId) {
      filter.clientId = clientId;
    }
    
    if (employeeId) {
      filter.employeeId = employeeId;
    }
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Настройка сортировки
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Пагинация
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Получение заказов
    const orders = await Order.find(filter)
      .populate('clientId', 'name phone')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip);

    // Подсчет общего количества
    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Ошибка получения заказов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении заказов'
    });
  }
};

// @desc    Получить заказ по ID
// @route   GET /api/orders/:id
// @access  Private (manager+)
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('clientId', 'name phone age source')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден'
      });
    }

    res.json({
      success: true,
      data: { order }
    });

  } catch (error) {
    logger.error('Ошибка получения заказа:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении заказа'
    });
  }
};

// @desc    Создать новый заказ
// @route   POST /api/orders
// @access  Private (manager+)
const createOrder = async (req, res) => {
  try {
    // Проверяем существование клиента
    const client = await Client.findById(req.body.clientId);
    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'Клиент не найден'
      });
    }

    const orderData = {
      ...req.body,
      employeeId: req.body.employeeId || req.user._id,
      createdBy: req.user._id
    };

    const order = await Order.create(orderData);

    // Популяция данных
    await order.populate([
      { path: 'clientId', select: 'name phone' },
      { path: 'employeeId', select: 'name email' },
      { path: 'createdBy', select: 'name email' }
    ]);

    // Логирование создания заказа
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'create_order',
      entityType: 'order',
      entityId: order._id,
      details: {
        newValues: orderData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Создан новый заказ для клиента: ${client.name}`);

    res.status(201).json({
      success: true,
      message: 'Заказ успешно создан',
      data: { order }
    });

  } catch (error) {
    logger.error('Ошибка создания заказа:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при создании заказа'
    });
  }
};

// @desc    Обновить заказ
// @route   PUT /api/orders/:id
// @access  Private (manager+)
const updateOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден'
      });
    }

    // Сохраняем старые значения для логирования
    const oldValues = order.toJSON();

    // Обновляем данные
    const updateData = {
      ...req.body,
      updatedBy: req.user._id
    };

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { 
        new: true, 
        runValidators: true 
      }
    ).populate([
      { path: 'clientId', select: 'name phone' },
      { path: 'employeeId', select: 'name email' },
      { path: 'createdBy', select: 'name email' },
      { path: 'updatedBy', select: 'name email' }
    ]);

    // Логирование обновления
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'update_order',
      entityType: 'order',
      entityId: order._id,
      details: {
        oldValues,
        newValues: updateData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Обновлен заказ: ${order._id}`);

    res.json({
      success: true,
      message: 'Заказ успешно обновлен',
      data: { order: updatedOrder }
    });

  } catch (error) {
    logger.error('Ошибка обновления заказа:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при обновлении заказа'
    });
  }
};

// @desc    Изменить статус заказа
// @route   PUT /api/orders/:id/status
// @access  Private (master+)
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const order = await Order.findById(req.params.id)
      .populate('clientId', 'name phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден'
      });
    }

    const oldStatus = order.status;
    
    // Обновляем статус
    order.status = status;
    order.updatedBy = req.user._id;
    
    // Если статус "готов", устанавливаем дату выдачи
    if (status === 'готов' && !order.deliveryDate) {
      order.deliveryDate = new Date();
    }
    
    await order.save();

    // Логирование изменения статуса
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'change_order_status',
      entityType: 'order',
      entityId: order._id,
      details: {
        oldValues: { status: oldStatus },
        newValues: { status },
        metadata: {
          clientName: order.clientId.name,
          clientPhone: order.clientId.phone
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Изменен статус заказа ${order._id}: ${oldStatus} -> ${status}`);

    // Если статус "готов", отправляем SMS уведомление
    if (status === 'готов') {
      try {
        const smsResult = await smsService.sendOrderReadyNotification(order, order.clientId);
        
        if (smsResult.success) {
          // Помечаем SMS как отправленное
          await order.markSMSSent();
          logger.info(`SMS уведомление отправлено клиенту: ${order.clientId.name} (${order.clientId.phone})`);
        } else {
          logger.error(`Ошибка отправки SMS: ${smsResult.error}`);
        }
      } catch (smsError) {
        logger.error('Ошибка при отправке SMS уведомления:', smsError);
      }
    }

    res.json({
      success: true,
      message: 'Статус заказа успешно изменен',
      data: { 
        order: {
          id: order._id,
          status: order.status,
          statusRu: order.statusRu,
          deliveryDate: order.deliveryDate
        }
      }
    });

  } catch (error) {
    logger.error('Ошибка изменения статуса заказа:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при изменении статуса заказа'
    });
  }
};

// @desc    Удалить заказ
// @route   DELETE /api/orders/:id
// @access  Private (admin only)
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('clientId', 'name phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден'
      });
    }

    // Проверяем, можно ли удалить заказ
    if (order.status === 'выдан') {
      return res.status(400).json({
        success: false,
        error: 'Нельзя удалить выданный заказ'
      });
    }

    // Сохраняем данные для логирования
    const orderData = order.toJSON();

    await Order.findByIdAndDelete(req.params.id);

    // Логирование удаления
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'delete_order',
      entityType: 'order',
      entityId: order._id,
      details: {
        oldValues: orderData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Удален заказ: ${order._id} для клиента ${order.clientId.name}`);

    res.json({
      success: true,
      message: 'Заказ успешно удален'
    });

  } catch (error) {
    logger.error('Ошибка удаления заказа:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при удалении заказа'
    });
  }
};

// @desc    Отправить SMS уведомление
// @route   POST /api/orders/:id/notify
// @access  Private (manager+)
const sendSMSNotification = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('clientId', 'name phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден'
      });
    }

    // Проверяем, что заказ готов
    if (order.status !== 'готов') {
      return res.status(400).json({
        success: false,
        error: 'SMS можно отправить только для готовых заказов'
      });
    }

    // Отправляем SMS уведомление
    const smsResult = await smsService.sendOrderReadyNotification(order, order.clientId);
    
    if (!smsResult.success) {
      return res.status(400).json({
        success: false,
        error: `Ошибка отправки SMS: ${smsResult.error}`
      });
    }

    // Помечаем SMS как отправленное
    await order.markSMSSent();

    // Логирование отправки SMS
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'send_sms',
      entityType: 'order',
      entityId: order._id,
      details: {
        metadata: {
          clientName: order.clientId.name,
          clientPhone: order.clientId.phone,
          orderStatus: order.status
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`SMS отправлено клиенту: ${order.clientId.name} (${order.clientId.phone})`);

    res.json({
      success: true,
      message: 'SMS уведомление отправлено',
      data: {
        sentAt: order.smsNotificationDate,
        clientPhone: order.clientId.phone
      }
    });

  } catch (error) {
    logger.error('Ошибка отправки SMS:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при отправке SMS'
    });
  }
};

module.exports = {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  sendSMSNotification
};
