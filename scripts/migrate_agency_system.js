const db = require('../db');

async function migrate() {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        console.log('--- Ajans Sistemi Altyapısı Kuruluyor ---');

        // 1. Ajanslar Tablosu
        await client.query(`
            CREATE TABLE IF NOT EXISTS agencies (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                owner_id UUID, -- users tablosundaki ajans sahibi
                name VARCHAR(255) NOT NULL,
                commission_rate DECIMAL(5,2) DEFAULT 0.40, -- Örn: %40 ajansa kalır
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ agencies tablosu oluşturuldu.');

        // 2. Users tablosuna agency_id ekleme
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_id UUID;
        `);
        console.log('✅ users tablosuna agency_id kolonu eklendi.');

        // 3. Mevcut admin/staff rolleri gibi 'agency_owner' rolünü de sisteme tanıtalım
        // (Bu sadece bilgi amaçlı, role bazlı kontrollerde kullanacağız)

        await client.query('COMMIT');
        console.log('--- İşlem Başarıyla Tamamlandı ---');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Hata:', err.message);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
