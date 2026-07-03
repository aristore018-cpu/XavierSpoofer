require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// ============================================================
// SUPABASE CLIENT
// ============================================================
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY
);

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());

// ============================================================
// ROOT ENDPOINT
// ============================================================
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        product: 'XavierSpoofer',
        version: '1.0.0',
        message: '🔥 API untuk generate & verify license!'
    });
});

// ============================================================
// ROUTES
// ============================================================
const licenseRoutes = require('./src/routes/license')(supabase);
const spooferRoutes = require('./src/routes/spoofer')(supabase);

app.use('/license', licenseRoutes);
app.use('/spoofer', spooferRoutes);

// ============================================================
// START SERVER
// ============================================================
app.listen(port, () => {
    console.log(`🔥 XavierSpoofer running on port ${port}`);
    console.log(`🔒 Supabase connected: ${process.env.SUPABASE_URL}`);
});