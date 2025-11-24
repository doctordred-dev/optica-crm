const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const productsController = require('../controllers/productsController');

// Все роуты требуют аутентификации
router.use(authenticate);

// @route   GET /api/products/low-stock
// @desc    Получить товары с низким остатком
// @access  Private (manager+)
router.get('/low-stock', authorize('admin', 'manager'), productsController.getLowStockProducts);

// @route   GET /api/products/popular/:type
// @desc    Получить популярные товары
// @access  Private
router.get('/popular/:type', productsController.getPopularProducts);

// @route   GET /api/products
// @desc    Получить все товары
// @access  Private
router.get('/', productsController.getProducts);

// @route   GET /api/products/:id
// @desc    Получить товар по ID
// @access  Private
router.get('/:id', productsController.getProduct);

// @route   POST /api/products
// @desc    Создать товар
// @access  Private (manager+)
router.post('/', authorize('admin', 'manager'), productsController.createProduct);

// @route   PUT /api/products/:id
// @desc    Обновить товар
// @access  Private (manager+)
router.put('/:id', authorize('admin', 'manager'), productsController.updateProduct);

// @route   PATCH /api/products/:id/stock
// @desc    Обновить остаток товара
// @access  Private (manager+)
router.patch('/:id/stock', authorize('admin', 'manager'), productsController.updateStock);

// @route   DELETE /api/products/:id
// @desc    Удалить товар (деактивировать)
// @access  Private (admin)
router.delete('/:id', authorize('admin'), productsController.deleteProduct);

module.exports = router;
