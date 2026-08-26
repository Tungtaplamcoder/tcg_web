const express = require('express');
const router = express.Router();
const { apiLimiter } = require('../middlewares/rateLimiters');

// ---------------------------- HELPERS ----------------------------

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNumeric(value) {
  return value !== undefined && value !== null && !isNaN(Number(value));
}

function findResultArray(obj) {
  if (Array.isArray(obj)) return obj;
  if (isObject(obj)) {
    if (Array.isArray(obj.result)) return obj.result;
    if (Array.isArray(obj.results)) return obj.results;
    for (const key of Object.keys(obj)) {
      const res = findResultArray(obj[key]);
      if (res) return res;
    }
  }
  return null;
}

function extractNumeric(obj, keys) {
  if (!isObject(obj)) return null;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && isNumeric(obj[key])) {
      return Number(obj[key]);
    }
  }
  return null;
}

function findValue(obj, keys) {
  if (!isObject(obj)) return null;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return null;
}

function getMinMaxFromBuckets(buckets, lowKeys, highKeys) {
  let low = null;
  let high = null;
  if (!Array.isArray(buckets)) return { low, high };
  for (const bucket of buckets) {
    const lowVal = extractNumeric(bucket, lowKeys);
    const highVal = extractNumeric(bucket, highKeys);
    if (lowVal !== null && lowVal > 0 && (low === null || lowVal < low)) low = lowVal;
    if (highVal !== null && highVal > 0 && (high === null || highVal > high)) high = highVal;
  }
  return { low, high };
}

function findSelectedItem(resultArray, condition, variant) {
  if (!resultArray || resultArray.length === 0) return null;

  if (variant) {
    const exactMatch = resultArray.find(item => {
      const itemVariant = (item.variant || item.printing || '').toLowerCase();
      const itemCondition = (item.condition || '').toUpperCase();
      return itemVariant === variant.toLowerCase() && itemCondition === condition.toUpperCase();
    });
    if (exactMatch) return exactMatch;
  }

  // Lọc theo condition
  let candidates = resultArray.filter(item => {
    const itemCondition = (item.condition || '').toUpperCase();
    return itemCondition === condition.toUpperCase();
  });

  if (candidates.length === 0) {
    candidates = resultArray.filter(item => {
      const itemCondition = (item.condition || '').toUpperCase();
      return itemCondition === 'NEAR_MINT' || itemCondition === 'NM' || itemCondition === 'MINT';
    });
  }

  if (candidates.length === 0) candidates = resultArray;

  // Ưu tiên variant không phải Reverse
  const nonReverse = candidates.find(item => {
    const v = (item.variant || item.printing || '').toLowerCase();
    return v === 'normal' || v === 'holofoil' || v === 'standard' || v === '';
  });

  return nonReverse || candidates[0];
}

function formatDateShortLabel(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return `${date.toLocaleString('en-US', { month: 'short', day: '2-digit' })}`;
}

function getRangeStartMs(range) {
  const now = Date.now();
  switch (range) {
    case 'month':
      return now - 30 * 24 * 60 * 60 * 1000;
    case 'quarter':
      return now - 90 * 24 * 60 * 60 * 1000;
    case 'semi-annual':
      return now - 180 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function getDaysForRange(range) {
  switch (range) {
    case 'month':
      return 30;
    case 'quarter':
      return 90;
    case 'semi-annual':
      return 180;
    case 'annual':
      return 365;
    default:
      return 30;
  }
}

// ---------------------------- ROUTE ----------------------------

router.get('/price-history/:tcgplayerId', apiLimiter, async (req, res) => {
  try {
    const { tcgplayerId } = req.params;
    const {
      range = 'quarter',
      condition = 'NEAR_MINT',
      variant = ''
    } = req.query;

    console.log(`[TCGplayer] Request: id=${tcgplayerId}, range=${range}, condition=${condition}, variant=${variant}`);

    const allowedRanges = ['month', 'quarter', 'semi-annual', 'annual'];
    if (!allowedRanges.includes(range)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_RANGE', message: `Invalid range. Allowed: ${allowedRanges.join(', ')}` }
      });
    }

    const fetchTCGData = async (rangeParam) => {
      const url = `https://infinite-api.tcgplayer.com/price/history/${tcgplayerId}/detailed?range=${rangeParam}`;
      const response = await fetch(url, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (!response.ok) {
        throw new Error(`TCGplayer API error: ${response.status}`);
      }
      return response.json();
    };

    // Xác định fetchRange:
    // 1M -> month
    // 3M -> quarter (gọi trực tiếp để mật độ cao hơn)
    // 6M -> annual (vì không có semi-annual riêng, lọc 180 ngày)
    // 1Y -> annual
    let fetchRange = range;
    if (range === 'semi-annual') {
      fetchRange = 'annual';
    }

    const rawData = await fetchTCGData(fetchRange);
    const resultArray = findResultArray(rawData) || [];

    const selectedItem = findSelectedItem(resultArray, condition, variant) || resultArray[0];

    console.log(`[TCGplayer] Selected item: condition=${selectedItem?.condition}, variant=${selectedItem?.variant}`);

    // Tạo map tổng quantitySold từ tất cả items
    const quantityMap = new Map();
    for (const item of resultArray) {
      if (!item.buckets || !Array.isArray(item.buckets)) continue;
      for (const bucket of item.buckets) {
        const startDate = findValue(bucket, ['bucketStartDate', 'date', 'dateLabel', 'time', 'timestamp', 'label']) || '';
        if (!startDate) continue;
        const qty = extractNumeric(bucket, ['quantitySold', 'soldQuantity', 'quantity']) || 0;
        quantityMap.set(startDate, (quantityMap.get(startDate) || 0) + qty);
      }
    }

    // Lấy buckets của selectedItem cho giá line
    const selectedBuckets = selectedItem && Array.isArray(selectedItem.buckets) ? selectedItem.buckets : [];
    const selectedPriceMap = new Map();
    for (const bucket of selectedBuckets) {
      const startDate = findValue(bucket, ['bucketStartDate', 'date', 'dateLabel', 'time', 'timestamp', 'label']) || '';
      if (!startDate) continue;
      selectedPriceMap.set(startDate, bucket);
    }

    let allDates = Array.from(quantityMap.keys()).sort((a, b) => new Date(a) - new Date(b));

    // Lọc theo range nếu fetchRange không phải là range tương ứng (chỉ áp dụng cho semi-annual dùng annual)
    const startMs = getRangeStartMs(range);
    if (startMs && (range === 'semi-annual')) {
      allDates = allDates.filter(date => {
        const dt = new Date(date);
        return !isNaN(dt.getTime()) && dt.getTime() >= startMs;
      });
    } else if (range === 'month' || range === 'quarter') {
      // Với 1M và 3M, API đã trả đúng range, không cần lọc thêm, nhưng vẫn lọc an toàn
      allDates = allDates.filter(date => {
        const dt = new Date(date);
        return !isNaN(dt.getTime()) && (!startMs || dt.getTime() >= startMs);
      });
    }

    const chart_data = [];
    let lastPrice = 0;

    for (let i = 0; i < allDates.length; i++) {
      const date = allDates[i];
      const quantity = quantityMap.get(date) || 0;

      let price = 0;
      let lowPrice = null;
      let highPrice = null;

      const selectedBucket = selectedPriceMap.get(date);
      if (selectedBucket) {
        price = extractNumeric(selectedBucket, ['marketPrice', 'price', 'value']) || 0;
        lowPrice = extractNumeric(selectedBucket, ['lowSalePriceWithShipping', 'lowSalePrice', 'lowPrice']);
        highPrice = extractNumeric(selectedBucket, ['highSalePriceWithShipping', 'highSalePrice', 'highPrice']);
        if (price > 0) lastPrice = price;
      } else {
        price = lastPrice;
      }

      const nextDate = allDates[i + 1] || null;
      let dateLabel = date;
      let endDate = date;
      if (nextDate) {
        const start = new Date(date);
        const end = new Date(nextDate);
        end.setDate(end.getDate() - 1);
        endDate = end.toISOString().split('T')[0];
        if (!isNaN(start) && !isNaN(end)) {
          dateLabel = `${start.toLocaleString('en-US', { month: 'short', day: '2-digit' })} - ${end.toLocaleString('en-US', { month: 'short', day: '2-digit' })}`;
        }
      } else {
        dateLabel = formatDateShortLabel(date);
      }

      chart_data.push({
        date,
        endDate,
        dateLabel,
        price,
        lowPrice: lowPrice !== null && lowPrice > 0 ? lowPrice : null,
        highPrice: highPrice !== null && highPrice > 0 ? highPrice : null,
        quantitySold: quantity
      });
    }

    // ------------------- COMPARISON PRICES -------------------
    let comparisonItems = resultArray.filter(item => {
      const cond = (item.condition || '').toUpperCase();
      return cond === 'NEAR_MINT' || cond === 'NEAR MINT' || cond === 'NM' || cond === 'MINT';
    });
    if (comparisonItems.length === 0) comparisonItems = resultArray;

    const comparison_prices = [];
    for (const item of comparisonItems) {
      if (item.buckets && Array.isArray(item.buckets) && item.buckets.length > 0) {
        const bucket = item.buckets[0];
        const marketPrice = extractNumeric(bucket, ['marketPrice', 'price']);
        if (marketPrice !== null) {
          comparison_prices.push({
            label: item.variant || item.printing || 'Variant',
            value: marketPrice
          });
        }
      }
    }

    // ------------------- PRICE POINTS -------------------
    let price_points = null;
    if (selectedItem) {
      const firstBucket = selectedItem.buckets && selectedItem.buckets.length > 0 ? selectedItem.buckets[0] : {};
      const marketPrice = extractNumeric(firstBucket, ['marketPrice', 'price']);
      const mostRecentSale = extractNumeric(firstBucket, ['lowSalePriceWithShipping', 'lowSalePrice', 'mostRecentSale']);
      price_points = {
        marketPrice: marketPrice,
        mostRecentSale: mostRecentSale,
        volatility: null,
        listedMedian: null,
        currentQuantity: null,
        currentSellers: null
      };
    }

    // ------------------- SNAPSHOT -------------------
    let snapshot = null;
    if (chart_data.length > 0) {
      const totalSold = chart_data.reduce((sum, item) => sum + item.quantitySold, 0);
      const lowSalePrice = Math.min(...chart_data.map(i => i.lowPrice !== null ? i.lowPrice : Infinity));
      const highSalePrice = Math.max(...chart_data.map(i => i.highPrice !== null ? i.highPrice : -Infinity));

      snapshot = {
        lowSalePrice: lowSalePrice === Infinity ? null : lowSalePrice,
        highSalePrice: highSalePrice === -Infinity ? null : highSalePrice,
        totalSold,
        avgDailySold: totalSold / getDaysForRange(range)
      };
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.status(200).json({
      success: true,
      data: {
        chart_data,
        price_metrics: {
          comparison_prices,
          price_points,
          snapshot
        },
        actual_range: range
      },
      message: 'Price history retrieved'
    });
  } catch (error) {
    console.error('TCGplayer proxy error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' }
    });
  }
});

module.exports = router;