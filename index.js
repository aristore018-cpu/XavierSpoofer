require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());

// ============================================================
// ROOT
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
// GENERATE LICENSE
// ============================================================
app.post('/license/generate', async (req, res) => {
    try {
        const { user_id, package_id, asset_id } = req.body;

        const { data: pkg, error: pkgError } = await supabase
            .from('packages')
            .select('*')
            .eq('id', package_id)
            .single();

        if (pkgError) return res.status(400).json({ error: 'Package tidak ditemukan!' });

        const rawKey = user_id + asset_id + Date.now() + Math.random().toString(36);
        const licenseKey = 'XS-' + crypto.createHash('sha256')
            .update(rawKey)
            .digest('hex')
            .substring(0, 16)
            .toUpperCase();

        const expiredAt = new Date();
        expiredAt.setDate(expiredAt.getDate() + pkg.duration_days);

        const signature = crypto
            .createHmac('sha256', process.env.JWT_SECRET || 'xavier_secret')
            .update(licenseKey + expiredAt.toISOString())
            .digest('hex')
            .substring(0, 16);

        const { data: license, error } = await supabase
            .from('licenses')
            .insert([{
                license_key: licenseKey,
                user_id: user_id,
                package_id: package_id,
                asset_id: asset_id,
                expired_at: expiredAt.toISOString(),
                max_uses: 1,
                signature: signature
            }])
            .select()
            .single();

        if (error) return res.status(500).json({ error: 'Gagal generate license!' });

        res.json({
            success: true,
            license_key: licenseKey,
            package: pkg.name,
            expired_at: expiredAt,
            duration_days: pkg.duration_days,
            message: `✅ License berhasil digenerate untuk ${pkg.name}!`
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// VERIFY LICENSE
// ============================================================
app.post('/license/verify', async (req, res) => {
    try {
        const { license_key, asset_id, user_id } = req.body;

        const { data: license, error } = await supabase
            .from('licenses')
            .select('*, packages(name, duration_days)')
            .eq('license_key', license_key)
            .eq('asset_id', asset_id)
            .single();

        if (error || !license) {
            return res.status(403).json({ valid: false, message: '❌ License tidak ditemukan!' });
        }

        const now = new Date();
        const expired = new Date(license.expired_at);
        if (now > expired) {
            return res.status(403).json({ valid: false, message: '❌ License sudah EXPIRED!', expired_at: expired });
        }

        if (license.max_uses > 0 && license.used_count >= license.max_uses) {
            return res.status(403).json({ valid: false, message: '❌ License sudah mencapai batas penggunaan!' });
        }

        const expectedSignature = crypto
            .createHmac('sha256', process.env.JWT_SECRET || 'xavier_secret')
            .update(license.license_key + license.expired_at)
            .digest('hex')
            .substring(0, 16);

        if (license.signature !== expectedSignature) {
            return res.status(403).json({ valid: false, message: '❌ License CORRUPT!' });
        }

        if (license.user_id && license.user_id !== user_id) {
            return res.status(403).json({ valid: false, message: '❌ License tidak terdaftar untuk user ini!' });
        }

        await supabase
            .from('licenses')
            .update({ used_count: license.used_count + 1 })
            .eq('id', license.id);

        await supabase
            .from('license_logs')
            .insert([{
                license_id: license.id,
                user_id: user_id,
                action: 'USE',
                ip: req.ip || '0.0.0.0'
            }]);

        res.json({
            valid: true,
            message: '✅ License VALID!',
            asset_id: license.asset_id,
            package: license.packages?.name || 'Unknown',
            expired_at: license.expired_at,
            remaining_days: Math.ceil((new Date(license.expired_at) - now) / (1000 * 60 * 60 * 24)),
            used: license.used_count + 1
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// LIST LICENSE
// ============================================================
app.get('/license/list/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;

        const { data, error } = await supabase
            .from('licenses')
            .select('*, packages(name)')
            .eq('user_id', user_id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Gagal fetch data!', detail: error.message });
        }

        res.json({ success: true, data });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// SPOOF ASSET
// ============================================================
app.post('/spoofer/spoof', async (req, res) => {
    try {
        const { asset_id, mode, license_key } = req.body;

        const { data: license, error: licenseError } = await supabase
            .from('licenses')
            .select('*, packages(name)')
            .eq('license_key', license_key)
            .eq('asset_id', asset_id)
            .single();

        if (licenseError || !license) {
            return res.status(403).json({ error: '❌ License tidak valid!' });
        }

        const now = new Date();
        const expired = new Date(license.expired_at);
        if (now > expired) {
            return res.status(403).json({ error: '❌ License sudah EXPIRED!' });
        }

        let statusText = '';
        let spoofedData = { isPublic: true, assetStatus: 'Public' };

        switch (mode) {
            case 'private':
                spoofedData.isPublic = false;
                spoofedData.assetStatus = 'Private';
                statusText = '🔒 Private';
                break;
            case 'hidden':
                spoofedData.isPublic = false;
                spoofedData.assetStatus = 'Hidden';
                statusText = '👻 Hidden';
                break;
            default:
                spoofedData.isPublic = true;
                spoofedData.assetStatus = 'Public';
                statusText = '🌐 Public';
        }

        await supabase
            .from('spoof_logs')
            .insert([{
                user_id: license.user_id,
                asset_id: asset_id,
                mode: mode,
                ip: req.ip || '0.0.0.0'
            }]);

        res.json({
            success: true,
            asset_id: asset_id,
            mode: statusText,
            package: license.packages?.name || 'Unknown',
            message: `✅ Asset ${asset_id} berhasil di-spoof menjadi ${statusText}!`,
            data: spoofedData
        });

    } catch (error) {
        res.status(500).json({ error: '❌ Gagal spoof asset!', detail: error.message });
    }
});

// ============================================================
// TEST DB
// ============================================================
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

// ============================================================
// START
// ============================================================
app.listen(port, '0.0.0.0', () => {
    console.log(`🔥 XavierSpoofer running on port ${port}`);
});
