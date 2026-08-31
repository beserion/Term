import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { TopAppBar } from '../components/TopAppBar';
import { CustomIcon } from '../components/CustomIcon';
import { Colors, Spacing, Typography, BorderRadius, Shadow } from '../theme';
import { useBarcode } from '../hooks/useBarcode';
import { FeedbackService } from '../services/feedback';
import { useUIStore } from '../store/uiStore';
import { CameraScannerModal } from '../components/CameraScannerModal';
import {
  getPackingBoardData,
  createBox,
  createPallet,
  assignItemToBoxOrPallet,
  assignBoxToPallet,
  removeItemFromPacking,
  deleteBox,
  deletePallet,
  processBarcode,
  WMS_PackingBoardVM,
  WMS_BoxVM,
  WMS_PalletVM,
  PackingPendingItemVM,
} from '../services/packing';

type ActiveTab = 'pending' | 'boxes' | 'pallets';

export function PackingBoardScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const showToast = useUIStore((s) => s.showToast);

  const { requestId, documentNo, partnerName, rfqNo } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [boardData, setBoardData] = useState<WMS_PackingBoardVM | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending');

  // Aktif Seçili Hedef Koli veya Palet
  const [selectedTarget, setSelectedTarget] = useState<{
    type: 'box' | 'pallet';
    id: number;
    name: string;
  } | null>(null);

  // Modallar
  const [createBoxModalVisible, setCreateBoxModalVisible] = useState(false);
  const [boxNameInput, setBoxNameInput] = useState('');
  const [boxDimInput, setBoxDimInput] = useState('');
  const [boxWeightInput, setBoxWeightInput] = useState('');

  const [createPalletModalVisible, setCreatePalletModalVisible] = useState(false);
  const [palletVesselInput, setPalletVesselInput] = useState('');
  const [palletDimInput, setPalletDimInput] = useState('');
  const [palletWeightInput, setPalletWeightInput] = useState('');

  const [packModalVisible, setPackModalVisible] = useState(false);
  const [selectedPendingItem, setSelectedPendingItem] = useState<PackingPendingItemVM | null>(null);
  const [packQtyInput, setPackQtyInput] = useState('1');

  const [assignBoxModalVisible, setAssignBoxModalVisible] = useState(false);
  const [boxToAssign, setBoxToAssign] = useState<WMS_BoxVM | null>(null);

  const [cameraScannerVisible, setCameraScannerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Board Verilerini Yükle
  const loadBoardData = useCallback(async () => {
    if (!requestId) return;
    try {
      setLoading(true);
      const data = await getPackingBoardData(requestId);
      setBoardData(data);

      // Otomatik hedef seçimi: İlk koli veya paleti seç
      if (!selectedTarget) {
        if (data.boxes && data.boxes.length > 0) {
          setSelectedTarget({
            type: 'box',
            id: data.boxes[0].id,
            name: data.boxes[0].boxName,
          });
        } else if (data.pallets && data.pallets.length > 0) {
          setSelectedTarget({
            type: 'pallet',
            id: data.pallets[0].id,
            name: data.pallets[0].vesselName,
          });
        }
      }
    } catch (error: any) {
      showToast({ message: error?.message || 'Paketleme verileri yüklenemedi', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [requestId, selectedTarget]);

  useEffect(() => {
    loadBoardData();
  }, []);

  // Barkod Okutma İşleyicisi
  const handleScanBarcode = async (barcode: string) => {
    if (!barcode || submitting) return;
    try {
      setSubmitting(true);
      FeedbackService.playLightImpact();
      showToast({ message: `Barkod Okutuldu: ${barcode}`, type: 'info' });

      // Sunucudan barkod türü tespiti al
      const res = await processBarcode({ barcode });

      if (res && res.type === 'Box') {
        setSelectedTarget({ type: 'box', id: res.data.id, name: res.data.boxName });
        showToast({ message: `Hedef Koli Seçildi: ${res.data.boxName}`, type: 'success' });
        setActiveTab('boxes');
      } else if (res && res.type === 'Pallet') {
        setSelectedTarget({ type: 'pallet', id: res.data.id, name: res.data.vesselName });
        showToast({ message: `Hedef Palet Seçildi: ${res.data.vesselName}`, type: 'success' });
        setActiveTab('pallets');
      } else if (res && res.type === 'Stock') {
        const match = boardData?.pendingItems?.find(
          (i) => i.stockCode?.toLowerCase() === barcode.toLowerCase() || String(i.stockId) === barcode
        );
        if (match) {
          openPackModal(match);
        } else {
          showToast({ message: `Barkod stok olarak algılandı ancak siparişte bulunamadı`, type: 'error' });
        }
      } else {
        showToast({ message: `Barkod İşlendi (${barcode})`, type: 'success' });
      }

      await loadBoardData();
    } catch (err: any) {
      FeedbackService.playError();
      showToast({ message: err?.message || 'Barkod işlenirken hata oluştu', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Hardware Zebra Scanner Hook
  useBarcode(handleScanBarcode);

  // Koli Oluşturma
  const handleCreateBox = async () => {
    if (!boxNameInput.trim()) {
      showToast({ message: 'Lütfen koli adını girin', type: 'error' });
      return;
    }
    try {
      setSubmitting(true);
      await createBox({
        requestId: Number(requestId),
        boxName: boxNameInput.trim(),
        dimensions: boxDimInput.trim() || undefined,
        grossWeight: boxWeightInput ? parseFloat(boxWeightInput) : undefined,
      });
      FeedbackService.playSuccess();
      showToast({ message: 'Yeni koli oluşturuldu', type: 'success' });
      setCreateBoxModalVisible(false);
      setBoxNameInput('');
      setBoxDimInput('');
      setBoxWeightInput('');
      await loadBoardData();
      setActiveTab('boxes');
    } catch (err: any) {
      showToast({ message: err?.message || 'Koli oluşturulamadı', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Palet Oluşturma
  const handleCreatePallet = async () => {
    if (!palletVesselInput.trim()) {
      showToast({ message: 'Lütfen palet/gemi adını girin', type: 'error' });
      return;
    }
    try {
      setSubmitting(true);
      await createPallet({
        requestId: Number(requestId),
        vesselName: palletVesselInput.trim(),
        dimensions: palletDimInput.trim() || undefined,
        grossWeight: palletWeightInput ? parseFloat(palletWeightInput) : undefined,
      });
      FeedbackService.playSuccess();
      showToast({ message: 'Yeni palet oluşturuldu', type: 'success' });
      setCreatePalletModalVisible(false);
      setPalletVesselInput('');
      setPalletDimInput('');
      setPalletWeightInput('');
      await loadBoardData();
      setActiveTab('pallets');
    } catch (err: any) {
      showToast({ message: err?.message || 'Palet oluşturulamadı', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Ürün Paketleme Modalını Aç
  const openPackModal = (item: PackingPendingItemVM) => {
    if (!selectedTarget) {
      showToast({ message: 'Lütfen önce paketlenecek bir hedef Koli veya Palet seçin', type: 'error' });
      return;
    }
    setSelectedPendingItem(item);
    setPackQtyInput(String(item.remainingQty > 0 ? item.remainingQty : 1));
    setPackModalVisible(true);
  };

  // Ürün Paketleme İsteyi Gönder
  const handleAssignItem = async () => {
    if (!selectedPendingItem || !selectedTarget) return;
    const qtyNum = parseFloat(packQtyInput);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      showToast({ message: 'Geçerli bir miktar girin', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      await assignItemToBoxOrPallet({
        orderDetailId: selectedPendingItem.orderDetailId,
        boxId: selectedTarget.type === 'box' ? selectedTarget.id : null,
        palletId: selectedTarget.type === 'pallet' ? selectedTarget.id : null,
        qty: qtyNum,
        stockCode: selectedPendingItem.stockCode,
        stockName: selectedPendingItem.stockName,
        unit: selectedPendingItem.unit,
      });
      FeedbackService.playSuccess();
      showToast({ message: `${selectedPendingItem.stockCode} ürün ${selectedTarget.name} hedefine eklendi`, type: 'success' });
      setPackModalVisible(false);
      setSelectedPendingItem(null);
      await loadBoardData();
    } catch (err: any) {
      FeedbackService.playError();
      showToast({ message: err?.message || 'Ürün paketlenirken hata oluştu', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Koliyi Palete Atama İsteyi
  const handleAssignBoxToPallet = async (targetPalletId: number) => {
    if (!boxToAssign) return;
    try {
      setSubmitting(true);
      await assignBoxToPallet({
        boxId: boxToAssign.id,
        palletId: targetPalletId,
      });
      FeedbackService.playSuccess();
      showToast({ message: `Koli palete başarıyla bağlandı`, type: 'success' });
      setAssignBoxModalVisible(false);
      setBoxToAssign(null);
      await loadBoardData();
    } catch (err: any) {
      showToast({ message: err?.message || 'Koli palete bağlanamadı', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Paket İçi Ürün Çıkarma
  const handleRemoveItem = (lineId: number) => {
    Alert.alert('Ürünü Çıkar', 'Bu ürünü paketten çıkarmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkar',
        style: 'destructive',
        onPress: async () => {
          try {
            setSubmitting(true);
            await removeItemFromPacking(lineId);
            showToast({ message: 'Ürün paketten çıkarıldı', type: 'info' });
            await loadBoardData();
          } catch (err: any) {
            showToast({ message: err?.message || 'Ürün çıkarılamadı', type: 'error' });
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  // Koli Silme
  const handleDeleteBox = (box: WMS_BoxVM) => {
    Alert.alert('Koli Sil', `"${box.boxName}" kolisini ve içindeki bağlantıları silmek istiyor musunuz?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            setSubmitting(true);
            await deleteBox(box.id);
            if (selectedTarget?.type === 'box' && selectedTarget.id === box.id) {
              setSelectedTarget(null);
            }
            showToast({ message: 'Koli silindi', type: 'info' });
            await loadBoardData();
          } catch (err: any) {
            showToast({ message: err?.message || 'Koli silinemedi', type: 'error' });
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  // Palet Silme
  const handleDeletePallet = (pallet: WMS_PalletVM) => {
    Alert.alert('Palet Sil', `"${pallet.vesselName}" paletini ve dökme bağlantılarını silmek istiyor musunuz?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            setSubmitting(true);
            await deletePallet(pallet.id);
            if (selectedTarget?.type === 'pallet' && selectedTarget.id === pallet.id) {
              setSelectedTarget(null);
            }
            showToast({ message: 'Palet silindi', type: 'info' });
            await loadBoardData();
          } catch (err: any) {
            showToast({ message: err?.message || 'Palet silinemedi', type: 'error' });
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  if (loading && !boardData) {
    return (
      <View style={styles.container}>
        <TopAppBar
          title={documentNo || 'Paketleme Tahtası'}
          showBack={true}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Paketleme tahtası yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopAppBar
        title={documentNo || 'Paketleme Tahtası'}
        showBack={true}
        onBack={() => navigation.goBack()}
        actionIcon="barcode-scan"
        onAction={() => setCameraScannerVisible(true)}
      />

      {/* Aktif Sipariş ve Hedef Seçim Çubuğu */}
      <View style={styles.targetBar}>
        <View style={styles.targetInfo}>
          <Text style={styles.targetLabel}>SEÇİLİ PAKETLEME HEDEFİ:</Text>
          {selectedTarget ? (
            <View style={styles.activeTargetBadge}>
              <CustomIcon
                name={selectedTarget.type === 'box' ? 'package-variant-closed' : 'palette-outline'}
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.activeTargetText}>
                {selectedTarget.type === 'box' ? '[KOLİ]' : '[PALET]'} {selectedTarget.name}
              </Text>
            </View>
          ) : (
            <Text style={styles.noTargetText}>Henüz Hedef Seçilmedi (Aşağıdan Koli/Palet Seçin)</Text>
          )}
        </View>
      </View>

      {/* Sekme Butonları (Tabs) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pending' && styles.activeTabButton]}
          onPress={() => setActiveTab('pending')}
        >
          <CustomIcon
            name="format-list-bulleted"
            size={18}
            color={activeTab === 'pending' ? Colors.primary : Colors.outline}
          />
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Bekleyenler ({boardData?.pendingItems?.length || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'boxes' && styles.activeTabButton]}
          onPress={() => setActiveTab('boxes')}
        >
          <CustomIcon
            name="package-variant-closed"
            size={18}
            color={activeTab === 'boxes' ? Colors.primary : Colors.outline}
          />
          <Text style={[styles.tabText, activeTab === 'boxes' && styles.activeTabText]}>
            Koliler ({boardData?.boxes?.length || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pallets' && styles.activeTabButton]}
          onPress={() => setActiveTab('pallets')}
        >
          <CustomIcon
            name="truck-delivery-outline"
            size={18}
            color={activeTab === 'pallets' ? Colors.primary : Colors.outline}
          />
          <Text style={[styles.tabText, activeTab === 'pallets' && styles.activeTabText]}>
            Paletler ({boardData?.pallets?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sekme İçerikleri */}
      <View style={styles.contentContainer}>
        {/* 1. BEKLEYEN ÜRÜNLER SEKMESİ */}
        {activeTab === 'pending' && (
          <FlatList
            data={boardData?.pendingItems || []}
            keyExtractor={(item) => String(item.orderDetailId)}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item }) => (
              <View style={styles.itemCard}>
                <View style={styles.itemCardHeader}>
                  <Text style={styles.stockCode}>{item.stockCode}</Text>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyBadgeText}>
                      Kalan: {item.remainingQty} {item.unit}
                    </Text>
                  </View>
                </View>
                <Text style={styles.stockName}>{item.stockName}</Text>
                <View style={styles.itemCardFooter}>
                  <Text style={styles.progressText}>
                    Toplam: {item.totalQty} | Paketleşen: {item.packedQty}
                  </Text>
                  <TouchableOpacity
                    style={styles.packButton}
                    onPress={() => openPackModal(item)}
                  >
                    <CustomIcon name="plus" size={16} color="#fff" />
                    <Text style={styles.packButtonText}>Paketle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <CustomIcon name="check-circle-outline" size={48} color={Colors.primary} />
                <Text style={styles.emptyTitle}>Tüm Ürünler Paketlenmiş!</Text>
              </View>
            }
          />
        )}

        {/* 2. KOLİLER SEKMESİ */}
        {activeTab === 'boxes' && (
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={styles.createNewButton}
              onPress={() => {
                setBoxNameInput(`Koli-${(boardData?.boxes?.length || 0) + 1}`);
                setCreateBoxModalVisible(true);
              }}
            >
              <CustomIcon name="plus-circle" size={20} color="#fff" />
              <Text style={styles.createNewButtonText}>Yeni Koli Oluştur</Text>
            </TouchableOpacity>

            <FlatList
              data={boardData?.boxes || []}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listPadding}
              renderItem={({ item }) => {
                const isSelected = selectedTarget?.type === 'box' && selectedTarget.id === item.id;
                return (
                  <View style={[styles.boxCard, isSelected && styles.selectedBoxCard]}>
                    <View style={styles.boxCardHeader}>
                      <TouchableOpacity
                        style={styles.boxSelectArea}
                        onPress={() =>
                          setSelectedTarget({ type: 'box', id: item.id, name: item.boxName })
                        }
                      >
                        <CustomIcon
                          name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                          size={22}
                          color={isSelected ? Colors.primary : Colors.outline}
                        />
                        <Text style={styles.boxTitle}>{item.boxName}</Text>
                      </TouchableOpacity>

                      <View style={styles.boxHeaderActions}>
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => {
                            setBoxToAssign(item);
                            setAssignBoxModalVisible(true);
                          }}
                        >
                          <CustomIcon name="link-variant" size={20} color={Colors.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => handleDeleteBox(item)}
                        >
                          <CustomIcon name="trash-can-outline" size={20} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {item.dimensions || item.grossWeight ? (
                      <Text style={styles.boxMetaText}>
                        {item.dimensions ? `Ebat: ${item.dimensions}  ` : ''}
                        {item.grossWeight ? `Ağırlık: ${item.grossWeight} kg` : ''}
                      </Text>
                    ) : null}

                    {item.palletId ? (
                      <Text style={styles.assignedPalletText}>
                        <CustomIcon name="truck-delivery" size={14} color={Colors.primary} /> Bağlı Palet ID: #{item.palletId}
                      </Text>
                    ) : null}

                    {/* Koli İçi Ürünler */}
                    <View style={styles.boxLinesContainer}>
                      <Text style={styles.boxLinesHeader}>Koli İçeriği ({item.lines?.length || 0} Kalem):</Text>
                      {item.lines && item.lines.length > 0 ? (
                        item.lines.map((line) => (
                          <View key={line.id} style={styles.boxLineRow}>
                            <Text style={styles.boxLineText} numberOfLines={1}>
                              • {line.stockCode} ({line.qty} {line.unit || 'ADET'})
                            </Text>
                            <TouchableOpacity onPress={() => handleRemoveItem(line.id)}>
                              <CustomIcon name="close" size={16} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyBoxText}>Koli henüz boş</Text>
                      )}
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <CustomIcon name="package-variant" size={48} color={Colors.outline} />
                  <Text style={styles.emptyTitle}>Henüz Koli Oluşturulmadı</Text>
                </View>
              }
            />
          </View>
        )}

        {/* 3. PALETLER SEKMESİ */}
        {activeTab === 'pallets' && (
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={[styles.createNewButton, { backgroundColor: Colors.secondary }]}
              onPress={() => {
                setPalletVesselInput(`Palet-${(boardData?.pallets?.length || 0) + 1}`);
                setCreatePalletModalVisible(true);
              }}
            >
              <CustomIcon name="plus-circle" size={20} color="#fff" />
              <Text style={styles.createNewButtonText}>Yeni Palet Oluştur</Text>
            </TouchableOpacity>

            <FlatList
              data={boardData?.pallets || []}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listPadding}
              renderItem={({ item }) => {
                const isSelected = selectedTarget?.type === 'pallet' && selectedTarget.id === item.id;
                return (
                  <View style={[styles.boxCard, isSelected && styles.selectedPalletCard]}>
                    <View style={styles.boxCardHeader}>
                      <TouchableOpacity
                        style={styles.boxSelectArea}
                        onPress={() =>
                          setSelectedTarget({ type: 'pallet', id: item.id, name: item.vesselName })
                        }
                      >
                        <CustomIcon
                          name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                          size={22}
                          color={isSelected ? Colors.secondary : Colors.outline}
                        />
                        <Text style={styles.boxTitle}>{item.vesselName}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => handleDeletePallet(item)}
                      >
                        <CustomIcon name="trash-can-outline" size={20} color={Colors.error} />
                      </TouchableOpacity>
                    </View>

                    {item.dimensions || item.grossWeight ? (
                      <Text style={styles.boxMetaText}>
                        {item.dimensions ? `Ebat: ${item.dimensions}  ` : ''}
                        {item.grossWeight ? `Ağırlık: ${item.grossWeight} kg` : ''}
                      </Text>
                    ) : null}

                    {/* Palet İçi Bağlı Koliler */}
                    <View style={styles.boxLinesContainer}>
                      <Text style={styles.boxLinesHeader}>
                        Bağlı Koliler ({item.boxes?.length || 0}) / Dökme Ürünler ({item.lines?.length || 0}):
                      </Text>

                      {item.boxes && item.boxes.length > 0 ? (
                        item.boxes.map((b) => (
                          <View key={b.id} style={styles.boxLineRow}>
                            <Text style={styles.boxLineText} numberOfLines={1}>
                              📦 {b.boxName} ({b.lines?.length || 0} ürün)
                            </Text>
                          </View>
                        ))
                      ) : null}

                      {item.lines && item.lines.length > 0 ? (
                        item.lines.map((line) => (
                          <View key={line.id} style={styles.boxLineRow}>
                            <Text style={styles.boxLineText} numberOfLines={1}>
                              • {line.stockCode} ({line.qty} {line.unit || 'ADET'}) [Dökme]
                            </Text>
                            <TouchableOpacity onPress={() => handleRemoveItem(line.id)}>
                              <CustomIcon name="close" size={16} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        ))
                      ) : null}

                      {(!item.boxes || item.boxes.length === 0) && (!item.lines || item.lines.length === 0) ? (
                        <Text style={styles.emptyBoxText}>Palet henüz boş</Text>
                      ) : null}
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <CustomIcon name="truck-delivery-outline" size={48} color={Colors.outline} />
                  <Text style={styles.emptyTitle}>Henüz Palet Oluşturulmadı</Text>
                </View>
              }
            />
          </View>
        )}
      </View>

      {/* KOLI OLUŞTURMA MODALI */}
      <Modal visible={createBoxModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni Koli Oluştur</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Koli Adı / Kodu (örn: Koli-101)"
              value={boxNameInput}
              onChangeText={setBoxNameInput}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Ebat (Örn: 60x40x40 cm)"
              value={boxDimInput}
              onChangeText={setBoxDimInput}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Brüt Ağırlık (kg)"
              keyboardType="numeric"
              value={boxWeightInput}
              onChangeText={setBoxWeightInput}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCreateBoxModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreateBox}
                disabled={submitting}
              >
                <Text style={styles.modalSubmitText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PALET OLUŞTURMA MODALI */}
      <Modal visible={createPalletModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni Palet Oluştur</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Palet / Gemi Adı (örn: Palet-01)"
              value={palletVesselInput}
              onChangeText={setPalletVesselInput}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Ebat (Örn: 120x80 cm)"
              value={palletDimInput}
              onChangeText={setPalletDimInput}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Brüt Ağırlık (kg)"
              keyboardType="numeric"
              value={palletWeightInput}
              onChangeText={setPalletWeightInput}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCreatePalletModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: Colors.secondary }]}
                onPress={handleCreatePallet}
                disabled={submitting}
              >
                <Text style={styles.modalSubmitText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ÜRÜN PAKETLEME MİKTAR MODALI */}
      <Modal visible={packModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ürün Paketle</Text>
            {selectedPendingItem ? (
              <View style={styles.packItemSummary}>
                <Text style={styles.packStockCode}>{selectedPendingItem.stockCode}</Text>
                <Text style={styles.packStockName}>{selectedPendingItem.stockName}</Text>
                <Text style={styles.packTargetInfo}>
                  Hedef: <Text style={{ fontWeight: 'bold' }}>{selectedTarget?.name}</Text>
                </Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Paketlenecek Miktar ({selectedPendingItem?.unit || 'ADET'}):</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={packQtyInput}
              onChangeText={setPackQtyInput}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPackModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleAssignItem}
                disabled={submitting}
              >
                <Text style={styles.modalSubmitText}>Paketle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* KOLİYİ PALETE ATAMA MODALI */}
      <Modal visible={assignBoxModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Koliyi Palete Bağla</Text>
            <Text style={styles.packItemSummary}>
              Seçilen Koli: <Text style={{ fontWeight: 'bold' }}>{boxToAssign?.boxName}</Text>
            </Text>

            <Text style={styles.inputLabel}>Hedef Palet Seçin:</Text>
            <ScrollView style={{ maxHeight: 200, marginVertical: Spacing.sm }}>
              {boardData?.pallets && boardData.pallets.length > 0 ? (
                boardData.pallets.map((pallet) => (
                  <TouchableOpacity
                    key={pallet.id}
                    style={styles.palletSelectOption}
                    onPress={() => handleAssignBoxToPallet(pallet.id)}
                  >
                    <CustomIcon name="truck-delivery-outline" size={18} color={Colors.secondary} />
                    <Text style={styles.palletOptionText}>{pallet.vesselName}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{ color: Colors.outline, textAlign: 'center', marginVertical: 10 }}>
                  Henüz tanımlı palet bulunmuyor
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCancelBtn, { width: '100%' }]}
              onPress={() => setAssignBoxModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* KAMERA BARKOD SCANNARI */}
      <CameraScannerModal
        visible={cameraScannerVisible}
        onClose={() => setCameraScannerVisible(false)}
        onScan={handleScanBarcode}
      />
    </View>
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
  loadingText: {
    ...Typography.bodyMd,
    color: Colors.outline,
    marginTop: Spacing.md,
  },
  targetBar: {
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: Spacing.marginMobile,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  targetInfo: {
    flexDirection: 'column',
    gap: 4,
  },
  targetLabel: {
    ...Typography.labelSmall,
    color: Colors.onSecondaryContainer,
    fontWeight: 'bold',
  },
  activeTargetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  activeTargetText: {
    ...Typography.bodyMd,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  noTargetText: {
    ...Typography.bodySm,
    color: Colors.error,
    fontStyle: 'italic',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    ...Typography.bodySm,
    color: Colors.outline,
    fontWeight: '600',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  listPadding: {
    padding: Spacing.marginMobile,
    paddingBottom: 100,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockCode: {
    ...Typography.titleMedium,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  qtyBadge: {
    backgroundColor: Colors.tertiaryContainer,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  qtyBadgeText: {
    ...Typography.labelSmall,
    color: Colors.onTertiaryContainer,
    fontWeight: 'bold',
  },
  stockName: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    marginVertical: 4,
  },
  itemCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  progressText: {
    ...Typography.bodySm,
    color: Colors.outline,
  },
  packButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  packButtonText: {
    ...Typography.labelMedium,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    margin: Spacing.marginMobile,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  createNewButtonText: {
    ...Typography.button,
    color: '#ffffff',
  },
  boxCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  selectedBoxCard: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: '#f0f7ff',
  },
  selectedPalletCard: {
    borderColor: Colors.secondary,
    borderWidth: 2,
    backgroundColor: '#fff7f0',
  },
  boxCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boxSelectArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  boxTitle: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: 'bold',
  },
  boxHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconActionBtn: {
    padding: 6,
  },
  boxMetaText: {
    ...Typography.bodySm,
    color: Colors.outline,
    marginTop: 4,
  },
  assignedPalletText: {
    ...Typography.bodySm,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  boxLinesContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  boxLinesHeader: {
    ...Typography.labelSmall,
    color: Colors.onSurfaceVariant,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  boxLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  boxLineText: {
    ...Typography.bodySm,
    color: Colors.onSurface,
    flex: 1,
  },
  emptyBoxText: {
    ...Typography.bodySm,
    color: Colors.outline,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.titleMedium,
    color: Colors.outline,
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  modalTitle: {
    ...Typography.titleLarge,
    color: Colors.onSurface,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Colors.onSurface,
    marginBottom: Spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalCancelBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outline,
    alignItems: 'center',
  },
  modalCancelText: {
    ...Typography.button,
    color: Colors.onSurface,
  },
  modalSubmitBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSubmitText: {
    ...Typography.button,
    color: '#ffffff',
  },
  packItemSummary: {
    backgroundColor: Colors.secondaryContainer,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  packStockCode: {
    ...Typography.titleMedium,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  packStockName: {
    ...Typography.bodyMd,
    color: Colors.onSecondaryContainer,
    marginVertical: 2,
  },
  packTargetInfo: {
    ...Typography.bodySm,
    color: Colors.onSecondaryContainer,
    marginTop: 4,
  },
  inputLabel: {
    ...Typography.labelMedium,
    color: Colors.onSurface,
    marginBottom: 4,
  },
  palletSelectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  palletOptionText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '600',
  },
});
