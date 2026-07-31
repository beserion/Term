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
      userName: val, // Backend validation'da zorunlu alan olduğu için hep gönderiyoruz
      password
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryContainer} />

      {/* Üst dekoratif alan */}
      <View style={styles.header}>
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
          <CustomIcon name="cog-outline" size={24} color={Colors.onPrimary} />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <CustomIcon name="warehouse" size={48} color={Colors.onPrimary} />
        </View>
        <Text style={styles.appName}>BlueHub</Text>
        <Text style={styles.appSubtitle}>Depo Yönetim Sistemi</Text>
      </View>

      {/* Giriş formu */}
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>Giriş Yap</Text>

        {/* Hata mesajı */}
        {error && (
          <View style={styles.errorBanner}>
            <CustomIcon name="alert-circle" size={20} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={clearError} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <CustomIcon name="close" size={18} color={Colors.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* Kullanıcı Adı */}
        <View style={styles.inputContainer}>
          <CustomIcon name="account-outline" size={22} color={Colors.outline} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Kullanıcı Adı"
            placeholderTextColor={Colors.outline}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        {/* Şifre */}
        <View style={styles.inputContainer}>
          <CustomIcon name="lock-outline" size={22} color={Colors.outline} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Şifre"
            placeholderTextColor={Colors.outline}
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
              size={22}
              color={Colors.outline}
            />
          </TouchableOpacity>
        </View>

        {/* Giriş Butonu */}
        <TouchableOpacity
          style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.onPrimary} size="small" />
          ) : (
            <>
              <CustomIcon name="login" size={20} color={Colors.onPrimary} />
              <Text style={styles.loginButtonText}>Giriş Yap</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

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
              <CustomIcon name="server-network" size={28} color={Colors.primaryContainer} />
              <Text style={styles.modalTitle}>Sunucu Adresi</Text>
            </View>

            <Text style={styles.modalDescription}>
              Lütfen bağlanılacak API sunucu adresini girin. Bu adres cihazınıza bir defaya mahsus kaydedilecektir.
            </Text>

            <View style={styles.modalInputContainer}>
              <CustomIcon name="web" size={20} color={Colors.outline} style={{ marginRight: Spacing.sm }} />
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
                <CustomIcon name="check" size={18} color={Colors.onPrimary} />
                <Text style={styles.modalSaveButtonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryContainer,
  },
  header: {
    flex: 0.35,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    position: 'relative',
  },
  settingsButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: Spacing.xs,
    zIndex: 10,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  appName: {
    ...Typography.headlineLg,
    color: Colors.onPrimary,
    marginBottom: 4,
  },
  appSubtitle: {
    ...Typography.bodyMd,
    color: 'rgba(255,255,255,0.7)',
  },
  formContainer: {
    flex: 0.65,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.xl,
    paddingTop: 32,
  },
  formTitle: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    marginBottom: Spacing.xl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorContainer,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.bodyMd,
    color: Colors.error,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.lg,
    height: 56,
    marginBottom: Spacing.lg,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    ...Typography.bodyLg,
    color: Colors.onSurface,
    height: '100%',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.md,
    height: 56,
    marginTop: Spacing.sm,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
    fontSize: 16,
  },
  // Modal Stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLowest,
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
    ...Typography.headlineSm,
    color: Colors.onSurface,
  },
  modalDescription: {
    ...Typography.bodyMd,
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
    height: 50,
    marginBottom: Spacing.xl,
  },
  modalInput: {
    flex: 1,
    ...Typography.bodyMd,
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
    ...Typography.labelLg,
    color: Colors.onSurfaceVariant,
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalSaveButtonText: {
    ...Typography.labelLg,
    color: Colors.onPrimary,
  },
});

