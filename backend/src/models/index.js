// Экспорт всех моделей для удобного импорта
const User = require('./User');
const Client = require('./Client');
const Order = require('./Order');
const SMSTemplate = require('./SMSTemplate');
const ActionLog = require('./ActionLog');

module.exports = {
  User,
  Client,
  Order,
  SMSTemplate,
  ActionLog
};
