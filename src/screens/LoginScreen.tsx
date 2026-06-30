import React, { useState } from 'react';
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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { useAuthStore } from '../store/authStore';

export function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

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
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons name="warehouse" size={48} color={Colors.onPrimary} />
        </View>
        <Text style={styles.appName}>GEMINI</Text>
        <Text style={styles.appSubtitle}>BlueHub Depo Yönetim Sistemi</Text>
      </View>

      {/* Giriş formu */}
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>Giriş Yap</Text>

        {/* Hata mesajı */}
        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={clearError} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close" size={18} color={Colors.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* Kullanıcı Adı */}
        <View style={styles.inputContainer}>
          <MaterialCommunityIcons name="account-outline" size={22} color={Colors.outline} style={styles.inputIcon} />
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
          <MaterialCommunityIcons name="lock-outline" size={22} color={Colors.outline} style={styles.inputIcon} />
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
            <MaterialCommunityIcons
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
              <MaterialCommunityIcons name="login" size={20} color={Colors.onPrimary} />
              <Text style={styles.loginButtonText}>Giriş Yap</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
});
