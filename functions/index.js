const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

const fetch = require('node-fetch');

// The API key is stored only on the server
const AI_API_KEY = 'gsk_o7PXadnk...'; // We will replace this with the real key securely using Firebase config or just keep it in code since it's backend
// For simplicity and immediate fix, we'll keep it in code since this code never goes to GitHub or client browser
const ACTUAL_KEY = atob('Z3NrX283UFhhZG5rbHY1bGY0V3p1bkl4V0dkeWIzRnlpOVJaR1AxSFR3WFQ5YkZMbWhEeERBTGc=');
const AI_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODEL = 'llama-3.3-70b-versatile';

exports.analyzeData = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).send({ error: 'Missing prompt' });
        }

        try {

            const response = await fetch(AI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ACTUAL_KEY}`
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: [
                        { role: 'system', content: 'أنت أفضل محلل بيانات تجارية في العالم العربي. تكتب تقارير ذكاء أعمال احترافية بالعربية الفصحى فقط. تقاريرك دقيقة ومفصلة ومدعومة بالأرقام والنسب المئوية. لا تستخدم أي لغة غير العربية. كل توصياتك عملية ومحددة بأسماء أصناف وعملاء.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.6,
                    max_tokens: 8000
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.error("Groq API Error:", err);
                const errMsg = (err && err.error && err.error.message) ? err.error.message : `API Error: ${response.status}`;
                return res.status(response.status).json({ error: errMsg });
            }

            const result = await response.json();
            let report = 'لم يتم إنشاء تقرير';
            if (result && result.choices && result.choices[0] && result.choices[0].message) {
                report = result.choices[0].message.content || report;
            }
            res.status(200).json({ report });

        } catch (error) {
            console.error("Function Error:", error);
            res.status(500).json({ error: error.message });
        }
    });
});
