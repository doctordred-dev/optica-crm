const express = require('express');
const router = express.Router();

// Временные заглушки для роутов аналитики
router.get('/sales', (req, res) => {
  res.json({ message: 'Sales analytics - в разработке' });
});

router.get('/employees', (req, res) => {
  res.json({ message: 'Employees analytics - в разработке' });
});

router.get('/brands', (req, res) => {
  res.json({ message: 'Brands analytics - в разработке' });
});

module.exports = router;
