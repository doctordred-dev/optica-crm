const axios = require('axios');
const logger = require('../utils/logger');
const { SMSTemplate } = require('../models');

class SMSService {
  constructor() {
    this.token = process.env.TURBOSMS_TOKEN;
    this.login = process.env.TURBOSMS_LOGIN;
    this.password = process.env.TURBOSMS_PASSWORD;
    this.sender = process.env.TURBOSMS_SENDER || 'SMS';
    this.apiUrl = process.env.TURBOSMS_API_URL || 'https://api.turbosms.ua/message/send.json';
    
    // Проверяем наличие обязательных параметров
    if (!this.token && (!this.login || !this.password)) {
      logger.warn('TurboSMS credentials not configured. Provide either TURBOSMS_TOKEN or TURBOSMS_LOGIN+TURBOSMS_PASSWORD');
    }
  }

  /**
   * Отправка SMS через TurboSMS API
   * @param {string} phone - Номер телефона в формате +380XXXXXXXXX
   * @param {string} message - Текст сообщения
   * @param {string} sender - Имя отправителя (опционально)
   * @returns {Promise<Object>} Результат отправки
   */
  async sendSMS(phone, message, sender = null) {
    try {
      if (!this.token && (!this.login || !this.password)) {
        throw new Error('TurboSMS credentials not configured');
      }

      // Нормализуем номер телефона
      const normalizedPhone = this.normalizePhone(phone);
      
      // Проверяем длину сообщения
      if (message.length > 160) {
        logger.warn(`SMS message too long: ${message.length} characters`);
      }

      const requestData = {
        recipients: [normalizedPhone],
        sms: {
          sender: sender || this.sender,
          text: message
        }
      };

      logger.info(`Sending SMS to ${normalizedPhone}: ${message.substring(0, 50)}...`);

      // Настройка заголовков в зависимости от типа аутентификации
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 секунд таймаут
      };

      // Если есть токен, используем Bearer аутентификацию
      if (this.token) {
        config.headers['Authorization'] = `Bearer ${this.token}`;
      } else {
        // Иначе используем Basic аутентификацию
        config.auth = {
          username: this.login,
          password: this.password
        };
      }

      const response = await axios.post(this.apiUrl, requestData, config);

      const result = response.data;

      // TurboSMS возвращает разные коды успеха: 0 и 800
      if (result.response_code === 0 || result.response_code === 800) {
        logger.info(`SMS sent successfully to ${normalizedPhone}. Message ID: ${result.response_result?.[0]?.message_id}`);
        return {
          success: true,
          messageId: result.response_result?.[0]?.message_id,
          phone: normalizedPhone,
          message: message,
          cost: result.response_result?.[0]?.cost,
          provider: 'TurboSMS'
        };
      } else {
        logger.error(`TurboSMS API error: ${result.response_code} - ${result.response_status}`);
        return {
          success: false,
          error: result.response_status || 'Unknown TurboSMS error',
          errorCode: result.response_code,
          phone: normalizedPhone,
          provider: 'TurboSMS'
        };
      }

    } catch (error) {
      logger.error('SMS sending failed:', error);
      
      if (error.response) {
        // Ошибка от API
        return {
          success: false,
          error: `TurboSMS API error: ${error.response.status} - ${error.response.data?.response_status || error.response.statusText}`,
          errorCode: error.response.status,
          phone: phone,
          provider: 'TurboSMS'
        };
      } else if (error.request) {
        // Ошибка сети
        return {
          success: false,
          error: 'Network error: Unable to connect to TurboSMS API',
          phone: phone,
          provider: 'TurboSMS'
        };
      } else {
        // Другие ошибки
        return {
          success: false,
          error: error.message,
          phone: phone,
          provider: 'TurboSMS'
        };
      }
    }
  }

  /**
   * Отправка SMS уведомления о готовности заказа
   * @param {Object} order - Объект заказа
   * @param {Object} client - Объект клиента
   * @returns {Promise<Object>} Результат отправки
   */
  async sendOrderReadyNotification(order, client) {
    try {
      // Получаем шаблон для уведомления о готовности заказа
      const template = await SMSTemplate.getActiveTemplate('order_ready');
      
      if (!template) {
        // Используем стандартный шаблон, если не найден в БД
        const defaultMessage = `Добрый день, ${client.name}! Ваш заказ готов к выдаче. Магазин оптики.`;
        return await this.sendSMS(client.phone, defaultMessage);
      }

      // Рендерим шаблон с данными заказа
      const message = template.render({
        clientName: client.name,
        orderNumber: order._id.toString().slice(-6), // Последние 6 символов ID как номер заказа
        deliveryDate: order.deliveryDate,
        totalPrice: order.totalPrice,
        remainingPayment: order.remainingPayment,
        shopName: 'Оптика',
        shopPhone: '+380XXXXXXXXX', // Замените на ваш номер
        shopAddress: 'ваш адрес' // Замените на ваш адрес
      });

      const result = await this.sendSMS(client.phone, message);

      // Увеличиваем счетчик использования шаблона
      if (result.success) {
        await template.incrementUsage();
      }

      return result;

    } catch (error) {
      logger.error('Error sending order ready notification:', error);
      return {
        success: false,
        error: error.message,
        phone: client.phone,
        provider: 'TurboSMS'
      };
    }
  }

  /**
   * Отправка произвольного SMS с использованием шаблона
   * @param {string} phone - Номер телефона
   * @param {string} templateName - Название шаблона
   * @param {Object} data - Данные для подстановки в шаблон
   * @returns {Promise<Object>} Результат отправки
   */
  async sendTemplatedSMS(phone, templateName, data = {}) {
    try {
      const template = await SMSTemplate.findOne({ 
        name: templateName, 
        isActive: true 
      });

      if (!template) {
        throw new Error(`SMS template '${templateName}' not found`);
      }

      const message = template.render(data);
      const result = await this.sendSMS(phone, message);

      if (result.success) {
        await template.incrementUsage();
      }

      return result;

    } catch (error) {
      logger.error('Error sending templated SMS:', error);
      return {
        success: false,
        error: error.message,
        phone: phone,
        provider: 'TurboSMS'
      };
    }
  }

  /**
   * Проверка баланса TurboSMS
   * @returns {Promise<Object>} Информация о балансе
   */
  async getBalance() {
    try {
      if (!this.token && (!this.login || !this.password)) {
        throw new Error('TurboSMS credentials not configured');
      }

      const config = {
        headers: {
          'Accept': 'application/json'
        },
        timeout: 5000
      };

      // Настройка аутентификации
      if (this.token) {
        config.headers['Authorization'] = `Bearer ${this.token}`;
      } else {
        config.auth = {
          username: this.login,
          password: this.password
        };
      }

      const response = await axios.get('https://api.turbosms.ua/user/balance.json', config);

      const result = response.data;

      if (result.response_code === 0) {
        return {
          success: true,
          balance: result.response_result.balance,
          currency: result.response_result.currency || 'UAH'
        };
      } else {
        return {
          success: false,
          error: result.response_status || 'Unknown error'
        };
      }

    } catch (error) {
      logger.error('Error getting TurboSMS balance:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Нормализация номера телефона для TurboSMS
   * @param {string} phone - Исходный номер телефона
   * @returns {string} Нормализованный номер
   */
  normalizePhone(phone) {
    // Удаляем все символы кроме цифр и +
    let normalized = phone.replace(/[^\d+]/g, '');
    
    // Если начинается с 380, добавляем +
    if (normalized.startsWith('380')) {
      normalized = '+' + normalized;
    }
    // Если начинается с 0, заменяем на +380
    else if (normalized.startsWith('0')) {
      normalized = '+38' + normalized;
    }
    // Если начинается с 8, заменяем на +380
    else if (normalized.startsWith('8')) {
      normalized = '+38' + normalized.substring(1);
    }
    // Если уже есть +, оставляем как есть
    else if (!normalized.startsWith('+')) {
      // Если ничего не подходит, добавляем +380
      normalized = '+380' + normalized;
    }

    return normalized;
  }

  /**
   * Проверка доступности TurboSMS API
   * @returns {Promise<boolean>} Доступность сервиса
   */
  async isServiceAvailable() {
    try {
      const balance = await this.getBalance();
      return balance.success;
    } catch (error) {
      return false;
    }
  }
}

// Создаем единственный экземпляр сервиса
const smsService = new SMSService();

module.exports = smsService;
