const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Тип товара
  type: {
    type: String,
    required: [true, 'Тип товара обязателен'],
    enum: {
      values: ['frame', 'lens', 'accessory', 'contact_lens'],
      message: 'Тип должен быть: frame (оправа), lens (линзы), accessory (аксессуар), contact_lens (МКЛ)'
    }
  },

  // Основная информация
  brand: {
    type: String,
    required: [true, 'Бренд обязателен'],
    trim: true,
    maxlength: [100, 'Бренд не может быть длиннее 100 символов']
  },
  model: {
    type: String,
    trim: true,
    maxlength: [100, 'Модель не может быть длиннее 100 символов']
  },
  name: {
    type: String,
    required: [true, 'Название товара обязательно'],
    trim: true,
    maxlength: [200, 'Название не может быть длиннее 200 символов']
  },
  description: {
    type: String,
    maxlength: [1000, 'Описание не может быть длиннее 1000 символов']
  },

  // Характеристики оправы
  frameSpecs: {
    material: {
      type: String,
      enum: ['пластик', 'металл', 'титан', 'комбинированный', 'другое']
    },
    color: String,
    size: String,
    shape: {
      type: String,
      enum: ['круглая', 'овальная', 'прямоугольная', 'квадратная', 'авиатор', 'кошачий глаз', 'другое']
    },
    gender: {
      type: String,
      enum: ['мужская', 'женская', 'унисекс', 'детская']
    }
  },

  // Характеристики линз
  lensSpecs: {
    type: {
      type: String,
      enum: ['однофокальные', 'прогрессивные', 'бифокальные', 'другое']
    },
    material: {
      type: String,
      enum: ['пластик', 'поликарбонат', 'стекло', 'тривекс', 'другое']
    },
    coating: [{
      type: String,
      enum: ['фотохром', 'UV-защита', 'антиблик', 'антистатик', 'гидрофобное', 'другое']
    }],
    index: {
      type: Number,
      min: [1.0, 'Индекс преломления не может быть меньше 1.0'],
      max: [2.0, 'Индекс преломления не может быть больше 2.0']
    }
  },

  // Цена и наличие
  price: {
    type: Number,
    required: [true, 'Цена обязательна'],
    min: [0, 'Цена не может быть отрицательной']
  },
  costPrice: {
    type: Number,
    min: [0, 'Себестоимость не может быть отрицательной']
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Остаток не может быть отрицательным']
  },
  minStock: {
    type: Number,
    default: 0,
    min: [0, 'Минимальный остаток не может быть отрицательным']
  },

  // SKU и штрихкод
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  barcode: {
    type: String,
    trim: true
  },

  // Изображения
  images: [{
    url: String,
    alt: String,
    isPrimary: Boolean
  }],

  // Статус
  isActive: {
    type: Boolean,
    default: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },

  // Теги для поиска
  tags: [String],

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

// Индексы для быстрого поиска
productSchema.index({ type: 1, isActive: 1 });
productSchema.index({ brand: 1, model: 1 });
productSchema.index({ name: 'text', brand: 'text', model: 'text', tags: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ sku: 1 });

// Виртуальное поле для маржи
productSchema.virtual('margin').get(function() {
  if (!this.costPrice || !this.price) return 0;
  return this.price - this.costPrice;
});

// Виртуальное поле для процента маржи
productSchema.virtual('marginPercent').get(function() {
  if (!this.costPrice || !this.price || this.costPrice === 0) return 0;
  return ((this.price - this.costPrice) / this.costPrice) * 100;
});

// Виртуальное поле для проверки низкого остатка
productSchema.virtual('isLowStock').get(function() {
  return this.stock <= this.minStock;
});

// Виртуальное поле для полного названия
productSchema.virtual('fullName').get(function() {
  const parts = [this.brand, this.model, this.name].filter(Boolean);
  return parts.join(' ');
});

// Middleware для автоматической генерации SKU
productSchema.pre('save', async function(next) {
  if (!this.sku && this.isNew) {
    // Генерируем SKU: TYPE-BRAND-TIMESTAMP
    const typePrefix = {
      frame: 'FR',
      lens: 'LN',
      accessory: 'AC',
      contact_lens: 'CL'
    };
    
    const prefix = typePrefix[this.type] || 'PR';
    const brandCode = this.brand.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    
    this.sku = `${prefix}-${brandCode}-${timestamp}`;
  }
  next();
});

// Статический метод для поиска товаров
productSchema.statics.searchProducts = function(query, filters = {}) {
  const searchFilter = { isActive: true, ...filters };
  
  if (query) {
    searchFilter.$text = { $search: query };
  }
  
  return this.find(searchFilter)
    .select('-__v')
    .sort({ score: { $meta: 'textScore' } })
    .limit(50);
};

// Статический метод для получения популярных товаров
productSchema.statics.getPopularProducts = async function(type, limit = 10) {
  const Order = mongoose.model('Order');
  
  const field = type === 'frame' ? 'frame.brand' : 'lenses.brand';
  
  const popular = await Order.aggregate([
    {
      $match: {
        status: 'выдан',
        [field]: { $exists: true, $ne: null, $ne: '' }
      }
    },
    {
      $group: {
        _id: `$${field}`,
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
  
  const brands = popular.map(p => p._id);
  
  return this.find({
    type: type,
    brand: { $in: brands },
    isActive: true
  }).limit(limit);
};

// Метод для обновления остатка
productSchema.methods.updateStock = function(quantity, operation = 'subtract') {
  if (operation === 'subtract') {
    this.stock = Math.max(0, this.stock - quantity);
  } else if (operation === 'add') {
    this.stock += quantity;
  }
  return this.save();
};

// Настройки JSON вывода
productSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    // Скрываем себестоимость для не-админов (можно добавить проверку роли)
    // delete ret.costPrice;
    return ret;
  }
});

module.exports = mongoose.model('Product', productSchema);
