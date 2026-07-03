require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = 3000; // <- PAKE PORT YANG SAMA DENGAN DI RAILWAY

app.use(cors());
app.use(express.json());

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
