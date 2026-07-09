const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

// Строгая JSON-схема для structured outputs.
// ВАЖНО: у Claude API жёсткий лимит — не более 16 параметров с union/nullable
// типами на всю схему (иначе 400 invalid_request_error, "exponential compilation
// cost"). Поэтому здесь НЕТ ни одного `type: [X, "null"]` — вместо null
// используются "не указано" сентинелы: пустая строка "" для текста, 0 для чисел.
// Это совпадает с тем, как фронтенд и так трактует пустые поля рецепта/цены
// (order-dialog.tsx уже дефолтит их в '0'/'').
const eyeSchema = {
  type: 'object',
  properties: {
    sphere: { type: 'string', description: 'Напр. "+2.5" або "-1.75", завжди зі знаком. "" якщо не вказано' },
    cylinder: { type: 'string', description: 'Напр. "-0.75", завжди зі знаком. "" якщо не вказано' },
    axis: { type: 'number', description: 'Вісь циліндра, 0-180. 0 якщо не вказано' },
    addition: { type: 'number', description: 'Аддидація (add), якщо вказана окремо. 0 якщо не вказано' }
  },
  required: ['sphere', 'cylinder', 'axis', 'addition'],
  additionalProperties: false
};

const ORDER_SCAN_SCHEMA = {
  type: 'object',
  properties: {
    pairs: {
      type: 'array',
      description: 'Одна пара окулярів = один елемент масиву. Див. системний промпт для правил визначення кількості пар.',
      items: {
        type: 'object',
        properties: {
          clientNameOnForm: { type: 'string', description: 'П.І.П. з бланка, як написано. "" якщо не видно' },
          clientPhoneOnForm: { type: 'string', description: 'Телефон з поля "Додатково", як написано. "" якщо не видно' },
          orderDate: { type: 'string', description: 'Дата бланка замовлення, як написано (без нормалізації). "" якщо не видно' },
          deliveryDate: { type: 'string', description: 'Дата видачі, як написано. "" якщо не видно' },
          frame: {
            type: 'object',
            properties: {
              present: { type: 'boolean', description: 'false якщо "своя оправа"/"замовника"/прочерк у ціні оправи' },
              brand: { type: 'string', description: '"" якщо не видно' },
              model: { type: 'string', description: '"" якщо не видно' },
              color: { type: 'string', description: '"" якщо не видно' },
              price: { type: 'number', description: '0 якщо не видно або своя оправа' }
            },
            required: ['present', 'brand', 'model', 'color', 'price'],
            additionalProperties: false
          },
          lenses: {
            type: 'object',
            properties: {
              brand: { type: 'string', description: '"" якщо не видно' },
              typeRaw: { type: 'string', description: 'Як написано на бланку: однофокальні/прогресивні/біфокальні/тощо. "" якщо не видно' },
              coatingRaw: { type: 'string', description: 'Все написане про покриття/властивості лінз одним рядком. "" якщо не видно' },
              unitPrice: { type: 'number', description: 'Ціна за одну лінзу, якщо видно множник. 0 якщо не видно' },
              totalPrice: { type: 'number', description: 'Підсумкова ціна лінз для ЦІЄЇ пари (після поділу, якщо ділили). 0 якщо не видно' }
            },
            required: ['brand', 'typeRaw', 'coatingRaw', 'unitPrice', 'totalPrice'],
            additionalProperties: false
          },
          prescription: {
            type: 'object',
            properties: {
              rightEye: eyeSchema,
              leftEye: eyeSchema,
              pd: { type: 'number', description: '0 якщо не видно' },
              purposeRaw: {
                type: 'string',
                description: 'ТІЛЬКИ фактично відмічені (кружечком/підкресленням) пункти зі списку D.S., не весь надрукований список. "" якщо не видно'
              }
            },
            required: ['rightEye', 'leftEye', 'pd', 'purposeRaw'],
            additionalProperties: false
          },
          payment: {
            type: 'object',
            properties: {
              masterWorkCost: { type: 'number', description: 'Робота, для ЦІЄЇ пари. 0 якщо не видно' },
              totalPrice: { type: 'number', description: 'Всього, для ЦІЄЇ пари. 0 якщо не видно' },
              paid: { type: 'number', description: 'Оплачено, для ЦІЄЇ пари. 0 якщо не видно' },
              balanceDue: { type: 'number', description: 'Доплата, для ЦІЄЇ пари. 0 якщо не видно' },
              discountPercent: { type: 'number', description: 'Явно видимий відсоток знижки, якщо є запис типу "-10%". 0 якщо не видно' }
            },
            required: ['masterWorkCost', 'totalPrice', 'paid', 'balanceDue', 'discountPercent'],
            additionalProperties: false
          },
          derivedFrom: {
            type: 'string',
            enum: ['explicit', 'addition', 'shared'],
            description: 'explicit - окремий рецепт для цієї пари; addition - розраховано як база+адидація; shared - скопійовано зі спільного рецепта'
          },
          notes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Все, що нерозбірливо, сумнівно, або розраховано (не переписано 1-в-1) - українською, коротко, для менеджера'
          }
        },
        required: [
          'clientNameOnForm', 'clientPhoneOnForm', 'orderDate', 'deliveryDate',
          'frame', 'lenses', 'prescription', 'payment', 'derivedFrom', 'notes'
        ],
        additionalProperties: false
      }
    }
  },
  required: ['pairs'],
  additionalProperties: false
};

const SYSTEM_PROMPT = `Ти — асистент оптичного салону в Україні, який розпізнає рукописні та друковані бланки замовлень на окуляри та рецепти, щоб заповнити CRM.

## Типи бланків, які можуть зустрітися на фото
1. "ЗАМОВЛЕННЯ НА ОКУЛЯРИ" — бланк салону з таблицею OD/OS (Sph/Cyl/Ax), П.І.П. клієнта, DP, Оправа, Лінзи, Додатково (телефон), і блоком цін: Ціна оправи, Ціна лінзи, Робота, Всього, Оплачено, Доплата.
2. "РЕЦЕПТ НА ОКУЛЯРИ" — окремий рукописний бланк рецепта з діаграмами осі (кола), полями Rp OD/OS Sph/Cyl/Ax, Dp, D.S. (список призначення), Кому, Вік, Лікар, Примітка.
3. Друкований рецепт стороннього оптометриста (наприклад "Рецепт №XXXX") — таблиця з колонками Sph/Cyl/Ax/Add/PD, теж окремий документ.

Фото можуть бути будь-якою комбінацією цих бланків для ОДНОГО відвідування клієнта (іноді декілька пар одразу — наприклад, вся сім'я).

## Термінологія бланків
- OD = праве око (rightEye), OS = ліве око (leftEye)
- Sph = sphere, Cyl = cylinder, Ax = axis
- DP / Dp = міжзрачкова відстань (pd), в мм. Може бути одним числом або через дріб (напр. "34,5/32") — у такому разі бери суму або більш повне значення з окремого бланка рецепта, якщо він є; якщо тільки один бланк — вкажи як є і додай примітку.
- П.І.П. = ПІБ клієнта
- Додатково = телефон клієнта
- Ціна оправи / Ціна лінзи / Робота / Всього / Оплачено / Доплата — фінансовий блок
- "Оправа" зі значенням типу "замовника", "своя", "власна", або прочерк у ціні оправи → frame.present = false
- add / аддидація — додаткова оптична сила для близької відстані (читання), зазвичай для прогресивних/біфокальних лінз

## Визначення кількості пар окулярів (масив pairs)
Головний сигнал — множники в цінах:
- "Ціна лінзи" з "×2" → 2 лінзи = 1 пара. "×4" → 4 лінзи = 2 пари.
- "Робота" аналогічно: без множника/"×1" → 1 пара, "×2" → 2 пари.
- "Ціна оправи" як сума двох окремих чисел (напр. "2200+690") → 2 оправи → 2 пари.
Якщо сигнали суперечать — не мовчи, познач ситуацію в notes і зроби найбільш імовірне припущення.

Якщо виявлено 2 пари, визнач рецепт кожної за одним з трьох патернів (заповни derivedFrom):
- "addition": є ОДИН базовий рецепт + окрема позначка "add +N" (в примітці рецепта або прямо в клітинці бланка замовлення). Пара 1 (даль) = базові sph/cyl/ax. Пара 2 (читання) = sph кожного ока = база + add, cyl/ax без змін. Обов'язково додай примітку "друга пара розрахована як база+адидація, перевірте".
- "shared": значення sph/cyl/ax в таблиці ОДНАКОВІ на обидві пари (множники цін показують 2 пари, другого рецепта чи add немає) — типово запасна пара. Обидві пари отримують ІДЕНТИЧНІ значення рецепта.
- "explicit": є ДВІ повністю окремі рецептурні картки/рядки з РІЗНИМИ наборами sph/cyl/ax, без формули база+add між ними (напр. одна пара -2.5, інша +3.25 — це просто дві різні пари). Кожен рецепт → окрема пара один-в-один.

Якщо на бланку лише 1 пара — derivedFrom завжди "explicit".

Розподіл цін між парами: якщо оправа вказана двома окремими числами — признач один-в-один. Якщо лінзи/робота — єдина сума з множником без явної розбивки по парах — поділи порівну між парами і ЗАВЖДИ додай в notes фразу "сума розділена порівну між парами, перевірте перед збереженням".

## D.S. (список призначення)
Це НАДРУКОВАНИЙ чекліст на бланку рецепта ("для далі, читання, постійного носіння, комп'ютера, антиблікові, фотохромні, світлозахисні (25%, 50%, 75%)"). Клієнту відмічають (кружечком/підкресленням/галочкою) лише 1-2 пункти. В purposeRaw вкажи ТІЛЬКИ фактично відмічені пункти — НЕ переноси весь надрукований список.

## Загальні правила
- Якщо щось нерозбірливо — постав null і поясни в notes, НЕ вигадуй значення.
- Числа розпізнавай уважно: рукописні "1" і "7", "0" і "6", "3" і "8" часто плутають — якщо не впевнений, познач в notes.
- Не перекладай і не нормалізуй вільний текст (бренди, моделі) — залишай як написано.
- Відповідай ТІЛЬКИ через надану JSON-схему, без додаткового тексту.`;

class ClaudeVisionService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    if (!this.apiKey) {
      logger.warn('ANTHROPIC_API_KEY не налаштований — сканування замовлень по фото буде недоступне');
    } else {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
  }

  /**
   * Розпізнати дані замовлення(нь) з фото бланків.
   * @param {Array<{buffer: Buffer, mimetype: string}>} files
   * @returns {Promise<Array<Object>>} масив розпізнаних пар (raw, ще не змаплені в enum бекенду)
   */
  async extractOrderData(files) {
    if (!this.client) {
      throw new Error('ANTHROPIC_API_KEY не налаштований на сервері');
    }
    if (!files || files.length === 0) {
      throw new Error('Не передано жодного файлу для розпізнавання');
    }

    const imageBlocks = files.map((file) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: file.mimetype,
        data: file.buffer.toString('base64')
      }
    }));

    // Реальні бланки набагато щільніші за тестові — 2 документи з дрібним
    // почерком на фото легко з'їдають кілька тисяч токенів тільки на
    // adaptive thinking (плюс детекція пар/патернів A/B/C з §4.4a - це
    // само по собі вимагає розмірковування). При замалому max_tokens
    // генерація обривається ДО того, як з'явиться сам JSON-блок (стара
    // межа 4096 була для цього замала) — звідси "порожня відповідь" або
    // обрізаний невалідний JSON. Стрімимо, бо великий max_tokens
    // ризикує впертися в HTTP-таймаут на нестрімінгових запитах.
    const stream = this.client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: 'high',
        format: {
          type: 'json_schema',
          schema: ORDER_SCAN_SCHEMA
        }
      },
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text: `Розпізнай усі бланки на цих ${files.length} фото та поверни дані по кожній парі окулярів згідно з інструкцією.`
            }
          ]
        }
      ]
    });
    const response = await stream.finalMessage();

    if (response.stop_reason === 'refusal') {
      throw new Error('Claude відмовився обробити зображення (refusal)');
    }
    if (response.stop_reason === 'max_tokens') {
      logger.error('Claude вичерпав max_tokens до завершення розпізнавання', {
        stopReason: response.stop_reason,
        usage: response.usage
      });
      throw new Error(
        'ШІ не встиг завершити розпізнавання — забракло ліміту токенів. Спробуйте менше фото за раз або зверніться до розробника.'
      );
    }

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock) {
      logger.error('Немає text-блоку у відповіді Claude', {
        stopReason: response.stop_reason,
        contentTypes: response.content.map((b) => b.type)
      });
      throw new Error('Порожня відповідь від Claude API');
    }

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (err) {
      logger.error('Не вдалося розпарсити JSON від Claude:', textBlock.text);
      throw new Error('Некоректний JSON у відповіді Claude API');
    }

    return parsed.pairs || [];
  }
}

module.exports = new ClaudeVisionService();
