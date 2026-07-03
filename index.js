require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// Root
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        product: 'XavierSpoofer',
        version: '1.0.0',
        message: '🔥 API untuk generate & verify license!'
    });
});

// TEST DB
app.get('/test-db', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('packages')
            .select('*');
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Routes
const licenseRoutes = require('./src/routes/license')(supabase);
const spooferRoutes = require('./src/routes/spoofer')(supabase);

app.use('/license', licenseRoutes);
app.use('/spoofer', spooferRoutes);

// Start
app.listen(port, '0.0.0.0', () => {
    console.log(`🔥 XavierSpoofer running on port ${port}`);
});
