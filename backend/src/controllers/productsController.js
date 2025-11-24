const { Product } = require('../models');
const logger = require('../utils/logger');

// @desc    Получить все товары
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      type = '',
      brand = '',
      minPrice = '',
      maxPrice = '',
      inStock = '',
      isActive = 'true',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Построение фильтра
    const filter = {};
    
    if (isActive !== '') {
      filter.isActive = isActive === 'true';
    }
    
    if (type) {
      filter.type = type;
    }
    
    if (brand) {
      filter.brand = { $regex: brand, $options: 'i' };
    }
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    if (inStock === 'true') {
      filter.stock = { $gt: 0 };
    } else if (inStock === 'false') {
      filter.stock = 0;
    }

    // Поиск по тексту
    if (search) {
      filter.$text = { $search: search };
    }

    // Настройка сортировки
    const sortOptions = {};
    if (search) {
      sortOptions.score = { $meta: 'textScore' };
    }
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Пагинация
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Получение товаров
    const products = await Product.find(filter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip);

    // Подсчет общего количества
    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Ошибка получения товаров:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении товаров'
    });
  }
};

// @desc    Получить товар по ID
// @route   GET /api/products/:id
// @access  Private
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Товар не найден'
      });
    }

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    logger.error('Ошибка получения товара:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении товара'
    });
  }
};

// @desc    Создать товар
// @route   POST /api/products
// @access  Private (manager+)
const createProduct = async (req, res) => {
  try {
    const productData = {
      ...req.body,
      createdBy: req.user._id
    };

    const product = await Product.create(productData);

    logger.info(`Товар создан: ${product.fullName} пользователем ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: product
    });

  } catch (error) {
    logger.error('Ошибка создания товара:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Товар с таким SKU уже существует'
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при создании товара'
    });
  }
};

// @desc    Обновить товар
// @route   PUT /api/products/:id
// @access  Private (manager+)
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Товар не найден'
      });
    }

    // Обновляем поля
    Object.keys(req.body).forEach(key => {
      if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
        product[key] = req.body[key];
      }
    });

    product.updatedBy = req.user._id;
    await product.save();

    logger.info(`Товар обновлен: ${product.fullName} пользователем ${req.user.email}`);

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    logger.error('Ошибка обновления товара:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при обновлении товара'
    });
  }
};

// @desc    Удалить товар (мягкое удаление)
// @route   DELETE /api/products/:id
// @access  Private (admin)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Товар не найден'
      });
    }

    // Мягкое удаление - просто деактивируем
    product.isActive = false;
    product.updatedBy = req.user._id;
    await product.save();

    logger.info(`Товар деактивирован: ${product.fullName} пользователем ${req.user.email}`);

    res.json({
      success: true,
      message: 'Товар успешно деактивирован'
    });

  } catch (error) {
    logger.error('Ошибка удаления товара:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при удалении товара'
    });
  }
};

// @desc    Обновить остаток товара
// @route   PATCH /api/products/:id/stock
// @access  Private (manager+)
const updateStock = async (req, res) => {
  try {
    const { quantity, operation = 'set' } = req.body;

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({
        success: false,
        error: 'Количество обязательно'
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Товар не найден'
      });
    }

    if (operation === 'set') {
      product.stock = quantity;
    } else if (operation === 'add') {
      product.stock += quantity;
    } else if (operation === 'subtract') {
      product.stock = Math.max(0, product.stock - quantity);
    }

    product.updatedBy = req.user._id;
    await product.save();

    logger.info(`Остаток товара обновлен: ${product.fullName}, новый остаток: ${product.stock}`);

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    logger.error('Ошибка обновления остатка:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при обновлении остатка'
    });
  }
};

// @desc    Получить популярные товары
// @route   GET /api/products/popular/:type
// @access  Private
const getPopularProducts = async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 10 } = req.query;

    if (!['frame', 'lens'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Тип должен быть frame или lens'
      });
    }

    const products = await Product.getPopularProducts(type, parseInt(limit));

    res.json({
      success: true,
      data: products
    });

  } catch (error) {
    logger.error('Ошибка получения популярных товаров:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении популярных товаров'
    });
  }
};

// @desc    Получить товары с низким остатком
// @route   GET /api/products/low-stock
// @access  Private (manager+)
const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', '$minStock'] }
    })
    .populate('createdBy', 'name')
    .sort({ stock: 1 });

    res.json({
      success: true,
      data: products
    });

  } catch (error) {
    logger.error('Ошибка получения товаров с низким остатком:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера'
    });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getPopularProducts,
  getLowStockProducts
};
