const mongoose = require('mongoose');

const smsTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Название шаблона обязательно'],
    unique: true,
    trim: true,
    maxlength: [100, 'Название не может быть длиннее 100 символов']
  },
  template: {
    type: String,
    required: [true, 'Текст шаблона обязателен'],
    maxlength: [160, 'SMS не может быть длиннее 160 символов'],
    validate: {
      validator: function(value) {
        // Проверяем, что в шаблоне есть хотя бы один плейсхолдер
        return /\{[^}]+\}/.test(value);
      },
      message: 'Шаблон должен содержать хотя бы один плейсхолдер в формате {название}'
    }
  },
  triggerEvent: {
    type: String,
    required: [true, 'Событие-триггер обязательно'],
    enum: {
      values: [
        'order_ready',      // заказ готов
        'order_delivered',  // заказ выдан
        'payment_reminder', // напоминание об оплате
        'custom'           // произвольное
      ],
      message: 'Неверное событие-триггер'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    maxlength: [200, 'Описание не может быть длиннее 200 символов']
  },
  // Доступные плейсхолдеры для этого шаблона
  availablePlaceholders: [{
    type: String,
    enum: [
      'clientName',     // имя клиента
      'orderNumber',    // номер заказа
      'deliveryDate',   // дата выдачи
      'totalPrice',     // общая стоимость
      'remainingPayment', // остаток к доплате
      'shopName',       // название магазина
      'shopPhone',      // телефон магазина
      'shopAddress'     // адрес магазина
    ]
  }],
  // Статистика использования
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date
  },
  // Метаданные
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Индексы
smsTemplateSchema.index({ triggerEvent: 1, isActive: 1 });
smsTemplateSchema.index({ name: 1 });

// Метод для рендеринга шаблона с данными
smsTemplateSchema.methods.render = function(data = {}) {
  let message = this.template;
  
  // Заменяем плейсхолдеры на реальные данные
  const placeholders = {
    clientName: data.clientName || 'Клиент',
    orderNumber: data.orderNumber || 'Заказ',
    deliveryDate: data.deliveryDate ? 
      new Date(data.deliveryDate).toLocaleDateString('ru-RU') : 
      'не указана',
    totalPrice: data.totalPrice ? 
      `${data.totalPrice} грн` : 
      'не указана',
    remainingPayment: data.remainingPayment ? 
      `${data.remainingPayment} грн` : 
      '0 грн',
    shopName: data.shopName || 'Оптика',
    shopPhone: data.shopPhone || '+380XXXXXXXXX',
    shopAddress: data.shopAddress || 'адрес не указан'
  };
  
  // Заменяем все плейсхолдеры
  Object.keys(placeholders).forEach(key => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    message = message.replace(regex, placeholders[key]);
  });
  
  return message;
};

// Метод для увеличения счетчика использования
smsTemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save({ validateBeforeSave: false });
};

// Статический метод для получения активного шаблона по событию
smsTemplateSchema.statics.getActiveTemplate = function(triggerEvent) {
  return this.findOne({ 
    triggerEvent, 
    isActive: true 
  }).sort({ createdAt: -1 });
};

// Валидация перед сохранением
smsTemplateSchema.pre('save', function(next) {
  // Проверяем длину сообщения после рендеринга с максимальными значениями
  const testData = {
    clientName: 'Очень Длинное Имя Клиента',
    orderNumber: '999999',
    deliveryDate: new Date(),
    totalPrice: 999999,
    remainingPayment: 999999,
    shopName: 'Очень Длинное Название Магазина',
    shopPhone: '+380123456789',
    shopAddress: 'Очень Длинный Адрес Магазина'
  };
  
  const renderedMessage = this.render(testData);
  
  if (renderedMessage.length > 160) {
    return next(new Error(`Шаблон после рендеринга превышает 160 символов (${renderedMessage.length})`));
  }
  
  next();
});

module.exports = mongoose.model('SMSTemplate', smsTemplateSchema);
