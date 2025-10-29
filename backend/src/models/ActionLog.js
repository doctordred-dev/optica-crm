const mongoose = require('mongoose');

const actionLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Пользователь обязателен']
  },
  action: {
    type: String,
    required: [true, 'Действие обязательно'],
    enum: {
      values: [
        // Действия с клиентами
        'create_client',
        'update_client',
        'delete_client',
        
        // Действия с заказами
        'create_order',
        'update_order',
        'delete_order',
        'change_order_status',
        
        // SMS действия
        'send_sms',
        'create_sms_template',
        'update_sms_template',
        
        // Аутентификация
        'login',
        'logout',
        'failed_login',
        
        // Системные действия
        'export_data',
        'import_data',
        'backup_created',
        
        // Другие
        'other'
      ],
      message: 'Неверный тип действия'
    }
  },
  entityType: {
    type: String,
    enum: ['client', 'order', 'user', 'sms_template', 'system', 'other'],
    required: [true, 'Тип сущности обязателен']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    // Не делаем required, так как некоторые действия могут не иметь связанной сущности
  },
  details: {
    // Дополнительная информация о действии
    oldValues: mongoose.Schema.Types.Mixed,  // Старые значения (для update)
    newValues: mongoose.Schema.Types.Mixed,  // Новые значения (для update/create)
    metadata: mongoose.Schema.Types.Mixed,   // Дополнительные данные
    ipAddress: String,                       // IP адрес пользователя
    userAgent: String,                       // User Agent браузера
    errorMessage: String                     // Сообщение об ошибке (если есть)
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  success: {
    type: Boolean,
    default: true
  }
}, {
  // Отключаем автоматические timestamps, используем свой timestamp
  timestamps: false
});

// Индексы для быстрого поиска
actionLogSchema.index({ userId: 1, timestamp: -1 });
actionLogSchema.index({ action: 1, timestamp: -1 });
actionLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
actionLogSchema.index({ timestamp: -1 });
actionLogSchema.index({ success: 1, timestamp: -1 });

// Виртуальное поле для действия на русском
actionLogSchema.virtual('actionRu').get(function() {
  const actions = {
    create_client: 'Создание клиента',
    update_client: 'Обновление клиента',
    delete_client: 'Удаление клиента',
    create_order: 'Создание заказа',
    update_order: 'Обновление заказа',
    delete_order: 'Удаление заказа',
    change_order_status: 'Изменение статуса заказа',
    send_sms: 'Отправка SMS',
    create_sms_template: 'Создание SMS шаблона',
    update_sms_template: 'Обновление SMS шаблона',
    login: 'Вход в систему',
    logout: 'Выход из системы',
    failed_login: 'Неудачная попытка входа',
    export_data: 'Экспорт данных',
    import_data: 'Импорт данных',
    backup_created: 'Создание резервной копии',
    other: 'Другое действие'
  };
  return actions[this.action] || this.action;
});

// Статический метод для создания лога
actionLogSchema.statics.createLog = function(logData) {
  return this.create({
    userId: logData.userId,
    action: logData.action,
    entityType: logData.entityType,
    entityId: logData.entityId,
    details: {
      oldValues: logData.oldValues,
      newValues: logData.newValues,
      metadata: logData.metadata,
      ipAddress: logData.ipAddress,
      userAgent: logData.userAgent,
      errorMessage: logData.errorMessage
    },
    success: logData.success !== false // По умолчанию true
  });
};

// Статический метод для получения логов пользователя
actionLogSchema.statics.getUserLogs = function(userId, limit = 50, skip = 0) {
  return this.find({ userId })
    .populate('userId', 'name email role')
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip);
};

// Статический метод для получения логов по сущности
actionLogSchema.statics.getEntityLogs = function(entityType, entityId, limit = 20) {
  return this.find({ entityType, entityId })
    .populate('userId', 'name email role')
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Статический метод для получения статистики действий
actionLogSchema.statics.getActionStats = function(startDate, endDate, filters = {}) {
  const matchStage = {
    timestamp: {
      $gte: startDate,
      $lte: endDate
    },
    ...filters
  };

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          action: '$action',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
        },
        count: { $sum: 1 },
        successCount: { $sum: { $cond: ['$success', 1, 0] } },
        errorCount: { $sum: { $cond: ['$success', 0, 1] } }
      }
    },
    { $sort: { '_id.date': -1, count: -1 } }
  ]);
};

// Middleware для автоматической очистки старых логов (опционально)
actionLogSchema.statics.cleanOldLogs = function(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  return this.deleteMany({
    timestamp: { $lt: cutoffDate }
  });
};

// Настройки JSON вывода
actionLogSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    // Скрываем чувствительную информацию в деталях
    if (ret.details && ret.details.oldValues && ret.details.oldValues.password) {
      ret.details.oldValues.password = '[СКРЫТО]';
    }
    if (ret.details && ret.details.newValues && ret.details.newValues.password) {
      ret.details.newValues.password = '[СКРЫТО]';
    }
    return ret;
  }
});

module.exports = mongoose.model('ActionLog', actionLogSchema);
