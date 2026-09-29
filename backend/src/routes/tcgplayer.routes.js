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

// TCGplayer returns conditions as "Near Mint" (space) and variants as
// "Reverse Holofoil" (space), while our DB/frontend uses enum slugs such as
// "NEAR_MINT" / "REVERSE_HOLOFOIL". Normalize both to a single canonical
// uppercase-underscore form so matching works in either direction.
function normalizeCondition(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function normalizeVariant(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function findSelectedItem(resultArray, condition, variant) {
  if (!resultArray || resultArray.length === 0) return null;

  const targetCondition = normalizeCondition(condition);
  const targetVariant = normalizeVariant(variant);

  if (targetVariant) {
    const exactMatch = resultArray.find(item => {
      return normalizeVariant(item.variant || item.printing) === targetVariant &&
        normalizeCondition(item.condition) === targetCondition;
    });
    if (exactMatch) return exactMatch;
  }

  // Lọc theo condition
  let candidates = resultArray.filter(item => normalizeCondition(item.condition) === targetCondition);

  if (candidates.length === 0) {
    candidates = resultArray.filter(item => {
      const c = normalizeCondition(item.condition);
      return c === 'NEAR_MINT' || c === 'NEAR_MINT_' || c === 'NM' || c === 'MINT';
    });
  }

  if (candidates.length === 0) candidates = resultArray;

  // Ưu tiên variant không phải Reverse
  const nonReverse = candidates.find(item => {
    const v = normalizeVariant(item.variant || item.printing);
    return v === 'NORMAL' || v === 'HOLOFOIL' || v === 'STANDARD' || v === '';
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
      const url = `https://infinite-api.tcgplayer.com/price/history/${encodeURIComponent(tcgplayerId)}/detailed?range=${encodeURIComponent(rangeParam)}`;
      // TCGplayer's Infinite API rejects requests without a browser-like
      // User-Agent (403). Node's default undici UA is blocked, so always send
      // a realistic desktop UA plus matching Accept/Referer headers.
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.tcgplayer.com/',
          'Origin': 'https://www.tcgplayer.com',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) {
        throw new Error(`TCGplayer API error: ${response.status} ${response.statusText}`);
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

    // Chart data MUST be driven by the SELECTED item's own price buckets.
    //
    // Bug history: we used to build the date axis from the union of every
    // variant's buckets. TCGplayer reports each condition/variant on its own
    // rolling grid, so for `quarter` (3-day buckets) the union produced a
    // dense DAILY axis with dates that belong to *other* variants. Prices were
    // then forward-filled onto those mismatched dates, yielding a flat
    // staircase line, zero-volume days and jittery bars. For `semi-annual`
    // (weekly buckets aligned to the same weekday) the union happened to match
    // the selected item, which is why 6M looked smooth and 3M did not.
    //
    // Fix: iterate the selected item's real buckets (one chart point per
    // bucket, exactly like 6M), and compute quantitySold by summing every
    // item's buckets that fall inside that bucket's [start, nextStart) window.
    const normalizedBuckets = (selectedItem && Array.isArray(selectedItem.buckets) ? selectedItem.buckets : [])
      .map((bucket) => {
        const startDate = findValue(bucket, ['bucketStartDate', 'date', 'dateLabel', 'time', 'timestamp', 'label']) || '';
        return { bucket, startDate, time: new Date(startDate).getTime() };
      })
      .filter((entry) => entry.startDate && !isNaN(entry.time))
      .sort((a, b) => a.time - b.time);

    // Only 6M/1Y reuse the `annual` payload, so trim it back to 180/365 days.
    // Native payloads (1M/3M) already span the correct window.
    const startMs = getRangeStartMs(range);
    const rangeBuckets = startMs
      ? normalizedBuckets.filter((entry) => entry.time >= startMs)
      : normalizedBuckets;

    // Flatten every item's buckets once so quantity windows are O(buckets).
    const quantitySources = [];
    for (const item of resultArray) {
      if (!item.buckets || !Array.isArray(item.buckets)) continue;
      for (const bucket of item.buckets) {
        const bDate = findValue(bucket, ['bucketStartDate', 'date', 'dateLabel', 'time', 'timestamp', 'label']) || '';
        const bTime = new Date(bDate).getTime();
        if (!bDate || isNaN(bTime)) continue;
        quantitySources.push({
          time: bTime,
          qty: extractNumeric(bucket, ['quantitySold', 'soldQuantity', 'quantity']) || 0
        });
      }
    }

    const chart_data = [];
    let lastPrice = 0;

    for (let i = 0; i < rangeBuckets.length; i++) {
      const { bucket, startDate, time } = rangeBuckets[i];
      const nextTime = rangeBuckets[i + 1] ? rangeBuckets[i + 1].time : Infinity;

      let quantity = 0;
      for (const src of quantitySources) {
        if (src.time >= time && src.time < nextTime) quantity += src.qty;
      }

      let price = extractNumeric(bucket, ['marketPrice', 'price', 'value']) || 0;
      const lowPrice = extractNumeric(bucket, ['lowSalePriceWithShipping', 'lowSalePrice', 'lowPrice']);
      const highPrice = extractNumeric(bucket, ['highSalePriceWithShipping', 'highSalePrice', 'highPrice']);
      // Carry the previous price forward only when this bucket genuinely has
      // none, so the line never collapses to 0 / the y-axis floor.
      if (price > 0) {
        lastPrice = price;
      } else {
        price = lastPrice;
      }

      let dateLabel = formatDateShortLabel(startDate);
      let endDate = startDate;
      if (nextTime !== Infinity) {
        const start = new Date(time);
        const end = new Date(nextTime);
        end.setDate(end.getDate() - 1);
        endDate = end.toISOString().split('T')[0];
        dateLabel = `${start.toLocaleString('en-US', { month: 'short', day: '2-digit' })} - ${end.toLocaleString('en-US', { month: 'short', day: '2-digit' })}`;
      }

      chart_data.push({
        date: startDate,
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
    if (selectedItem && Array.isArray(selectedItem.buckets) && selectedItem.buckets.length > 0) {
      // Buckets may arrive in any order — pick the most recent one that
      // actually carries a market price. Fall back to whichever bucket has a
      // valid price, then to the last known chart price.
      const datedBuckets = [...selectedItem.buckets].map(bucket => {
        const rawDate = findValue(bucket, ['bucketStartDate', 'date', 'dateLabel', 'time', 'timestamp', 'label']) || '';
        return { bucket, time: new Date(rawDate).getTime() };
      });
      datedBuckets.sort((a, b) => {
        const ta = isNaN(a.time) ? -Infinity : a.time;
        const tb = isNaN(b.time) ? -Infinity : b.time;
        return tb - ta;
      });

      const bucketWithPrice = datedBuckets.find(({ bucket }) =>
        extractNumeric(bucket, ['marketPrice', 'price']) !== null
      ) || datedBuckets[0];

      const marketPrice = extractNumeric(bucketWithPrice.bucket, ['marketPrice', 'price']);
      const mostRecentSale = extractNumeric(bucketWithPrice.bucket, ['lowSalePriceWithShipping', 'lowSalePrice', 'mostRecentSale'])
        ?? (bucketWithPrice.bucket !== datedBuckets[0].bucket
          ? extractNumeric(datedBuckets[0].bucket, ['lowSalePriceWithShipping', 'lowSalePrice', 'mostRecentSale'])
          : null);

      price_points = {
        marketPrice: marketPrice !== null ? marketPrice : (lastPrice > 0 ? lastPrice : null),
        mostRecentSale,
        volatility: null,
        listedMedian: null,
        currentQuantity: null,
        currentSellers: null
      };
    } else if (chart_data.length > 0) {
      price_points = {
        marketPrice: lastPrice > 0 ? lastPrice : null,
        mostRecentSale: null,
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