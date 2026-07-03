module.exports = (supabase) => {
    const express = require('express');
    const router = express.Router();
    const axios = require('axios');

    // ============================================================
    // SPOOF ASSET
    // ============================================================
    router.post('/spoof', async (req, res) => {
        try {
            const { asset_id, mode, license_key } = req.body;

            // CEK LICENSE
            const { data: license, error: licenseError } = await supabase
                .from('licenses')
                .select('*, packages(name)')
                .eq('license_key', license_key)
                .eq('asset_id', asset_id)
                .single();

            if (licenseError || !license) {
                return res.status(403).json({
                    error: '❌ License tidak valid!'
                });
            }

            // Cek expired
            const now = new Date();
            const expired = new Date(license.expired_at);
            if (now > expired) {
                return res.status(403).json({
                    error: '❌ License sudah EXPIRED!'
                });
            }

            // SPOOF
            const response = await axios.get(`https://api.roblox.com/assets/${asset_id}`, {
                headers: {
                    'User-Agent': 'Roblox/WinInet',
                    'X-CSRF-TOKEN': 'spoofed'
                }
            });

            let spoofedData = response.data;
            let statusText = '';

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

            // LOG
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
            res.status(500).json({
                error: '❌ Gagal spoof asset!',
                detail: error.message
            });
        }
    });

    return router;
};