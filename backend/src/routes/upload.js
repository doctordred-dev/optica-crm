const express = require('express');
const router = express.Router();

// Временные заглушки для роутов загрузки файлов
router.post('/', (req, res) => {
  res.json({ message: 'File upload - в разработке' });
});

router.get('/:id', (req, res) => {
  res.json({ message: `Get file ${req.params.id} - в разработке` });
});

module.exports = router;
