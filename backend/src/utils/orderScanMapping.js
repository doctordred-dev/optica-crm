// Нормализация распознанных с фото украиноязычных бланков в русские enum'ы
// схемы Order (см. src/models/Order.js) и в формат, который ждёт форма заказа
// на фронтенде (components/orders/order-dialog.tsx formData).

const toNum = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const toStr = (v) => (v === null || v === undefined ? '' : String(v));

function normalizePhoneDigits(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  // Сравниваем по последним 9 цифрам (номер без кода страны/города),
  // чтобы не зависеть от формата (+380..., 0..., 380...).
  return digits.slice(-9);
}

function namesLooselyMatch(a, b) {
  if (!a || !b) return false;
  const normalize = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-zа-яіїєґ\s]/gi, '')
      .split(/\s+/)
      .filter(Boolean)
      .sort();
  const wordsA = normalize(a);
  const wordsB = normalize(b);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  // Совпадение хотя бы по 2 словам (обычно фамилия + имя) или по всем словам,
  // если их меньше двух — терпимо к ошибкам распознавания/порядку слов.
  const overlap = wordsA.filter((w) => wordsB.includes(w));
  return overlap.length >= Math.min(2, Math.min(wordsA.length, wordsB.length));
}

/**
 * Сверяет распознанные на бланке имя/телефон с уже выбранным клиентом CRM.
 * Никогда не блокирует — только сообщает, на что обратить внимание.
 */
function matchClient(pair, client) {
  if (!client) {
    return { matched: false, reason: 'no_client', warning: null };
  }

  const formPhone = normalizePhoneDigits(pair.clientPhoneOnForm);
  const clientPhone = normalizePhoneDigits(client.phone);
  if (formPhone && clientPhone && formPhone === clientPhone) {
    return { matched: true, reason: 'phone', warning: null };
  }

  if (namesLooselyMatch(pair.clientNameOnForm, client.name)) {
    return { matched: true, reason: 'name', warning: null };
  }

  if (!pair.clientNameOnForm && !pair.clientPhoneOnForm) {
    // На бланке не распознано ни имя, ни телефон — сверять не с чем, это не повод для тревоги
    return { matched: true, reason: 'no_data_on_form', warning: null };
  }

  return {
    matched: false,
    reason: 'mismatch',
    warning: `Дані на фото (${pair.clientNameOnForm || '—'}, ${pair.clientPhoneOnForm || '—'}) не збігаються з обраним клієнтом (${client.name}, ${client.phone}). Перевірте, чи правильного клієнта обрано.`
  };
}

function mapLensesType(raw) {
  const s = (raw || '').toLowerCase();
  if (s.includes('прогрес')) return 'прогрессивные';
  if (s.includes('біфокал') || s.includes('бифокал')) return 'бифокальные';
  if (s.includes('однофокал')) return 'однофокальные';
  if (!s) return 'однофокальные'; // дефолт формы
  return 'другое';
}

function mapLensesMaterial(raw) {
  const s = (raw || '').toLowerCase();
  if (s.includes('поліkarbon') || s.includes('поликарбон') || s.includes('polycarbon')) return 'поликарбонат';
  if (s.includes('скло') || s.includes('стекл') || s.includes('glass')) return 'стекло';
  if (s.includes('тривекс') || s.includes('trivex')) return 'тривекс';
  if (s.includes('пластик') || s.includes('plastic') || s.includes('cr-39') || s.includes('cr39')) return 'пластик';
  return 'пластик'; // дефолт формы
}

function mapFrameMaterial(raw) {
  const s = (raw || '').toLowerCase();
  if (s.includes('титан') || s.includes('titan')) return 'титан';
  if (s.includes('метал') || s.includes('metal')) return 'металл';
  if (s.includes('пластик') || s.includes('plastic')) return 'пластик';
  if (s.includes('комбінован') || s.includes('комбинирован')) return 'комбинированный';
  return 'другое'; // дефолт формы
}

function mapCoating(raw) {
  const s = (raw || '').toLowerCase();
  const coatings = [];
  if (s.includes('антиблік') || s.includes('антиблик')) coatings.push('антиблик');
  if (s.includes('фотохром')) coatings.push('фотохром');
  if (s.includes('uv') || s.includes('уф')) coatings.push('UV-защита');
  if (s.includes('антистатик')) coatings.push('антистатик');
  if (s.includes('гідрофоб') || s.includes('гидрофоб')) coatings.push('гидрофобное');
  return coatings; // может быть пустым — тогда просто без покрытия
}

function mapPurpose(raw) {
  const s = (raw || '').toLowerCase();
  // Порядок важен: более специфичные фразы проверяем раньше общих.
  if (s.includes('постійн') || s.includes('постоянн')) return 'для постоянного ношения';
  if (s.includes('комп') && s.includes('ютер')) return 'для компьютера';
  if (s.includes('читан') || s.includes('близ')) return 'для близи'; // "для читання" -> "для близи" (решено)
  if (s.includes('дал')) return 'для дали';
  if (!s) return 'для постоянного ношения'; // дефолт формы/схемы
  return 'другое';
}

function inferProductType(pair) {
  const hasFrame = pair.frame && pair.frame.present;
  const hasLenses = Boolean(
    pair.lenses && (pair.lenses.totalPrice || pair.lenses.unitPrice || pair.lenses.typeRaw)
  );
  if (hasFrame && hasLenses) return 'очки';
  if (hasFrame && !hasLenses) return 'оправа';
  if (!hasFrame && hasLenses) return 'линзы';
  return 'очки'; // дефолт формы
}

/**
 * Преобразует одну "сырую" пару от Claude в объект, совместимый с formData
 * фронтенда (components/orders/order-dialog.tsx), плюс служебные поля
 * _meta для экрана проверки (не отправляются в POST /api/orders).
 */
function buildOrderDraft(pair, client) {
  const clientMatch = matchClient(pair, client);

  return {
    productType: inferProductType(pair),
    status: 'черновик',

    frameBrand: toStr(pair.frame?.brand),
    frameModel: toStr(pair.frame?.model),
    frameMaterial: mapFrameMaterial(`${pair.frame?.brand || ''} ${pair.frame?.model || ''}`),
    frameColor: toStr(pair.frame?.color),
    frameSize: '',
    framePrice: pair.frame?.present ? toStr(toNum(pair.frame?.price) ?? '0') : '0',

    lensesBrand: toStr(pair.lenses?.brand),
    lensesType: mapLensesType(pair.lenses?.typeRaw),
    lensesMaterial: mapLensesMaterial(pair.lenses?.typeRaw),
    lensesCoating: mapCoating(pair.lenses?.coatingRaw),
    lensesPrice: toStr(toNum(pair.lenses?.totalPrice) ?? toNum(pair.lenses?.unitPrice) ?? '0'),

    rightSphere: toStr(pair.prescription?.rightEye?.sphere),
    rightCylinder: toStr(pair.prescription?.rightEye?.cylinder),
    rightAxis: toStr(toNum(pair.prescription?.rightEye?.axis) ?? '0'),
    rightAddition: toStr(toNum(pair.prescription?.rightEye?.addition) ?? '0'),
    leftSphere: toStr(pair.prescription?.leftEye?.sphere),
    leftCylinder: toStr(pair.prescription?.leftEye?.cylinder),
    leftAxis: toStr(toNum(pair.prescription?.leftEye?.axis) ?? '0'),
    leftAddition: toStr(toNum(pair.prescription?.leftEye?.addition) ?? '0'),
    pd: toStr(toNum(pair.prescription?.pd) ?? '0'),
    purpose: mapPurpose(pair.prescription?.purposeRaw),
    masterWorkCost: toStr(toNum(pair.payment?.masterWorkCost) ?? '0'),
    prescriptionOrderDate: '',

    prepayment: toStr(toNum(pair.payment?.paid) ?? '0'),
    discount: toStr(toNum(pair.payment?.discountPercent) ?? '0'),
    paymentMethod: 'наличные',

    _meta: {
      derivedFrom: pair.derivedFrom || 'explicit',
      notes: pair.notes || [],
      clientMatch,
      recognizedTotalPrice: toNum(pair.payment?.totalPrice),
      recognizedBalanceDue: toNum(pair.payment?.balanceDue),
      clientNameOnForm: pair.clientNameOnForm || null,
      orderDateOnForm: pair.orderDate || null
    }
  };
}

module.exports = {
  buildOrderDraft,
  matchClient,
  mapLensesType,
  mapLensesMaterial,
  mapFrameMaterial,
  mapCoating,
  mapPurpose,
  inferProductType,
  normalizePhoneDigits
};
