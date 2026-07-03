require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Root endpoint - TEST
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        product: 'XavierSpoofer',
        message: '🔥 API BERHASIL JALAN!'
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${port}`);
});
