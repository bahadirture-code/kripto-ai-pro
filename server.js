const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Yerleşik fetch kullanan hatasız CoinGecko Proxy
app.get('/api/proxy', async (req, res) => {
    try {
        const endpoint = req.query.endpoint;
        const params = req.query.params || '';
        
        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint eksik' });
        }
        
        const targetUrl = `https://api.coingecko.com/api/v3/${endpoint}?${params}`;
        
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Sunucu hatası: ' + e.message });
    }
});

// Groq AI Proxy
app.post('/api/groq', async (req, res) => {
    try {
        const { prompt, maxTokens } = req.body;
        const apiKey = process.env.GROQ_API_KEY || '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';

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                max_tokens: Number(maxTokens) || 800,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'Groq API hatası' });
        }

        res.json({ content: data.choices[0].message.content });
    } catch (e) {
        res.status(500).json({ error: 'Sunucu hatası: ' + e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});