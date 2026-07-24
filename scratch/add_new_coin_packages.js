const db = require('../db');

async function addNewCoinPackages() {
  try {
    const packages = [
      { name: 'VIP Safir Paket', coins: 10000, price: '4599.99', is_popular: false, revenuecat_id: 'coins_10000_v1', description: '%40 AVANTAJ' },
      { name: 'VIP Zümrüt Paket', coins: 20000, price: '8799.99', is_popular: false, revenuecat_id: 'coins_20000_v1', description: '%45 AVANTAJ' },
      { name: 'VIP Titan Paket', coins: 40000, price: '17399.99', is_popular: true, revenuecat_id: 'coins_40000_v1', description: '%50 MEGA AVANTAJ' }
    ];

    for (const pkg of packages) {
      const existCheck = await db.query('SELECT id FROM coin_packages WHERE coins = $1', [pkg.coins]);
      if (existCheck.rows.length === 0) {
        await db.query(
          `INSERT INTO coin_packages (name, coins, price, is_popular, revenuecat_id, description, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [pkg.name, pkg.coins, pkg.price, pkg.is_popular, pkg.revenuecat_id, pkg.description]
        );
        console.log(`✅ Added package: ${pkg.name} (${pkg.coins} Coins - ₺${pkg.price})`);
      } else {
        await db.query(
          `UPDATE coin_packages SET price = $1, name = $2, description = $3 WHERE coins = $4`,
          [pkg.price, pkg.name, pkg.description, pkg.coins]
        );
        console.log(`🔄 Updated package: ${pkg.name} (${pkg.coins} Coins - ₺${pkg.price})`);
      }
    }
  } catch (err) {
    console.error('Error adding coin packages:', err.message);
  } finally {
    process.exit();
  }
}

addNewCoinPackages();
