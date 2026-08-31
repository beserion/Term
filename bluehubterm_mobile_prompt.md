# BLUEHUBTERM Mobil El Terminali - Faz 2 Mobil WMS Entegrasyon Prompt Rehberi

Bu döküman, **BLUEHUBTERM** (React Native / Expo / Flutter / Native Android) mobil el terminali uygulamasında **WMS Çoklu Lokasyon ve Raf Yönetimi (Multi-Bin Location Management)** modüllerinin geliştirmesi için hazırlanmış teknik rehber ve direktif belgesidir.

---

## 1. Mimari Genel Bakış ve Hedefler

BlueHub ERP backend sisteminde (`AppApi/Controllers/TerminalController.cs`) Faz 2 Mobil WMS REST API uç noktaları hazırlanmıştır. Mobil uygulamanın amacı, depodaki ürünlerin raf bazlı takibini, raf sorgulamasını, raf-raf transferlerini, mal kabul sonrası raflama (putaway) ve sipariş toplama (picking) işlemlerini endüstriyel el terminalleri (Honeywell, Zebra, Datalogic vb.) ve mobil cihazlar üzerinden hızlı, hatasız ve sesli/titreşimli geri bildirimlerle gerçekleştirilmesini sağlamaktır.

---

## 2. Arka Plan REST API Spesifikasyonları (`/api/terminal/Location/...`)

Tüm istekler `Authorization: Bearer <JWT_TOKEN>` başlığı ile gönderilmeli ve JSON formatında iletişim kurulmalıdır.

### 2.1. Raf / Lokasyon Barkodu Okutma ve Raf Detayı
- **HTTP Metodu**: `GET`
- **Endpoint URL**: `/api/terminal/Location/Scan/{code}`
- **Açıklama**: Okutulan raf barkoduna (`code`) ait bilgileri ve o rafta bulunan tüm stok ürünlerini getirir.
- **Yanıt JSON Örneği**:
  ```json
  {
    "success": true,
    "message": "Raf bilgisi getirildi",
    "data": {
      "locationCode": "A-01-02",
      "warehouseId": 1,
      "warehouseName": "Ana Depo",
      "items": [
        {
          "stockId": 10,
          "stockCode": "STK-001",
          "stockName": "Paslanmaz Cıvata M8x25",
          "barCode": "8690000112233",
          "quantity": 150,
          "unit": "Adet"
        }
      ]
    }
  }
  ```

---

### 2.2. Ürünün Bulunduğu Tüm Raf Lokasyonlarını Sorgulama
- **HTTP Metodu**: `GET`
- **Endpoint URL**: `/api/terminal/Location/StockLocations/{stockId}`
- **Açıklama**: Seçilen veya okutulan bir ürünün depodaki hangi raflarda ne kadar miktarda bulunduğunu listeler.
- **Yanıt JSON Örneği**:
  ```json
  {
    "success": true,
    "data": [
      {
        "locationCode": "A-01-02",
        "warehouseId": 1,
        "warehouseName": "Ana Depo",
        "quantity": 150
      },
      {
        "locationCode": "B-03-01",
        "warehouseId": 1,
        "warehouseName": "Ana Depo",
        "quantity": 50
      }
    ]
  }
  ```

---

### 2.3. Raf-Raf Transferi (Bin Relocation)
- **HTTP Metodu**: `POST`
- **Endpoint URL**: `/api/terminal/Location/Transfer`
- **Açıklama**: Belirtilen miktardaki ürünü kaynak raftan (`fromLocationCode`) düşer ve hedef rafa (`toLocationCode`) ekler.
- **İstek Body JSON**:
  ```json
  {
    "stockId": 10,
    "fromLocationCode": "A-01-02",
    "toLocationCode": "B-03-01",
    "quantity": 25,
    "warehouseId": 1
  }
  ```

---

### 2.4. Mobil Raflama (Putaway)
- **HTTP Metodu**: `POST`
- **Endpoint URL**: `/api/terminal/Location/Putaway`
- **Açıklama**: Mal kabulü yapılmış veya boşta duran ürünün belirtilen hedef rafa (`locationCode`) yerleştirilmesini sağlar.
- **İstek Body JSON**:
  ```json
  {
    "stockId": 10,
    "locationCode": "A-01-02",
    "quantity": 50,
    "warehouseId": 1
  }
  ```

---

### 2.5. Sipariş / Stok Toplama (Picking)
- **HTTP Metodu**: `POST`
- **Endpoint URL**: `/api/terminal/Location/Pick`
- **Açıklama**: Sipariş toplama veya stok çıkışı sırasında ürünün belirtilen raftan (`locationCode`) belirtilen miktarda düşülmesini sağlar.
- **İstek Body JSON**:
  ```json
  {
    "stockId": 10,
    "locationCode": "A-01-02",
    "quantity": 10,
    "orderId": 1002,
    "warehouseId": 1
  }
  ```

---

### 2.6. Akıllı Toplama Önerisi (Smart Picking Suggestion)
- **HTTP Metodu**: `GET`
- **Endpoint URL**: `/api/terminal/Location/PickingSuggestion/{stockId}`
- **Açıklama**: Sipariş toplama sırasında depo mantığına göre ürünün toplanacağı en uygun raf adresini (en çok stok olan veya FEFO/FIFO mantığına uyan raf) önerir.
- **Yanıt JSON Örneği**:
  ```json
  {
    "success": true,
    "data": {
      "suggestedLocationCode": "A-01-02",
      "stockId": 10,
      "availableQuantity": 150,
      "warehouseId": 1
    }
  }
  ```

---

## 3. Mobil Uygulama Ana Modülleri ve UI/UX Senaryoları

Mobil uygulamada aşağıdaki 4 ana modül geliştirmesi yapılacaktır:

### 3.1. Modül 1: Raf Sorgulama (Bin Query)
1. **Raf Okutma Tab'ı**:
   - Kullanıcı raf barkodunu okutur veya elle girer.
   - `GET /api/terminal/Location/Scan/{code}` çağrılır.
   - Ekranda raf kodu, depo adı ve raftaki tüm stok kartları (ürün adı, stok kodu, miktar, birim) kartlar halinde gösterilir.
2. **Ürün Konum Arama Tab'ı**:
   - Kullanıcı ürün barkodunu okutur veya listeden arar.
   - `GET /api/terminal/Location/StockLocations/{stockId}` çağrılır.
   - Ürünün depodaki hangi raflarda kaç adet olduğu sıralanır.

### 3.2. Modül 2: Adım Adım Raf Transferi (Step-by-Step Bin Transfer)
Adım adım kılavuzlanan (wizard style) 3 aşamalı akış:
- **Aşama 1 (Kaynak Raf)**: Kaynak raf okutulur (`fromLocationCode`). O raftaki stoklar listelenir.
- **Aşama 2 (Ürün & Miktar)**: Transfer edilecek ürün seçilir/okutulur ve transfer miktarı Numpad ile girilir.
- **Aşama 3 (Hedef Raf)**: Hedef raf barkodu okutulur (`toLocationCode`).
- **Onay**: `POST /api/terminal/Location/Transfer` gönderilir. Başarılı ise yeşil bildirim ve başarı sesi çalınır.

### 3.3. Modül 3: Mobil Raflama (Putaway)
- Kullanıcı raflanacak ürünü okutur/seçer.
- Yerleştirileceği hedef raf barkodunu okutur (`locationCode`).
- Yerleştirilecek miktarı girer ve `POST /api/terminal/Location/Putaway` ile kaydeder.

### 3.4. Modül 4: Sipariş Toplama (Picking)
- Toplanacak ürün seçildiğinde sistem `GET /api/terminal/Location/PickingSuggestion/{stockId}` ile **Akıllı Toplama Önerisi** kartını ekranda yeşil/altın vurgu ile gösterir.
- Kullanıcı önerilen rafa gider, raf barkodunu okutur ve topladığı miktarı girer.
- `POST /api/terminal/Location/Pick` ile sipariş stok düşümü gerçekleşir.

---

## 4. Donanım ve Barkod Okuyucu Entegrasyonu

- **Honeywell & Zebra DataWedge Broadcast Intent Listener**: El terminali lazer tetikleyicisi ile barkod okutulduğunda `useBarcode` hook'u otomatik tetiklenmeli ve aktif ekrandaki barkod işleyicisine düşmelidir.
- **Kamera Barkod Tarayıcısı**: Cihazda lazer okuyucu olmaması durumunda kamera ile QR/Barkod tarama modal'ı (`CameraScannerModal`) hazır olmalıdır.
- **Klavye Yönetimi**: El terminallerinde fiziksel klavye olduğu için ekrandaki sanal klavye varsayılan olarak gizli kalabilmeli, ihtiyaç halinde butonla açılabilmelidir.
- **Sesli & Titreşimli Geri Bildirim**: Başarılı okumalarda ve kayıtlarda `FeedbackService.playSuccess()`, hatalarda `FeedbackService.playError()` çağrılmalıdır.

---

## 5. Proje Yapısı ve Dosya Konumları (BLUEHUBTERM)

```
src/
├── services/
│   └── inventory.ts         # WMS Location API istekleri (scanLocation, transferLocation, vb.)
├── screens/
│   ├── BinQueryScreen.tsx   # Raf & Stok Konum Sorgulama ekranı
│   ├── BinTransferScreen.tsx# Adım Adım Raf-Raf Transfer ekranı
│   ├── PutawayScreen.tsx    # Mobil Raflama (Putaway) ekranı
│   ├── PickingScreen.tsx    # Sipariş Toplama ve Akıllı Öneri ekranı
│   └── DashboardScreen.tsx  # Ana sayfa modül kartları
└── navigation/
    └── InventoryStack.tsx   # Ekran rotaları kaydı
```
