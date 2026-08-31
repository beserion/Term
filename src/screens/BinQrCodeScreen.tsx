import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CustomIcon } from '../components/CustomIcon';
import { TopAppBar } from '../components/TopAppBar';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { getPrinters, PrinterDto, printLabel } from '../services/inventory';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { FeedbackService } from '../services/feedback';
import { sendCpclToPrinter } from '../services/printHelper';
import { ScalePressable } from '../components/ScalePressable';

export function BinQrCodeScreen() {
  const navigation = useNavigation<any>();
  const showToast = useUIStore((s) => s.showToast);
  const { activeWarehouseName, activePrinterId, activePrinterName, setActivePrinter } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // Single Shelf State
  const [aisle, setAisle] = useState('A');
  const [rack, setRack] = useState('01');
  const [shelfLevel, setShelfLevel] = useState('01');
  const [customLocationCode, setCustomLocationCode] = useState('');
  const [locationName, setLocationName] = useState('');
  const [printQty, setPrintQty] = useState('1');

  // Batch Generation State
  const [batchAisle, setBatchAisle] = useState('A');
  const [startRack, setStartRack] = useState('1');
  const [endRack, setEndRack] = useState('5');
  const [levelsCount, setLevelsCount] = useState('3');
  const [generatedBatchCodes, setGeneratedBatchCodes] = useState<string[]>([]);

  // Printer modal states
  const [printers, setPrinters] = useState<PrinterDto[]>([]);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    getPrinters()
      .then((list) => {
        setPrinters(list || []);
        if (list.length > 0 && activePrinterId === null) {
          setActivePrinter(list[0].id, list[0].name);
        }
      })
      .catch(() => setPrinters([]));
  }, []);

  const getEffectiveLocationCode = () => {
    if (customLocationCode.trim()) {
      return customLocationCode.trim().toUpperCase();
    }
    const a = (aisle || 'A').trim().toUpperCase();
    const r = (rack || '01').padStart(2, '0');
    const s = (shelfLevel || '01').padStart(2, '0');
    return `${a}-${r}-${s}`;
  };

  const handleGenerateBatch = () => {
    const a = (batchAisle || 'A').trim().toUpperCase();
    const startR = parseInt(startRack, 10) || 1;
    const endR = parseInt(endRack, 10) || 1;
    const lvlCount = parseInt(levelsCount, 10) || 1;

    const list: string[] = [];
    for (let r = Math.min(startR, endR); r <= Math.max(startR, endR); r++) {
      for (let l = 1; l <= lvlCount; l++) {
        const rStr = r.toString().padStart(2, '0');
        const lStr = l.toString().padStart(2, '0');
        list.push(`${a}-${rStr}-${lStr}`);
      }
    }
    setGeneratedBatchCodes(list);
    FeedbackService.playSuccess();
    showToast({ message: `${list.length} adet raf QR kodu üretildi.`, type: 'success' });
  };

  const generateBinCpclData = (locCode: string, locDescription: string, warehouse: string) => {
    // Standard CPCL thermal label for bin QR code (400x300 dots)
    const cleanCode = locCode.trim().toUpperCase();
    const desc = locDescription || `RAF ADRESİ: ${cleanCode}`;
    const wh = warehouse || 'BLUEHUB WMS';

    return `! 0 200 200 320 1\r\n` +
      `PAGE-WIDTH 440\r\n` +
      `CENTER\r\n` +
      `TEXT 7 0 0 10 ${wh}\r\n` +
      `TEXT 4 0 0 35 ${cleanCode}\r\n` +
      `BARCODE QR 120 85 M 2 U 6\r\n` +
      `MA,${cleanCode}\r\n` +
      `ENDQR\r\n` +
      `CENTER\r\n` +
      `TEXT 7 0 0 270 ${desc}\r\n` +
      `PRINT\r\n`;
  };

  const handlePrintSingleQr = async () => {
    const code = getEffectiveLocationCode();
    if (!code) {
      showToast({ message: 'Geçerli bir raf kodu girin.', type: 'error' });
      return;
    }
    if (!activePrinterId) {
      setShowPrinterModal(true);
      return;
    }

    setPrinting(true);
    try {
      const selectedPrinter = printers.find((p) => p.id === activePrinterId);
      const cpcl = generateBinCpclData(code, locationName, activeWarehouseName || '');

      if (selectedPrinter) {
        // Direct TCP / HTTP printing to printer
        const printerIp = (selectedPrinter as any).ipAddress || '192.168.1.100';
        const printerPort = (selectedPrinter as any).port || 6101;
        await sendCpclToPrinter(printerIp, printerPort, cpcl);
      } else {
        await printLabel({
          printerId: activePrinterId,
          qrCode: code,
          quantity: parseInt(printQty, 10) || 1,
        });
      }

      FeedbackService.playSuccess();
      showToast({ message: `"${code}" raf QR etiketi yazıcıya gönderildi.`, type: 'success' });
    } catch (err: any) {
      FeedbackService.playError();
      showToast({ message: err.message || 'Yazıcıya etiket gönderilemedi.', type: 'error' });
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintAllBatch = async () => {
    if (generatedBatchCodes.length === 0) {
      showToast({ message: 'Önce toplu raf kodlarını oluşturun.', type: 'error' });
      return;
    }
    if (!activePrinterId) {
      setShowPrinterModal(true);
      return;
    }

    setPrinting(true);
    try {
      const selectedPrinter = printers.find((p) => p.id === activePrinterId);
      const printerIp = (selectedPrinter as any)?.ipAddress || '192.168.1.100';
      const printerPort = (selectedPrinter as any)?.port || 6101;

      for (const code of generatedBatchCodes) {
        const cpcl = generateBinCpclData(code, `TOPLU RAF BASIMI`, activeWarehouseName || '');
        await sendCpclToPrinter(printerIp, printerPort, cpcl);
      }

      FeedbackService.playSuccess();
      showToast({ message: `${generatedBatchCodes.length} adet toplu raf etiketi yazdırıldı.`, type: 'success' });
    } catch (err: any) {
      FeedbackService.playError();
      showToast({ message: err.message || 'Toplu basım hatası.', type: 'error' });
    } finally {
      setPrinting(false);
    }
  };

  const effectiveCode = getEffectiveLocationCode();

  return (
    <View style={styles.container}>
      <TopAppBar title="Raf QR Kodu Oluştur" onBack={() => navigation.goBack()} />

      {/* Segmented Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'single' && styles.tabButtonActive]}
          onPress={() => setActiveTab('single')}
        >
          <CustomIcon name="barcode-scan" size={18} color={activeTab === 'single' ? Colors.onPrimary : Colors.onSurfaceVariant} />
          <Text style={[styles.tabText, activeTab === 'single' && styles.tabTextActive]}>Tekli Raf QR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'batch' && styles.tabButtonActive]}
          onPress={() => setActiveTab('batch')}
        >
          <CustomIcon name="clipboard-list-outline" size={18} color={activeTab === 'batch' ? Colors.onPrimary : Colors.onSurfaceVariant} />
          <Text style={[styles.tabText, activeTab === 'batch' && styles.tabTextActive]}>Toplu Raf Üreteci</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Yazıcı Seçimi Çubuğu */}
        <TouchableOpacity
          style={styles.printerBar}
          onPress={() => setShowPrinterModal(true)}
          activeOpacity={0.8}
        >
          <CustomIcon name="printer" size={20} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.printerBarLabel}>Aktif Etiket Yazıcısı</Text>
            <Text style={styles.printerBarName}>{activePrinterName || 'Seçilmedi (Tıklayıp Seçin)'}</Text>
          </View>
          <CustomIcon name="chevron-right" size={20} color={Colors.outline} />
        </TouchableOpacity>

        {activeTab === 'single' ? (
          <>
            {/* Live QR Preview Card */}
            <View style={styles.qrPreviewCard}>
              <Text style={styles.previewHeaderLabel}>RAF ETİKET ÖNİZLEME</Text>

              <View style={styles.qrDisplayBox}>
                <CustomIcon name="barcode-scan" size={64} color={Colors.primary} />
                <Text style={styles.qrCodeValue}>{effectiveCode}</Text>
                <Text style={styles.qrSubText}>{activeWarehouseName || 'Ana Depo Lokasyonu'}</Text>
              </View>

              {locationName ? <Text style={styles.previewDesc}>{locationName}</Text> : null}
            </View>

            {/* Quick Generator Inputs */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Raf Adres Formatı</Text>

              <View style={styles.formatRow}>
                <View style={styles.formatCol}>
                  <Text style={styles.inputLabel}>Koridor / Aisle</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="A"
                    value={aisle}
                    onChangeText={setAisle}
                    autoCapitalize="characters"
                    maxLength={3}
                  />
                </View>
                <Text style={styles.dash}>-</Text>
                <View style={styles.formatCol}>
                  <Text style={styles.inputLabel}>Raf / Rack</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="01"
                    value={rack}
                    onChangeText={setRack}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
                <Text style={styles.dash}>-</Text>
                <View style={styles.formatCol}>
                  <Text style={styles.inputLabel}>Kat / Level</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="01"
                    value={shelfLevel}
                    onChangeText={setShelfLevel}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>VEYA Özel Raf Kodu Girin</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Örn: SOGUK-ODA-01"
                placeholderTextColor={Colors.outline}
                value={customLocationCode}
                onChangeText={setCustomLocationCode}
                autoCapitalize="characters"
              />

              <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>Raf Tanımı / Açıklama (İsteğe Bağlı)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Örn: 1. Kat Ağır Malzemeler Bölümü"
                placeholderTextColor={Colors.outline}
                value={locationName}
                onChangeText={setLocationName}
              />

              <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>Kopyalama Miktarı</Text>
              <TextInput
                style={styles.inputField}
                placeholder="1"
                value={printQty}
                onChangeText={setPrintQty}
                keyboardType="numeric"
              />

              <ScalePressable
                style={[styles.printBtn, printing && styles.printBtnDisabled]}
                onPress={handlePrintSingleQr}
                disabled={printing}
              >
                {printing ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <>
                    <CustomIcon name="printer" size={22} color={Colors.onPrimary} style={{ marginRight: 8 }} />
                    <Text style={styles.printBtnText}>Raf QR Etiketini Yazdır</Text>
                  </>
                )}
              </ScalePressable>
            </View>
          </>
        ) : (
          <>
            {/* Batch Generator Form */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Toplu Raf Serisi Oluşturucu</Text>
              <Text style={styles.cardSubText}>Belirtilen aralıkta otomatik raf kodları ve QR etiketleri üretir.</Text>

              <Text style={styles.inputLabel}>Koridor Harfi / Kodu</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Örn: A"
                value={batchAisle}
                onChangeText={setBatchAisle}
                autoCapitalize="characters"
              />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: Spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Başlangıç Raf No</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="1"
                    value={startRack}
                    onChangeText={setStartRack}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Bitiş Raf No</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="5"
                    value={endRack}
                    onChangeText={setEndRack}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>Her Raftaki Kat (Seviye) Sayısı</Text>
              <TextInput
                style={styles.inputField}
                placeholder="3"
                value={levelsCount}
                onChangeText={setLevelsCount}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={styles.generateBtn}
                onPress={handleGenerateBatch}
              >
                <CustomIcon name="plus-circle" size={20} color={Colors.onPrimary} />
                <Text style={styles.generateBtnText}>Toplu Raf QR Kodlarını Oluştur</Text>
              </TouchableOpacity>
            </View>

            {/* Generated Batch List */}
            {generatedBatchCodes.length > 0 && (
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.cardSectionTitle}>Üretilen Raflar ({generatedBatchCodes.length})</Text>
                  <TouchableOpacity
                    style={styles.batchPrintBtn}
                    onPress={handlePrintAllBatch}
                    disabled={printing}
                  >
                    <CustomIcon name="printer" size={18} color="#ffffff" />
                    <Text style={styles.batchPrintBtnText}>Hepsini Yazdır</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.batchGrid}>
                  {generatedBatchCodes.map((code, idx) => (
                    <View key={idx} style={styles.batchChip}>
                      <CustomIcon name="barcode-scan" size={14} color={Colors.primary} />
                      <Text style={styles.batchChipCode}>{code}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Printer Selector Modal */}
      <Modal visible={showPrinterModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Etiket Yazıcısı Seçin</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {printers.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.printerItem}
                  onPress={() => {
                    setActivePrinter(p.id, p.name);
                    setShowPrinterModal(false);
                  }}
                >
                  <CustomIcon name="printer" size={20} color={Colors.primary} />
                  <Text style={styles.printerItemName}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowPrinterModal(false)}>
              <Text style={styles.modalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 6,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadow.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.xs,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    ...Typography.labelLg,
    color: Colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  printerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: Spacing.sm,
  },
  printerBarLabel: {
    fontSize: 11,
    color: Colors.outline,
  },
  printerBarName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  qrPreviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    ...Shadow.sm,
  },
  previewHeaderLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.outline,
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  qrDisplayBox: {
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    width: '100%',
  },
  qrCodeValue: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.primary,
    marginTop: Spacing.sm,
    letterSpacing: 1.5,
  },
  qrSubText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  previewDesc: {
    fontSize: 12,
    color: Colors.outline,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
    ...Shadow.card,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: Spacing.xs,
  },
  cardSubText: {
    fontSize: 12,
    color: Colors.outline,
    marginBottom: Spacing.sm,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formatCol: {
    flex: 1,
  },
  dash: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.outline,
    marginHorizontal: 4,
    marginTop: 18,
  },
  inputLabel: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginBottom: 4,
  },
  input: {
    height: 42,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  inputField: {
    height: 42,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Colors.onSurface,
  },
  printBtn: {
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    ...Shadow.sm,
  },
  printBtnDisabled: {
    backgroundColor: Colors.outline,
  },
  printBtnText: {
    color: Colors.onPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.lg,
  },
  generateBtnText: {
    color: Colors.onPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  batchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.md,
  },
  batchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
  },
  batchChipCode: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.onSecondaryContainer,
  },
  batchPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.success || '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
  },
  batchPrintBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  printerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  printerItemName: {
    fontSize: 14,
    color: Colors.onSurface,
  },
  modalCloseBtn: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.outlineVariant,
    borderRadius: BorderRadius.xs,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
