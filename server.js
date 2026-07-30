const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Statik klasörleri sun
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const FEAR_GREED_URL = 'https://api.alternative.me/fng/';
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const BINANCE_BASE = 'https://api.binance.com';

// ========== Kök Route (Esnek index.html Bulucu) ==========
app.get('/', (req, res) => {
  const publicPath = path.join(__dirname, 'public', 'index.html');
  const rootPath = path.join(__dirname, 'index.html');

  if (fs.existsSync(publicPath)) {
    return res.sendFile(publicPath);
  } else if (fs.existsSync(rootPath)) {
    return res.sendFile(rootPath);
  } else {
    res.status(404).send('index.html dosyasi sunucuda bulunamadi! Lutfen Git deposunu kontrol edin.');
  }
});

// ========== 1. CoinGecko Proxy ==========
app.get('/api/proxy', async (req, res) => {
  try {
    const { endpoint = '', params = '' } = req.query;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint zorunlu' });

    const apiKey = process.env.COINGECKO_API_KEY ? process.env.COINGECKO_API_KEY.trim() : null;

    // URL parametrelerini ayrıştır
    const queryParams = new URLSearchParams(params);

    // Eğer API Key varsa, hem header hem parametre çakışmasını önlemek için parametreye ekle
    if (apiKey) {
      queryParams.set('x_cg_demo_api_key', apiKey);
    }

    const queryString = queryParams.toString();
    const targetUrl = `${COINGECKO_BASE}/${endpoint}${queryString ? '?' + queryString : ''}`;

    console.log(`[Proxy Request] ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Proxy Error] Status: ${response.status} | Response: ${errorText}`);
      return res.status(response.status).json({ 
        error: `CoinGecko Hatasi: ${response.statusText}`, 
        status: response.status,
        details: errorText 
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Proxy Catch Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== 2. Binance ==========
app.get('/api/binance/ticker', async (req, res) => {
  try {
    const symbol = req.query.symbol;
    if (!symbol) {
      return res.status(400).json({ error: 'symbol parametresi zorunlu (orn: BTCUSDT)' });
    }

    console.log(`[Binance] ${symbol} fiyati isteniyor...`);
    const resp = await fetch(`${BINANCE_BASE}/api/v3/ticker/24hr?symbol=${symbol}`, {
      timeout: 30000
    });

    if (!resp.ok) {
      throw new Error(`Binance API Hatasi: ${resp.status}`);
    }

    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('[Binance Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== 3. Fear & Greed ==========
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

// ========== 4. Groq AI ==========
app.post('/api/groq', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt zorunlu' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn('[Groq] API anahtari yok.');
      return res.json({
        content: "⚠️ Groq API anahtari yapilandirilmamis. Lutfen Render'a GROQ_API_KEY ekleyin."
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
    const content = data.choices?.[0]?.message?.content || 'Cevap alinamadi';
    res.json({ content });
  } catch (err) {
    console.error('[Groq Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== 5. Health Check ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== Sunucuyu Başlat ==========
app.listen(PORT, () => {
  console.log(`🚀 Sunucu http://localhost:${PORT} uzerinde calisiyor`);
});