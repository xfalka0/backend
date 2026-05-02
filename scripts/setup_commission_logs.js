const db = require('../db');
async function setup() {
    try {
        console.log('--- Commission Logs Tablosu Kuruluyor ---');
        await db.query(`
            CREATE TABLE IF NOT EXISTS commission_logs (
                id SERIAL PRIMARY KEY,
                operator_id UUID,
                chat_id INT,
                amount DECIMAL(12,2),
                type VARCHAR(50),
                agency_id UUID,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ commission_logs tablosu hazır.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Hata:', err.message);
        process.exit(1);
    }
}
setup();
