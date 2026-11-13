const packages = [
  { name: 'Başlangıç', coins: 100, price: 43.99 },
  { name: 'Gümüş', coins: 200, price: 76.99 },
  { name: 'Altın', coins: 400, price: 142.99 },
  { name: 'VIP', coins: 700, price: 274.99 },
  { name: 'Platin', coins: 1200, price: 494.99 },
  { name: 'Efsane', coins: 2500, price: 1044.99 },
  { name: 'Ultimate', coins: 5000, price: 1924.99 },
];

const basePerCoin = packages[0].price / packages[0].coins; // 0.4399 TL/coin
const hardcodedBaseRate = 0.3999; // ShopScreen.js line 71

console.log('| Paket | Coin | Fiyat (₺) | Gerçek Birim (₺/Coin) | Gerçek Tasarruf % | Ekranda Gösterilen Tasarruf % (base=0.3999) | Anomali Durumu |');
console.log('|---|---|---|---|---|---|---|');

packages.forEach(p => {
  const unit = p.price / p.coins;
  const realSavings = ((1 - (unit / basePerCoin)) * 100).toFixed(1);
  const clientSavings = Math.round((1 - (unit / hardcodedBaseRate)) * 100);
  const isAnomaly = (unit > (packages[2].price / packages[2].coins) && p.coins > 400);
  const anomalyStr = isAnomaly ? '⚠️ FİYAT TERSİNE (400 coinden pahalı!)' : 'Düzgün';
  console.log(`| ${p.name} | ${p.coins} | ${p.price} ₺ | ${unit.toFixed(4)} ₺ | %${realSavings} | %${clientSavings > 0 ? clientSavings : 0} | ${anomalyStr} |`);
});

