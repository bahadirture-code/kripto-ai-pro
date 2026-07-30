const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path'); // Path modülü eklendi

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Statik klasör yolunu tam path olarak tanımla
app.use(express.static(path.join(__dirname, 'public')));

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const FEAR_GREED_URL = 'https://api.alternative.me/fng/';
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const BINANCE_BASE = 'https://api.binance.com';

// ========== 1. Kök Route (index.html Garantisi) ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== 2. CoinGecko Proxy ==========
app.get('/api/proxy', async (req, res) => {
  try {
    const { endpoint = '', params = '' } = req.query;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint zorunlu' });

    const apiKey = process.env.COINGECKO_API_KEY;
    if (!apiKey) {
      console.error('[Proxy] CoinGecko API anahtarı eksik!');
      return res.status(500).json({
        error: 'CoinGecko API anahtarı eksik. Render ortam değişkenine COINGECKO_API_KEY ekleyin.'
      });
    }

    const url = `${COINGECKO_BASE}/${endpoint}${params ? '?' + params : ''}`;
    console.log(`[Proxy] ${url}`);

    const response = await fetch(url, {
      headers: {
        'x-cg-demo-api-key': apiKey
      },
      timeout: 15000
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Proxy Error] ${response.status}: ${errorText}`);
      return res.status(response.status).json({ error: `CoinGecko: ${response.statusText}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Proxy Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== 3. Binance ==========
app.get('/api/binance/ticker', async (req, res) => {
  try {
    const symbol = req.query.symbol;
    if (!symbol) {
      return res.status(400).json({ error: 'symbol parametresi zorunlu (örn: BTCUSDT)' });
    }

    console.log(`[Binance] ${symbol} fiyatı isteniyor...`);
    const resp = await fetch(`${BINANCE_BASE}/api/v3/ticker/24hr?symbol=${symbol}`, {
      timeout: 30000
    });

    if (!resp.ok) {
      throw new Error(`Binance API Hatası: ${resp.status}`);
    }

    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('[Binance Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== 4. Fear & Greed ==========
app.get('/api/fear-greed', async (req, res) => {
  try {
    console.log('[Fear&Greed] Fetching...');
    const response = await fetch(FEAR_GREED_URL, { timeout: 10000 });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Fear&Greed Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== 5. Groq AI ==========
app.post('/api/groq', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt zorunlu' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn('[Groq] API anahtarı yok.');
      return res.json({
        content: "⚠️ Groq API anahtarı yapılandırılmamış. Lütfen Render'a GROQ_API_KEY ekleyin."
      });
    }

    console.log('[Groq] Analyzing...');
    const response = await fetch(GROQ_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      }),
      timeout: 15000
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Groq Error]', response.status, error);
      throw new Error(`Groq API: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'Cevap alınamadı';
    res.json({ content });
  } catch (err) {
    console.error('[Groq Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== 6. Health Check ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== Sunucuyu Başlat ==========
app.listen(PORT, () => {
  console.log(`🚀 Sunucu http://localhost:${PORT} üzerinde çalışıyor`);
});