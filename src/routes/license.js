const crypto = require('crypto');

module.exports = (supabase) => {
    const express = require('express');
    const router = express.Router();

    // ============================================================
    // GENERATE LICENSE
    // ============================================================
    router.post('/generate', async (req, res) => {
        try {
            const { user_id, package_id, asset_id } = req.body;

            // Cek package
            const { data: package, error: pkgError } = await supabase
                .from('packages')
                .select('*')
                .eq('id', package_id)
                .single();

            if (pkgError) {
                return res.status(400).json({ error: 'Package tidak ditemukan!' });
            }

            // Generate license key
            const rawKey = user_id + asset_id + Date.now() + Math.random().toString(36);
            const licenseKey = 'XS-' + crypto.createHash('sha256')
                .update(rawKey)
                .digest('hex')
                .substring(0, 16)
                .toUpperCase();

            // Hitung expired
            const expiredAt = new Date();
            expiredAt.setDate(expiredAt.getDate() + package.duration_days);

            // Generate signature
            const signature = crypto
                .createHmac('sha256', process.env.JWT_SECRET || 'xavier_secret')
                .update(licenseKey + expiredAt.toISOString())
                .digest('hex')
                .substring(0, 16);

            // Insert ke database
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

            if (error) {
                return res.status(500).json({ error: 'Gagal generate license!' });
            }

            res.json({
                success: true,
                license_key: licenseKey,
                package: package.name,
                expired_at: expiredAt,
                duration_days: package.duration_days,
                message: `✅ License berhasil digenerate untuk ${package.name}!`
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================================
    // VERIFY LICENSE
    // ============================================================
    router.post('/verify', async (req, res) => {
        try {
            const { license_key, asset_id, user_id } = req.body;

            // Cek license
            const { data: license, error } = await supabase
                .from('licenses')
                .select('*, packages(name, duration_days)')
                .eq('license_key', license_key)
                .eq('asset_id', asset_id)
                .single();

            if (error || !license) {
                return res.status(403).json({
                    valid: false,
                    message: '❌ License tidak ditemukan!'
                });
            }

            // CEK 1: Expired
            const now = new Date();
            const expired = new Date(license.expired_at);
            if (now > expired) {
                return res.status(403).json({
                    valid: false,
                    message: '❌ License sudah EXPIRED!',
                    expired_at: expired
                });
            }

            // CEK 2: Max uses
            if (license.max_uses > 0 && license.used_count >= license.max_uses) {
                return res.status(403).json({
                    valid: false,
                    message: '❌ License sudah mencapai batas penggunaan!',
                    used: license.used_count,
                    max: license.max_uses
                });
            }

            // CEK 3: Signature
            const expectedSignature = crypto
                .createHmac('sha256', process.env.JWT_SECRET || 'xavier_secret')
                .update(license.license_key + license.expired_at)
                .digest('hex')
                .substring(0, 16);

            if (license.signature !== expectedSignature) {
                return res.status(403).json({
                    valid: false,
                    message: '❌ License CORRUPT!'
                });
            }

            // CEK 4: User ID
            if (license.user_id && license.user_id !== user_id) {
                return res.status(403).json({
                    valid: false,
                    message: '❌ License tidak terdaftar untuk user ini!'
                });
            }

            // UPDATE used_count
            await supabase
                .from('licenses')
                .update({ used_count: license.used_count + 1 })
                .eq('id', license.id);

            // LOG
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
    // LIST LICENSES (ADMIN)
    // ============================================================
    router.get('/list/:user_id', async (req, res) => {
        try {
            const { user_id } = req.params;

            const { data, error } = await supabase
                .from('licenses')
                .select('*, packages(name)')
                .eq('user_id', user_id)
                .order('created_at', { ascending: false });

            if (error) {
                return res.status(500).json({ error: 'Gagal fetch data!' });
            }

            res.json({ success: true, data });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};