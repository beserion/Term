import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { CustomIcon } from '../components/CustomIcon';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { Config } from '../config';
import { resetApiInstance } from '../services/api';

export function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // API Base URL Modal state
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState('');

  const { login, isLoading, error, clearError } = useAuthStore();
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    const checkServerConfig = async () => {
      const isSet = await Config.isApiBaseUrlSet();
      const currentUrl = await Config.getApiBaseUrl();
      setApiUrlInput(currentUrl);

      // Cihaz hafızasında henüz URL yoksa modalı otomatik aç
      if (!isSet) {
        setShowApiModal(true);
      }
    };
    checkServerConfig();
  }, []);

  const handleSaveApiUrl = async () => {
    const trimmed = apiUrlInput.trim();
    if (!trimmed) {
      showToast({ message: 'Lütfen geçerli bir URL girin', type: 'error' });
      return;
    }

    await Config.setApiBaseUrl(trimmed);
    resetApiInstance();
    setShowApiModal(false);
    showToast({ message: 'API sunucu adresi kaydedildi', type: 'success' });
  };

  const handleLogin = async () => {
    const val = username.trim();
    if (!val || !password.trim()) return;

    const isEmail = val.includes('@');
    await login({
      email: isEmail ? val : undefined,
      userName: val,
      password
    });
  };

  return (
    <ImageBackground
      source={require('../../assets/wms_login_bg.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Dark Overlay Layer */}
      <View style={styles.overlay} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Bar Settings */}
          <View style={styles.topHeaderBar}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={async () => {
                const currentUrl = await Config.getApiBaseUrl();
                setApiUrlInput(currentUrl);
                setShowApiModal(true);
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <CustomIcon name="cog-outline" size={22} color="#ffffff" />
              <Text style={styles.settingsText}>Sunucu Ayarları</Text>
            </TouchableOpacity>
          </View>

          {/* Branding Hero */}
          <View style={styles.heroSection}>
            <View style={styles.logoBadge}>
              <CustomIcon name="warehouse" size={44} color="#38bdf8" />
            </View>
            <Text style={styles.brandTitle}>BLUEHUB WMS</Text>
            <Text style={styles.brandSubtitle}>Akıllı El Terminali & Stok Yönetimi</Text>
          </View>

          {/* Glassmorphism Login Card */}
          <View style={styles.glassCard}>
            <Text style={styles.cardHeaderTitle}>Terminal Girişi</Text>
            <Text style={styles.cardHeaderSubtitle}>Devam etmek için hesabınızla oturum açın</Text>

            {/* Hata mesajı */}
            {error && (
              <View style={styles.errorBanner}>
                <CustomIcon name="alert-circle" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={clearError} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <CustomIcon name="close" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}

            {/* Kullanıcı Adı */}
            <View style={styles.inputContainer}>
              <CustomIcon name="account-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Kullanıcı Adı"
                placeholderTextColor="#64748b"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Şifre */}
            <View style={styles.inputContainer}>
              <CustomIcon name="lock-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Şifre"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <CustomIcon
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#94a3b8"
                />
              </TouchableOpacity>
            </View>

            {/* Giriş Butonu */}
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <CustomIcon name="login" size={20} color="#ffffff" />
                  <Text style={styles.loginButtonText}>GİRİŞ YAP</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.footerNoteContainer}>
              <CustomIcon name="shield-check" size={14} color="#38bdf8" />
              <Text style={styles.footerNoteText}>BlueHub WMS v2.5 Secure Session</Text>
            </View>
          </View>
        </ScrollView>

        {/* Sunucu Adresi Yapılandırma Modalı */}
        <Modal
          visible={showApiModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowApiModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <CustomIcon name="cog-outline" size={26} color={Colors.primary} />
                <Text style={styles.modalTitle}>Sunucu Adresi Ayarları</Text>
              </View>

              <Text style={styles.modalDescription}>
                Lütfen bağlanılacak BlueHub ERP API sunucu adresini girin.
              </Text>

              <View style={styles.modalInputContainer}>
                <CustomIcon name="link-variant" size={20} color={Colors.outline} style={{ marginRight: Spacing.sm }} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="https://arkship.posnetx.com/api"
                  placeholderTextColor={Colors.outline}
                  value={apiUrlInput}
                  onChangeText={setApiUrlInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowApiModal(false)}
                >
                  <Text style={styles.modalCancelButtonText}>Vazgeç</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleSaveApiUrl}
                  activeOpacity={0.8}
                >
                  <CustomIcon name="content-save" size={18} color="#ffffff" />
                  <Text style={styles.modalSaveButtonText}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 12, 27, 0.72)',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'android' ? 44 : 54,
    paddingBottom: Spacing.xxl,
    justifyContent: 'space-between',
  },
  topHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.sm,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingsText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  glassCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...Shadow.lg,
  },
  cardHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: Spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: BorderRadius.xs,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  errorText: {
    fontSize: 13,
    color: '#fca5a5',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: Spacing.lg,
    height: 52,
    marginBottom: Spacing.lg,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#ffffff',
    height: '100%',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#0284c7',
    borderRadius: BorderRadius.md,
    height: 52,
    marginTop: Spacing.xs,
    ...Shadow.md,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  footerNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.lg,
  },
  footerNoteText: {
    fontSize: 11,
    color: '#64748b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  modalDescription: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.lg,
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    height: 48,
    marginBottom: Spacing.xl,
  },
  modalInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.onSurface,
    height: '100%',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  modalCancelButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalSaveButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
