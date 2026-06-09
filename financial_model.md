# Fiva Dating App - Finansal Model ve Gelir/Gider Yapısı

Bu doküman, sistemin kullanıcı yatırımlarından başlayan ve yayıncı/ajans ödemelerine kadar uzanan tüm gelir, gider, vergi ve komisyon hesaplama mantığını listeler.

---

## 1. Temel Kur ve Çevrim Değerleri

Uygulama içi ekonomi modeli aşağıdaki sabit kur ve oranlar üzerine kuruludur:

*   **Elmas/Dolar Kuru:** `2000 Elmas = 1 USD`
*   **Dolar/TL Sabit Kuru:** `1 USD = 46.00 TL`
*   **Birim Elmas Değeri:** `1 Elmas = 0.023 TL` (46 TL / 2000 Elmas)
*   **Coin to Diamond (Dönüşüm Oranı):** `1 Coin = 4.35 Elmas` (Erkeğin harcadığı 1 Coin karşılığında kadın yayıncının kazandığı elmas miktarı. Bu oran Coin'in brüt değerinin %25'ine denk gelir).
*   **Coin Birim Değeri (Ortalama):** `1 Coin ≈ 0.35 TL - 0.40 TL` (Paket büyüklüğüne göre değişir).

---

## 2. Giriş Kesintileri (Brüt Yatırımdan Düşenler)

Erkek kullanıcı uygulama içerisinden Coin satın almak için ödeme yaptığında platforma giren paradan ilk aşamada **%35** oranında kesinti yapılır:

*   **Google Play / App Store Komisyonu:** `%15`
*   **KDV (Katma Değer Vergisi):** `%20`
*   **Toplam Kesinti:** `%35`
*   **Sistem Net Ciro Payı:** `%65` (Yatırılan brüt paranın platforma net kalan kısmı).

---

## 3. Çıkış Komisyonları ve Ödemeler (Giderler)

Yayıncılar topladıkları elmasları çekmek istediklerinde platformdan çıkan gider kalemleri:

*   **Yayıncı Payout Payı:** Biriktirdiği Elmas miktarı / 2000 * 46.00 TL.
*   **Ajans Komisyonu:** Yayıncının hediye/sohbet üzerinden kazandığı elmasların `%40`'ı ajansa ek kazanç olarak yazılır. (Platform tarafından ajans hesabına ödenir).
*   **Görev / Kampanya Bonusları:** Günlük görev hedeflerine ulaşıldığında yayıncılara verilen ek elmas ödülleridir.

---

## 4. Formüller

### Net Ciro Hesaplama (Giriş)
$$\text{Net Ciro (TL)} = \text{Kullanıcı Brüt Yatırımı (TL)} \times 0.65$$

### Yayıncı Hediye Kazancı (Elmas)
$$\text{Hediye Kazancı (Elmas)} = \text{Gönderilen Hediye (Coin)} \times 4.35$$

### Ajans Payı (Elmas)
$$\text{Ajans Payı (Elmas)} = \text{Yayıncı Hediye Kazancı (Elmas)} \times 0.40$$

### Toplam Gider (Çıkış)
$$\text{Toplam Ödeme (TL)} = \frac{\text{Yayıncı Elması + Görev Bonusu + Ajans Elması}}{2000} \times 46.00$$

### Net Platform Kârı
$$\text{Net Platform Kârı (TL)} = \text{Net Ciro (TL)} - \text{Toplam Ödeme (TL)}$$

---

## 5. Örnek Senaryo Analizi

### Senaryo: 2500 Coin Yatırımı ve Hediye Gönderimi (Görev Bonusu Dahil)
*   **Kullanıcı Depozitosu:** 2500 Coin = **1300 TL**
*   **Hediye Miktarı:** 2500 Coin
*   **Verilen Görev Bonusu:** 2000 Elmas

#### Gelir (Giriş) Hesabı:
*   Kullanıcı Brüt Ödemesi: `1300.00 TL`
*   Google Komisyonu (%15): `195.00 TL`
*   KDV (%20): `260.00 TL`
*   **Platform Net Giriş (%65):** `845.00 TL`

#### Gider (Çıkış) Hesabı:
*   Yayıncının Hediye Kazancı: $2500 \times 4.35 = 10.875$ Elmas
*   Yayıncının Görev Bonusu: `2000 Elmas`
*   Yayıncı Toplam Elmas: `12.875 Elmas` $\rightarrow$ **296.13 TL** (Yayıncı Payout)
*   Ajans Payı (%40): $10.875 \times 0.40 = 4.350$ Elmas $\rightarrow$ **100.05 TL** (Ajans Payout)
*   **Platformdan Çıkan Toplam Gider:** `396.18 TL`

#### Kârlılık Özeti:
*   **Sistem Net Kârı:** $845.00 \text{ TL (Giriş)} - 396.18 \text{ TL (Çıkış)} =$ **448.82 TL**
*   **Platform Net Kâr Oranı:** `%34.52`
