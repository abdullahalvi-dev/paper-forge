/*
 * Roman Urdu comments:
 * Ye service system settings read/update karti hai.
 * Default settings merge karna aur admin-updated settings MongoDB mein persist karna yahan hota hai.
 */
const SystemSetting = require('../models/SystemSetting');

const defaults = {
  paperLimits: {
    fullPaper: {
      mcq: 100,
      short: 50,
      long: 20
    },
    fullPerChapter: {
      mcq: 100,
      short: 50,
      long: 20
    },
    practiceMcqLimit: 20,
    durationPerMcqSeconds: 60
  },
  pricing: {
    monthly: Number(process.env.MONTHLY_PRICE_PKR || 2000),
    yearly: Number(process.env.YEARLY_PRICE_PKR || 20000)
  },
  jazzcash: {
    number: process.env.JAZZCASH_NUMBER || '03047775129',
    accountName: process.env.JAZZCASH_ACCOUNT_NAME || 'Muhammad Abdullah Alvi'
  }
};

const getSettings = async () => {
  const saved = await SystemSetting.findOne({ key: 'global' }).lean();
  return {
    ...defaults,
    ...(saved?.value || {}),
    paperLimits: {
      ...defaults.paperLimits,
      ...(saved?.value?.paperLimits || {}),
      fullPerChapter: {
        ...defaults.paperLimits.fullPerChapter,
        ...(saved?.value?.paperLimits?.fullPerChapter || {})
      },
      fullPaper: {
        ...defaults.paperLimits.fullPaper,
        ...(saved?.value?.paperLimits?.fullPaper || {})
      }
    },
    pricing: {
      ...defaults.pricing,
      ...(saved?.value?.pricing || {})
    },
    jazzcash: {
      ...defaults.jazzcash,
      ...(saved?.value?.jazzcash || {})
    }
  };
};

const updateSettings = async (value) => {
  const settings = await getSettings();
  const next = {
    ...settings,
    ...value,
    paperLimits: {
      ...settings.paperLimits,
      ...(value.paperLimits || {}),
      fullPerChapter: {
        ...settings.paperLimits.fullPerChapter,
        ...(value.paperLimits?.fullPerChapter || {})
      },
      fullPaper: {
        ...settings.paperLimits.fullPaper,
        ...(value.paperLimits?.fullPaper || {})
      }
    },
    pricing: {
      ...settings.pricing,
      ...(value.pricing || {})
    },
    jazzcash: {
      ...settings.jazzcash,
      ...(value.jazzcash || {})
    }
  };

  await SystemSetting.findOneAndUpdate({ key: 'global' }, { key: 'global', value: next }, { upsert: true });
  return next;
};

module.exports = {
  getSettings,
  updateSettings
};
