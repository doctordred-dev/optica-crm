const { SMSTemplate, ActionLog } = require('../models');
const logger = require('../utils/logger');
const smsService = require('../services/smsService');

// @desc    Получить все SMS шаблоны
// @route   GET /api/sms/templates
// @access  Private (admin+)
const getTemplates = async (req, res) => {
  try {
    const templates = await SMSTemplate.find()
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { templates }
    });

  } catch (error) {
    logger.error('Ошибка получения SMS шаблонов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении шаблонов'
    });
  }
};

// @desc    Создать SMS шаблон
// @route   POST /api/sms/templates
// @access  Private (admin+)
const createTemplate = async (req, res) => {
  try {
    const templateData = {
      ...req.body,
      createdBy: req.user._id
    };

    const template = await SMSTemplate.create(templateData);
    await template.populate('createdBy', 'name email');

    // Логирование создания шаблона
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'create_sms_template',
      entityType: 'sms_template',
      entityId: template._id,
      details: {
        newValues: templateData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Создан SMS шаблон: ${template.name}`);

    res.status(201).json({
      success: true,
      message: 'SMS шаблон успешно создан',
      data: { template }
    });

  } catch (error) {
    logger.error('Ошибка создания SMS шаблона:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Шаблон с таким названием уже существует'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при создании шаблона'
    });
  }
};

// @desc    Обновить SMS шаблон
// @route   PUT /api/sms/templates/:id
// @access  Private (admin+)
const updateTemplate = async (req, res) => {
  try {
    const template = await SMSTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'SMS шаблон не найден'
      });
    }

    const oldValues = template.toJSON();
    
    const updateData = {
      ...req.body,
      updatedBy: req.user._id
    };

    const updatedTemplate = await SMSTemplate.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy updatedBy', 'name email');

    // Логирование обновления
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'update_sms_template',
      entityType: 'sms_template',
      entityId: template._id,
      details: {
        oldValues,
        newValues: updateData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Обновлен SMS шаблон: ${updatedTemplate.name}`);

    res.json({
      success: true,
      message: 'SMS шаблон успешно обновлен',
      data: { template: updatedTemplate }
    });

  } catch (error) {
    logger.error('Ошибка обновления SMS шаблона:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при обновлении шаблона'
    });
  }
};

// @desc    Удалить SMS шаблон
// @route   DELETE /api/sms/templates/:id
// @access  Private (admin only)
const deleteTemplate = async (req, res) => {
  try {
    const template = await SMSTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'SMS шаблон не найден'
      });
    }

    const templateData = template.toJSON();
    await SMSTemplate.findByIdAndDelete(req.params.id);

    // Логирование удаления
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'other',
      entityType: 'sms_template',
      entityId: template._id,
      details: {
        oldValues: templateData,
        metadata: { action: 'delete_sms_template' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Удален SMS шаблон: ${template.name}`);

    res.json({
      success: true,
      message: 'SMS шаблон успешно удален'
    });

  } catch (error) {
    logger.error('Ошибка удаления SMS шаблона:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при удалении шаблона'
    });
  }
};

// @desc    Тестовая отправка SMS
// @route   POST /api/sms/test
// @access  Private (admin+)
const sendTestSMS = async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Номер телефона и сообщение обязательны'
      });
    }

    const result = await smsService.sendSMS(phone, message);

    // Логирование тестовой отправки
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'send_sms',
      entityType: 'other',
      details: {
        metadata: {
          phone,
          message: message.substring(0, 50) + '...',
          testSMS: true,
          result: result.success
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      success: result.success
    });

    if (result.success) {
      logger.info(`Тестовое SMS отправлено на ${phone}`);
    } else {
      logger.error(`Ошибка отправки тестового SMS: ${result.error}`);
    }

    res.json({
      success: result.success,
      message: result.success ? 'SMS успешно отправлено' : 'Ошибка отправки SMS',
      data: result
    });

  } catch (error) {
    logger.error('Ошибка тестовой отправки SMS:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при отправке SMS'
    });
  }
};

// @desc    Проверить баланс TurboSMS
// @route   GET /api/sms/balance
// @access  Private (admin+)
const getBalance = async (req, res) => {
  try {
    const balance = await smsService.getBalance();

    res.json({
      success: balance.success,
      data: balance.success ? {
        balance: balance.balance,
        currency: balance.currency
      } : null,
      error: balance.success ? null : balance.error
    });

  } catch (error) {
    logger.error('Ошибка получения баланса:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении баланса'
    });
  }
};

// @desc    Проверить статус SMS сервиса
// @route   GET /api/sms/status
// @access  Private (admin+)
const getServiceStatus = async (req, res) => {
  try {
    const isAvailable = await smsService.isServiceAvailable();

    res.json({
      success: true,
      data: {
        service: 'TurboSMS',
        available: isAvailable,
        configured: !!(process.env.TURBOSMS_LOGIN && process.env.TURBOSMS_PASSWORD)
      }
    });

  } catch (error) {
    logger.error('Ошибка проверки статуса SMS сервиса:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при проверке статуса'
    });
  }
};

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendTestSMS,
  getBalance,
  getServiceStatus
};
