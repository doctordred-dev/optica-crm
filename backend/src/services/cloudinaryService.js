const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

class CloudinaryService {
  constructor() {
    this.configured = Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );

    if (this.configured) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
    } else {
      logger.warn('Cloudinary credentials не налаштовані — оригінали фото замовлень не будуть збережені');
    }
  }

  /**
   * Завантажити оригінали фото бланків для аудиту/спорів.
   * Якщо Cloudinary не налаштований — не кидає помилку, просто повертає порожній масив
   * (розпізнавання даних працює незалежно від збереження фото).
   * @param {Array<{buffer: Buffer, mimetype: string}>} files
   * @param {string} clientId
   * @returns {Promise<string[]>} масив secure_url
   */
  async uploadOrderScanPhotos(files, clientId) {
    if (!this.configured) {
      return [];
    }

    const uploads = files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `orders/scans/${clientId}/${Date.now()}`,
              resource_type: 'image'
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result.secure_url);
            }
          );
          stream.end(file.buffer);
        })
    );

    try {
      return await Promise.all(uploads);
    } catch (error) {
      logger.error('Помилка завантаження фото в Cloudinary:', error);
      // Не блокуємо основний флоу розпізнавання через збій зберігання оригіналів
      return [];
    }
  }
}

module.exports = new CloudinaryService();
