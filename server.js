const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.post('/api/generate-guide', async (req, res) => {
  try {
    const { topic, level, format, apiKey } = req.body;
    if (!topic || !level || !format) {
      return res.status(400).json({ error: 'topic, level, and format are required' });
    }
    if (!apiKey) {
      return res.status(400).json({ error: 'apiKey is required' });
    }

    const prompt = `Create a detailed revision guide for: "${topic}"
Study Level: ${level} (beginner/intermediate/advanced)
Format: ${format} (bullets/paragraphs/qa)
Include: key concepts, examples, practice questions, memory aids, summary, resources
Make it comprehensive and educational.`;

    const response = await fetch('https://api-inference.huggingface.co/models/google/flan-t5-large', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 800, temperature: 0.7 } }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      const message = data.error || `HTTP ${response.status}`;
      return res.status(500).json({ error: `Hugging Face API error: ${message}` });
    }

    const guide = data[0]?.generated_text || data.generated_text || 'No output returned from model.';
    res.json({ guide });
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message || 'Unknown proxy error' });
  }
});

app.listen(PORT, () => {
  console.log(`AI proxy server running at http://localhost:${PORT}`);
});