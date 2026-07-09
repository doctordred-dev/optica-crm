const { Client } = require('../models');
const logger = require('../utils/logger');
const claudeVisionService = require('../services/claudeVisionService');
const cloudinaryService = require('../services/cloudinaryService');
const { buildOrderDraft } = require('../utils/orderScanMapping');

// @desc    Розпізнати дані замовлення(нь) з фото бланків через Claude Vision
// @route   POST /api/orders/scan
// @access  Private (manager+)
const scanOrderPhotos = async (req, res) => {
  try {
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не завантажено жодного фото'
      });
    }

    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Клієнт обов\'язковий — оберіть клієнта перед скануванням фото'
      });
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'Клієнт не знайдений'
      });
    }

    const [rawPairs, photoUrls] = await Promise.all([
      claudeVisionService.extractOrderData(files),
      cloudinaryService.uploadOrderScanPhotos(files, clientId)
    ]);

    if (rawPairs.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'Не вдалося розпізнати жодної пари окулярів на фото. Спробуйте зробити чіткіше фото.'
      });
    }

    const drafts = rawPairs.map((pair) => buildOrderDraft(pair, client));

    logger.info(
      `Розпізнано ${drafts.length} пар(и) окулярів з фото для клієнта ${client.name} (${files.length} файл(ів))`
    );

    res.json({
      success: true,
      data: {
        pairs: drafts,
        photoUrls
      }
    });
  } catch (error) {
    logger.error('Помилка сканування фото замовлення:', error);

    if (error.status === 401 || error.status === 403) {
      return res.status(502).json({
        success: false,
        error: 'Помилка авторизації сервісу розпізнавання (перевірте налаштування API-ключа)'
      });
    }
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Забагато запитів до сервісу розпізнавання, спробуйте за хвилину'
      });
    }
    if (error.status >= 500 || error.status === 529) {
      return res.status(502).json({
        success: false,
        error: 'Сервіс розпізнавання тимчасово недоступний, спробуйте пізніше'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Помилка сервера при розпізнаванні фото'
    });
  }
};

module.exports = { scanOrderPhotos };
