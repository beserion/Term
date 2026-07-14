import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import {
  getStockByBarcode,
  getStocks,
  updateStockBarcode,
  updateStockShelfAddress,
  printLabel,
  getPrinters,
  getCycleCounts,
  createCycleCount,
  PrinterDto,
  CycleCountListItemDto,
  Stock
} from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { FeedbackService } from '../services/feedback';
import { sendCpclToPrinter } from '../services/printHelper';
import { flexMatch } from '../utils/searchHelper';

interface CountedItem {
  product: Stock;
  countedQty: number;
  barcodeMatched?: boolean;
  shelfAddress?: string;
}

export function QuickSetupScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const {
    activePrinterId,
    activePrinterName,
    setActivePrinter,
    activeWarehouseId,
    activeWarehouseName,
    setActiveWarehouse
  } = useSettingsStore();

  // Konfigürasyon seçim ekranı
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [printers, setPrinters] = useState<PrinterDto[]>([]);
  const [cycleCounts, setCycleCounts] = useState<CycleCountListItemDto[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [selectedPrinter, setSelectedPrinter] = useState<PrinterDto | null>(null);
  const [selectedCycleCount, setSelectedCycleCount] = useState<CycleCountListItemDto | null>(null);

  // Çalışma ekranı state'leri
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showSoftKeyboard, setShowSoftKeyboard] = useState(false);
  const [loadingScan, setLoadingScan] = useState(false);

  // Eşleştirilen / Bulunan ürün ve Miktar Giriş State'leri
  const [activeProduct, setActiveProduct] = useState<Stock | null>(null);
  const [isNewBarcodeMapping, setIsNewBarcodeMapping] = useState(false);
  const [quantity, setQuantity] = useState('1');

  // Raf Konumu Seçim State'leri
  const [shelfLetter, setShelfLetter] = useState('A');
  const [shelfNumber, setShelfNumber] = useState('1');
  const [shelfLevel, setShelfLevel] = useState('1');
  const [activePickerType, setActivePickerType] = useState<'letter' | 'number' | 'level' | null>(null);

  // Picker Seçenekleri
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
  const numbers = Array.from({ length: 30 }, (_, i) => String(i + 1));
  const levels = Array.from({ length: 10 }, (_, i) => String(i + 1));

  // Ürün Arama Modalı (Tanımsız barkod için tam ekran arama)
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sayım Listesi (Bu ekrandaki geçici liste)
  const [countedItems, setCountedItems] = useState<CountedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingLine, setSavingLine] = useState(false);

  const barcodeInputRef = useRef<TextInput>(null);
  const searchInputRef = useRef<TextInput>(null);
  const qtyInputRef = useRef<TextInput>(null);

  // Başlangıç verilerini yükle
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoadingConfig(true);
        const printerList = await getPrinters();
        const countList = await getCycleCounts();
        const allStocks = await getStocks();

        setPrinters(printerList);
        setCycleCounts(countList);
        setStocks(allStocks || []);

        // Eğer halihazırda ayarlarda seçili yazıcı varsa default seç
        if (activePrinterId !== null) {
          const current = printerList.find(p => p.id === activePrinterId);
          if (current) setSelectedPrinter(current);
        } else if (printerList.length > 0) {
          setSelectedPrinter(printerList[0]);
        }
      } catch (err: any) {
        showToast({ message: 'Yapılandırma yüklenemedi: ' + err.message, type: 'error' });
      } finally {
        setLoadingConfig(false);
      }
    };
    loadConfig();
  }, []);

  // Kurulumu tamamla ve çalışma ekranına geç
  const handleStartWork = () => {
    if (!selectedPrinter) {
      showToast({ message: 'Lütfen etiketlerin yazdırılacağı bir yazıcı seçin.', type: 'info' });
      return;
    }
    if (!selectedCycleCount) {
      showToast({ message: 'Lütfen depo sayımının işleneceği aktif bir sayım fişi seçin.', type: 'info' });
      return;
    }

    // SettingsStore'a kaydet
    setActivePrinter(selectedPrinter.id, selectedPrinter.name);
    if (selectedCycleCount.warehouseId && selectedCycleCount.warehouseName) {
      setActiveWarehouse(selectedCycleCount.warehouseId, selectedCycleCount.warehouseName);
    }
    setSetupCompleted(true);
    // Odaklanmayı tarayıcı inputuna al
    setTimeout(() => barcodeInputRef.current?.focus(), 300);
  };

  // Barkod Okuma İşlemi
  const handleBarcodeScan = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setBarcodeInput('');
    setScannedBarcode(cleanCode);
    setLoadingScan(true);
    setActiveProduct(null);
    setIsNewBarcodeMapping(false);
    setQuantity('1');

    try {
      // 1. Barkodla sorgula
      const result = await getStockByBarcode(cleanCode);
      if (result && result.id && result.id !== 0) {
        // Barkod tanımlı!
        setActiveProduct(result);
        if (result.shelfAddress) {
          const parts = result.shelfAddress.split('-');
          if (parts.length === 3) {
            setShelfLetter(parts[0]);
            setShelfNumber(parts[1]);
            setShelfLevel(parts[2]);
          }
        }
        FeedbackService.playSuccess();
        showToast({ message: `Ürün bulundu: ${result.stockName}`, type: 'success' });
        // Miktar inputuna odaklan
        setTimeout(() => qtyInputRef.current?.focus(), 150);
      } else {
        // Barkod tanımsız!
        FeedbackService.playError();
        showToast({ message: `Barkod tanımsız! Lütfen eşleşecek ürünü seçin.`, type: 'info' });
        setIsNewBarcodeMapping(true);
        setSearchQuery('');
        setShowSearchModal(true);
        setTimeout(() => searchInputRef.current?.focus(), 300);
      }
    } catch (err: any) {
      // API hata verdiyse de tanımsız kabul edip eşlemeye yönlendir
      FeedbackService.playError();
      showToast({ message: `Tanımsız veya hatalı barkod. Eşleme ekranı açılıyor.`, type: 'info' });
      setIsNewBarcodeMapping(true);
      setSearchQuery('');
      setShowSearchModal(true);
      setTimeout(() => searchInputRef.current?.focus(), 300);
    } finally {
      setLoadingScan(false);
    }
  };

  // Zebra DataWedge dinleyici kancası (Sadece ana ekranda ve modal kapalıyken çalışmalı)
  useBarcode((code) => {
    if (setupCompleted && !showSearchModal && !isSubmitting && !savingLine) {
      handleBarcodeScan(code);
    }
  }, setupCompleted && !showSearchModal && !isSubmitting && !savingLine);

  // Klavye Wedge veya hızlı elle yazma durumunda otomatik barkod algılama
  useEffect(() => {
    const clean = barcodeInput.trim();
    if (clean.length >= 4) {
      const timeout = setTimeout(() => {
        handleBarcodeScan(clean);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [barcodeInput]);

  // Manuel Arama Tetikleyicisi
  const handleManualSearch = () => {
    if (barcodeInput.trim()) {
      handleBarcodeScan(barcodeInput.trim());
    } else {
      showToast({ message: 'Lütfen geçerli bir barkod girin.', type: 'info' });
    }
  };

  // Ürün Arama Modalı Filtreleme (Ad, Türkçe ad, Kod, Marka, Model ve IMPA Koduna göre esnek arama)
  const filteredStocks = stocks.filter((item) => {
    if (!searchQuery.trim()) return true;
    const searchString = [
      item.stockName,
      item.stockNameTr,
      item.stockCode,
      item.brand,
      item.model,
      item.impaCode
    ].filter(Boolean).join(' ');
    return flexMatch(searchString, searchQuery);
  });

  // Ürün arama modalından ürün seçildiğinde
  const handleSelectProductFromSearch = (product: Stock) => {
    setActiveProduct(product);
    setShowSearchModal(false);
    if (product.shelfAddress) {
      const parts = product.shelfAddress.split('-');
      if (parts.length === 3) {
        setShelfLetter(parts[0]);
        setShelfNumber(parts[1]);
        setShelfLevel(parts[2]);
      }
    }
    // Miktar alanına odaklan
    setTimeout(() => qtyInputRef.current?.focus(), 150);
  };

  // Barkod Eşleme, Sayım Kaydı ve Yazdırma (KAYDET tetiklendiğinde)
  const handleSaveAndExecute = async () => {
    if (!activeProduct || !scannedBarcode) return;

    const qtyVal = parseFloat(quantity);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      showToast({ message: 'Lütfen geçerli bir sayım miktarı girin.', type: 'error' });
      FeedbackService.playError();
      return;
    }

    try {
      setSavingLine(true);

      // AŞAMA 1: Eşleşme yoksa önce barkodu ata (updateStockBarcode)
      if (isNewBarcodeMapping) {
        await updateStockBarcode(activeProduct.id, scannedBarcode);
        showToast({ message: 'Barkod eşleme başarılı!', type: 'success' });
      }

      // HER HALÜKARDA: Raf konumunu günceller (updateStockShelfAddress)
      const shelfAddr = `${shelfLetter}-${shelfNumber}-${shelfLevel}`;
      await updateStockShelfAddress(activeProduct.id, shelfAddr);

      // Lokal stok listesinde hem barkodu hem de raf adresini güncelle
      setStocks(prev =>
        prev.map(item =>
          item.id === activeProduct.id
            ? { ...item, barCode: isNewBarcodeMapping ? scannedBarcode : item.barCode, shelfAddress: shelfAddr }
            : item
        )
      );

      // AŞAMA 2: Etiketi yazdır (printLabel)
      if (activePrinterId) {
        try {
          const printRes = await printLabel({
            printerId: activePrinterId,
            barcode: scannedBarcode,
            qrCode: scannedBarcode,
            quantity: Math.max(1, Math.round(qtyVal)) // Etiket adet sayısına göre basılır
          });
          if (printRes.cpclData && printRes.printerIp) {
            await sendCpclToPrinter(printRes.printerIp, printRes.printerPort || 6101, printRes.cpclData);
            showToast({ message: 'Etiket yazıcıya gönderildi.', type: 'success' });
          }
        } catch (printErr: any) {
          showToast({ message: 'Etiket yazdırma hatası: ' + printErr.message, type: 'error' });
        }
      }

      // AŞAMA 3: Lokal Sayım Listesine Ekle
      setCountedItems(prev => {
        const existing = prev.find(item => item.product.id === activeProduct.id && item.shelfAddress === shelfAddr);
        if (existing) {
          return prev.map(item =>
            item.product.id === activeProduct.id && item.shelfAddress === shelfAddr
              ? { ...item, countedQty: item.countedQty + qtyVal, barcodeMatched: isNewBarcodeMapping }
              : item
          );
        } else {
          return [
            { product: activeProduct, countedQty: qtyVal, barcodeMatched: isNewBarcodeMapping, shelfAddress: shelfAddr },
            ...prev
          ];
        }
      });

      FeedbackService.playSuccess();
      showToast({ message: `${activeProduct.stockName} sayıma ve rafa eklendi.`, type: 'success' });

      // Temizlik ve sıfırlama
      setActiveProduct(null);
      setScannedBarcode('');
      setIsNewBarcodeMapping(false);
      setQuantity('1');
      Keyboard.dismiss();

      // Tekrar barkod inputuna odaklan
      setTimeout(() => barcodeInputRef.current?.focus(), 150);

    } catch (err: any) {
      showToast({ message: 'Kayıt işlemi başarısız: ' + err.message, type: 'error' });
      FeedbackService.playError();
    } finally {
      setSavingLine(false);
    }
  };

  // Toplu Sayımı Gönderme ve Tamamlama (Sayımı Kaydet)
  const handleSubmitAll = async () => {
    if (!activeWarehouseId) {
      showToast({ message: 'Aktif depo bulunamadı.', type: 'error' });
      return;
    }
    if (countedItems.length === 0) {
      showToast({ message: 'Gönderilecek sayım kalemi yok.', type: 'info' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createCycleCount({
        cycleCountId: selectedCycleCount?.id,
        documentNo: selectedCycleCount?.documentNo || 'CYC-' + Date.now(),
        countDate: new Date().toISOString(),
        warehouseId: activeWarehouseId,
        lines: countedItems.map(item => ({
          stockId: item.product.id,
          countedQty: item.countedQty
        }))
      });

      showToast({ message: 'Hızlı kurulum sayımı tamamlandı!', type: 'success' });
      setCountedItems([]);

      // Sayım listesini yenile
      const countList = await getCycleCounts();
      setCycleCounts(countList);
      if (selectedCycleCount) {
        const updated = countList.find(c => c.id === selectedCycleCount.id);
        if (updated) setSelectedCycleCount(updated);
      }

    } catch (err: any) {
      showToast({ message: 'Sayım tamamlanamadı: ' + err.message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hızlı miktar artır/azalt
  const handleAdjustQuantity = (amount: number) => {
    const current = parseFloat(quantity) || 0;
    setQuantity(Math.max(1, current + amount).toString());
  };

  // Kurulum Seçim Ekranı Render
  if (!setupCompleted) {
    return (
      <View style={styles.container}>
        <TopAppBar title="Hızlı Kurulum Giriş" onBack={() => navigation.goBack()} />
        {loadingConfig ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ marginTop: 12, ...Typography.bodyMd, color: Colors.outline }}>Yapılandırmalar yükleniyor...</Text>
          </View>
        ) : (
          <View style={[styles.setupContent, { padding: Spacing.md, paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
            <Text style={styles.setupTitle}>Hızlı Kurulum Ayarları</Text>
            <Text style={styles.setupSubtitle}>İşleme başlamak için yazıcı ve sayım fişi seçin:</Text>

            {/* Yazıcı Listesi */}
            <Text style={styles.sectionLabel}>Hedef Yazıcı</Text>
            <FlatList
              data={printers}
              keyExtractor={(item) => item.id.toString()}
              style={styles.setupList}
              renderItem={({ item }) => {
                const isSelected = selectedPrinter?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.setupItem, isSelected && styles.setupItemActive]}
                    onPress={() => setSelectedPrinter(item)}
                    activeOpacity={0.7}
                  >
                    <CustomIcon
                      name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={isSelected ? Colors.primary : Colors.outline}
                    />
                    <Text style={[styles.setupItemText, isSelected && styles.setupItemTextActive]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyText}>Aktif yazıcı bulunamadı.</Text>}
            />

            {/* Sayım Fişi Listesi */}
            <Text style={styles.sectionLabel}>Aktif Sayım Fişi</Text>
            <FlatList
              data={cycleCounts}
              keyExtractor={(item) => item.id.toString()}
              style={styles.setupList}
              renderItem={({ item }) => {
                const isSelected = selectedCycleCount?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.setupItem, isSelected && styles.setupItemActive]}
                    onPress={() => setSelectedCycleCount(item)}
                    activeOpacity={0.7}
                  >
                    <CustomIcon
                      name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={isSelected ? Colors.primary : Colors.outline}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.setupItemText, isSelected && styles.setupItemTextActive]}>
                        {item.remarks || 'Açıklamasız Fiş'}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.outline }}>
                        {item.warehouseName || 'Depo Belirtilmemiş'} | {item.documentNo}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyText}>Aktif/Bekleyen sayım fişi bulunamadı.</Text>}
            />

            <TouchableOpacity
              style={[
                styles.startBtn,
                (!selectedPrinter || !selectedCycleCount) && styles.startBtnDisabled
              ]}
              onPress={handleStartWork}
              disabled={!selectedPrinter || !selectedCycleCount}
              activeOpacity={0.8}
            >
              <Text style={styles.startBtnText}>İŞLEME BAŞLA</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Çalışma Ekranı Render
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopAppBar
        title="Hızlı Kurulum Ekranı"
        onBack={() => {
          // Geri basınca kurulum durumunu sıfırlayıp yapılandırma sayfasına atsın
          setSetupCompleted(false);
        }}
      />

      {/* Çok küçük ve kompakt üst bilgi alanı */}
      <View style={styles.miniHeaderBar}>
        <Text style={styles.miniHeaderBarText} numberOfLines={1}>
          <CustomIcon name="printer" size={12} color={Colors.primary} /> {activePrinterName} |{' '}
          <CustomIcon name="clipboard-text-outline" size={12} color={Colors.primary} />{' '}
          {selectedCycleCount?.remarks} ({activeWarehouseName})
        </Text>
      </View>

      {/* Barkod Okutma/Giriş Alanı */}
      <View style={styles.scanSection}>
        <View style={styles.barcodeInputContainer}>
          <TextInput
            style={styles.barcodeInput}
            placeholder="Barkod okutun veya girin..."
            placeholderTextColor={Colors.outline}
            value={barcodeInput}
            onChangeText={setBarcodeInput}
            onSubmitEditing={handleManualSearch}
            returnKeyType="search"
            ref={barcodeInputRef}
            autoFocus={true}
            showSoftInputOnFocus={showSoftKeyboard}
          />
          <TouchableOpacity
            style={styles.keyboardToggleBtn}
            onPress={() => {
              setShowSoftKeyboard(prev => !prev);
              setTimeout(() => barcodeInputRef.current?.focus(), 100);
            }}
            activeOpacity={0.7}
          >
            <CustomIcon
              name={showSoftKeyboard ? "keyboard" : "keyboard-outline"}
              size={20}
              color={showSoftKeyboard ? Colors.primary : Colors.outline}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchButton} onPress={handleManualSearch} activeOpacity={0.7}>
            <CustomIcon name="magnify" size={20} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Taranan/Seçilen Ürün Bilgisi ve İşlem Formu (DENSE / YOĞUN TASARIM) */}
      {loadingScan ? (
        <View style={{ padding: 12, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={{ fontSize: 12, color: Colors.outline, marginTop: 4 }}>Sorgulanıyor...</Text>
        </View>
      ) : activeProduct && scannedBarcode ? (
        <View style={styles.activeProductCard}>
          <View style={styles.productBadgeRow}>
            <View style={[styles.badge, isNewBarcodeMapping ? styles.badgeNew : styles.badgeFound]}>
              <Text style={styles.badgeText}>
                {isNewBarcodeMapping ? 'YENİ BARKOD EŞLEŞTİRME' : 'TANIMLI ÜRÜN'}
              </Text>
            </View>
            <Text style={styles.activeBarcodeText}>Barkod: {scannedBarcode}</Text>
          </View>

          <View style={styles.productDetailsContainer}>
            <Text style={styles.productNameText} numberOfLines={1}>{activeProduct.stockName}</Text>
            <Text style={styles.productCodeText}>
              Kod: <Text style={{ fontWeight: 'bold' }}>{activeProduct.stockCode}</Text>
              {activeProduct.shelfAddress ? `  |  Raf: ${activeProduct.shelfAddress}` : ''}
              {activeProduct.qty !== undefined ? `  |  Mevcut: ${activeProduct.qty} ${activeProduct.unit || 'Adet'}` : ''}
            </Text>
          </View>

          {/* Raf Konumu Girişi */}
          <View style={styles.shelfRowContainer}>
            <Text style={styles.shelfLabelText}>Raf Konumu:</Text>
            <View style={styles.shelfSelectorsContainer}>
              <TouchableOpacity
                style={styles.shelfSelectorBtn}
                onPress={() => setActivePickerType('letter')}
                activeOpacity={0.7}
              >
                <Text style={styles.shelfSelectorBtnText}>{shelfLetter}</Text>
                <CustomIcon name="chevron-down" size={14} color={Colors.outline} />
              </TouchableOpacity>

              <Text style={styles.shelfSeparatorText}>-</Text>

              <TouchableOpacity
                style={styles.shelfSelectorBtn}
                onPress={() => setActivePickerType('number')}
                activeOpacity={0.7}
              >
                <Text style={styles.shelfSelectorBtnText}>{shelfNumber}</Text>
                <CustomIcon name="chevron-down" size={14} color={Colors.outline} />
              </TouchableOpacity>

              <Text style={styles.shelfSeparatorText}>-</Text>

              <TouchableOpacity
                style={styles.shelfSelectorBtn}
                onPress={() => setActivePickerType('level')}
                activeOpacity={0.7}
              >
                <Text style={styles.shelfSelectorBtnText}>{shelfLevel}</Text>
                <CustomIcon name="chevron-down" size={14} color={Colors.outline} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sayım Miktarı Giriş Satırı */}
          <View style={styles.qtyRowContainer}>
            <Text style={styles.qtyLabelText}>Sayım Miktarı:</Text>

            <View style={styles.qtySelector}>
              <TouchableOpacity
                style={styles.qtyAdjustBtn}
                onPress={() => handleAdjustQuantity(-1)}
                activeOpacity={0.7}
              >
                <CustomIcon name="minus" size={16} color={Colors.primary} />
              </TouchableOpacity>

              <TextInput
                style={styles.qtyInput}
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
                ref={qtyInputRef}
                selectTextOnFocus={true}
                onSubmitEditing={handleSaveAndExecute}
              />

              <TouchableOpacity
                style={styles.qtyAdjustBtn}
                onPress={() => handleAdjustQuantity(1)}
                activeOpacity={0.7}
              >
                <CustomIcon name="plus" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Hızlı Ekleme Butonları */}
            <View style={styles.quickQtyGroup}>
              <TouchableOpacity style={styles.quickQtyBtn} onPress={() => handleAdjustQuantity(5)}>
                <Text style={styles.quickQtyBtnText}>+5</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickQtyBtn} onPress={() => handleAdjustQuantity(10)}>
                <Text style={styles.quickQtyBtnText}>+10</Text>
              </TouchableOpacity>
            </View>

            {/* KAYDET BUTONU */}
            <TouchableOpacity
              style={[styles.saveBtn, savingLine && styles.saveBtnDisabled]}
              onPress={handleSaveAndExecute}
              disabled={savingLine}
              activeOpacity={0.8}
            >
              {savingLine ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <>
                  <CustomIcon name="content-save" size={16} color={Colors.onPrimary} />
                  <Text style={styles.saveBtnText}>Kayıt</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : scannedBarcode ? (
        <View style={styles.notFoundCard}>
          <Text style={styles.notFoundText}>Tanımsız Barkod: {scannedBarcode}</Text>
          <TouchableOpacity
            style={styles.mappingBtn}
            onPress={() => {
              setSearchQuery('');
              setShowSearchModal(true);
              setTimeout(() => searchInputRef.current?.focus(), 300);
            }}
          >
            <Text style={styles.mappingBtnText}>Ürün Eşleştir</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Altta Sayılan Ürünlerin Listesi (DENSE LIST) */}
      <View style={styles.listSection}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.listTitle}>Sayılan Ürünler ({countedItems.length})</Text>
          <TouchableOpacity onPress={() => setCountedItems([])} disabled={countedItems.length === 0}>
            <Text style={{ fontSize: 12, color: countedItems.length > 0 ? Colors.error : Colors.outline }}>Listeyi Temizle</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={countedItems}
          keyExtractor={(item) => `${item.product.id}-${item.shelfAddress || ''}`}
          contentContainerStyle={styles.denseListContent}
          renderItem={({ item }) => (
            <View style={styles.denseListItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemCodeText}>{item.product.stockCode} {item.shelfAddress ? `| Raf: ${item.shelfAddress}` : ''}</Text>
                <Text style={styles.itemNameText} numberOfLines={1}>{item.product.stockName}</Text>
              </View>
              {item.barcodeMatched && (
                <View style={styles.mappedTag}>
                  <Text style={styles.mappedTagText}>Eşlendi</Text>
                </View>
              )}
              <View style={styles.itemQtyBadge}>
                <Text style={styles.itemQtyBadgeText}>{item.countedQty} Adet</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCountedItems(prev => prev.filter(i => i.product.id !== item.product.id))}
                style={{ padding: 4 }}
              >
                <CustomIcon name="close" size={16} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Text style={styles.emptyListText}>Bu oturumda henüz ürün sayılmadı.</Text>
            </View>
          }
        />
      </View>

      {/* SAYIMI KAYDET VE TAMAMLA BUTONU */}
      <View style={[styles.footerSection, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <TouchableOpacity
          style={[styles.submitAllBtn, (countedItems.length === 0 || isSubmitting) && styles.submitAllBtnDisabled]}
          onPress={handleSubmitAll}
          disabled={countedItems.length === 0 || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.onPrimary} size="small" />
          ) : (
            <Text style={styles.submitAllBtnText}>Sayımı Kaydet ve Tamamla</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* TAM EKRAN ÜRÜN ARAMA VE SEÇİM MODALİ */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitleText}>Ürün Seçin</Text>
              <Text style={styles.modalSubtitleText}>Barkod: {scannedBarcode} için ürün seçin</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowSearchModal(false)}
              style={styles.modalCloseBtn}
            >
              <CustomIcon name="close" size={24} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          {/* Modal Arama Çubuğu */}
          <View style={styles.modalSearchRow}>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Ürün adı veya stok kodu ile ara..."
              placeholderTextColor={Colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
              ref={searchInputRef}
              autoFocus={true}
              clearButtonMode="while-editing"
            />
            <View style={styles.modalSearchIcon}>
              <CustomIcon name="magnify" size={20} color={Colors.outline} />
            </View>
          </View>

          {/* Yoğun Ürün Listesi */}
          <FlatList
            data={filteredStocks}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.modalListContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalListItem}
                onPress={() => handleSelectProductFromSearch(item)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                  <Text style={styles.modalItemName}>{item.stockName}</Text>
                  {item.stockNameTr ? (
                    <Text style={styles.modalItemNameTr}>{item.stockNameTr}</Text>
                  ) : null}
                  <Text style={styles.modalItemCode}>
                    {item.stockCode} {item.barCode ? `| ${item.barCode}` : '| BARKODSUZ'}
                    {item.brand ? (
                      <> | <Text style={styles.modalItemBrand}>{item.brand}</Text></>
                    ) : null}
                    {item.model ? ` | ${item.model}` : ''}
                  </Text>
                </View>
                <CustomIcon name="chevron-right" size={16} color={Colors.outline} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>Aranan ürün bulunamadı.</Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* RAF KONUMU PICKER MODAL */}
      <Modal
        visible={activePickerType !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActivePickerType(null)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setActivePickerType(null)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {activePickerType === 'letter'
                  ? 'Harf Seçin'
                  : activePickerType === 'number'
                    ? 'Raf No Seçin'
                    : 'Kat/Seviye Seçin'}
              </Text>
              <TouchableOpacity onPress={() => setActivePickerType(null)} style={styles.pickerCloseBtn}>
                <CustomIcon name="close" size={20} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={
                activePickerType === 'letter' ? letters : activePickerType === 'number' ? numbers : levels
              }
              keyExtractor={(item) => item}
              contentContainerStyle={styles.pickerListContent}
              renderItem={({ item }) => {
                const isSelected =
                  activePickerType === 'letter'
                    ? shelfLetter === item
                    : activePickerType === 'number'
                      ? shelfNumber === item
                      : shelfLevel === item;
                return (
                  <TouchableOpacity
                    style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                    onPress={() => {
                      if (activePickerType === 'letter') setShelfLetter(item);
                      else if (activePickerType === 'number') setShelfNumber(item);
                      else if (activePickerType === 'level') setShelfLevel(item);
                      setActivePickerType(null);
                    }}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  setupContent: {
    flex: 1,
    gap: Spacing.md,
  },
  setupTitle: {
    ...Typography.titleLg,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  setupSubtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.xs,
  },
  sectionLabel: {
    ...Typography.labelMd,
    color: Colors.primary,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: Spacing.xs,
  },
  setupList: {
    maxHeight: 180,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  setupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerHigh,
    gap: Spacing.md,
  },
  setupItemActive: {
    backgroundColor: Colors.primaryFixed,
  },
  setupItemText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  setupItemTextActive: {
    fontWeight: 'bold',
    color: Colors.onPrimaryFixed,
  },
  startBtn: {
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    ...Shadow.sm,
  },
  startBtnDisabled: {
    backgroundColor: Colors.outlineVariant,
  },
  startBtnText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  miniHeaderBar: {
    backgroundColor: Colors.surfaceContainerLow,
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  miniHeaderBarText: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
  scanSection: {
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  barcodeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingRight: Spacing.xs,
  },
  barcodeInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Colors.onSurface,
  },
  keyboardToggleBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButton: {
    width: 36,
    height: 32,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeProductCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    gap: 8,
    ...Shadow.sm,
  },
  productBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  badgeNew: {
    backgroundColor: Colors.errorContainer,
  },
  badgeFound: {
    backgroundColor: Colors.primaryFixedDim,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  activeBarcodeText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  productDetailsContainer: {
    gap: 2,
  },
  productNameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  productCodeText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  qtyRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  qtyLabelText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.onSurface,
  },
  qtySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.xs,
    height: 32,
    backgroundColor: Colors.surfaceContainerLow,
  },
  qtyAdjustBtn: {
    width: 28,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    width: 44,
    height: '100%',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
    padding: 0,
  },
  quickQtyGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  quickQtyBtn: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    height: 32,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickQtyBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 12,
    height: 32,
    gap: 4,
    flex: 1,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.outlineVariant,
  },
  saveBtnText: {
    fontSize: 13,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  notFoundCard: {
    backgroundColor: Colors.errorContainer,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  notFoundText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.onErrorContainer,
  },
  mappingBtn: {
    backgroundColor: Colors.error,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mappingBtnText: {
    fontSize: 12,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  denseListContent: {
    gap: 6,
    paddingBottom: 20,
  },
  denseListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.xs,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
  },
  itemCodeText: {
    fontSize: 10,
    color: Colors.outline,
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.onSurface,
  },
  mappedTag: {
    backgroundColor: Colors.errorContainer,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
  },
  mappedTagText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: Colors.onErrorContainer,
  },
  itemQtyBadge: {
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  itemQtyBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyListText: {
    fontSize: 12,
    color: Colors.outline,
  },
  emptyText: {
    padding: Spacing.md,
    textAlign: 'center',
    fontSize: 12,
    color: Colors.outline,
  },
  footerSection: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  submitAllBtn: {
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitAllBtnDisabled: {
    backgroundColor: Colors.outlineVariant,
  },
  submitAllBtnText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  modalSubtitleText: {
    fontSize: 11,
    color: Colors.error,
    fontWeight: '500',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchRow: {
    position: 'relative',
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  modalSearchInput: {
    height: 40,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingLeft: 36,
    paddingRight: Spacing.md,
    color: Colors.onSurface,
    fontSize: 14,
  },
  modalSearchIcon: {
    position: 'absolute',
    left: 18,
    top: 18,
  },
  modalListContent: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 40, // DENSE: Düşük satır yüksekliği
  },
  modalItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.onSurface,
  },
  modalItemNameTr: {
    fontSize: 12,
    color: '#1d4ed8',
    fontStyle: 'italic',
    marginTop: 1,
  },
  modalItemBrand: {
    fontWeight: '600',
    color: '#b85c00',
  },
  modalItemCode: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  // Raf Konumu Stilleri
  shelfRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginTop: 8,
    marginBottom: 4,
  },
  shelfLabelText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  shelfSelectorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shelfSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 8,
    height: 32,
    gap: 4,
    minWidth: 50,
    justifyContent: 'center',
  },
  shelfSelectorBtnText: {
    fontSize: 12,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  shelfSeparatorText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.outline,
  },
  // Picker Modalı Stilleri
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    maxHeight: '60%',
    minHeight: '40%',
    paddingBottom: Spacing.xl,
    ...Shadow.card,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  pickerTitle: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  pickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerListContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  pickerItemActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFixed,
  },
  pickerItemText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  pickerItemTextActive: {
    fontWeight: 'bold',
    color: Colors.onPrimaryFixed,
  },
});
