import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/useTheme";

type LoginMode = "password" | "otp";
type OtpStep = "email" | "code";

export default function LoginScreen() {
  const { login, requestOtp, verifyOtp } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Shared state
  const [mode, setMode] = useState<LoginMode>("otp");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Password login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP login state
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<OtpStep>("email");
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const startResendCooldown = () => {
    setResendDisabled(true);
    setResendCountdown(60);
    const interval = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      shake();
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const msg = err?.message || "Login failed";
      if (msg.includes("401")) {
        setError("Invalid email or password");
      } else if (msg.includes("403")) {
        setError("Account is disabled");
      } else {
        setError("Connection error. Please try again.");
      }
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!otpEmail.trim()) {
      setError("Please enter your email address");
      shake();
      return;
    }
    setError("");
    setLoading(true);
    try {
      await requestOtp(otpEmail.trim().toLowerCase());
      setOtpStep("code");
      startResendCooldown();
    } catch (err: any) {
      const msg = err?.message || "Failed to send code";
      if (msg.includes("404")) {
        setError("No account found with this email");
      } else if (msg.includes("403")) {
        setError("Account is disabled");
      } else if (msg.includes("400")) {
        try {
          const parsed = JSON.parse(msg.split(": ").slice(1).join(": "));
          setError(parsed.message || "Failed to send code");
        } catch {
          setError("Failed to send verification code");
        }
      } else {
        setError("Connection error. Please try again.");
      }
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      setError("Please enter the verification code");
      shake();
      return;
    }
    setError("");
    setLoading(true);
    try {
      await verifyOtp(otpEmail.trim().toLowerCase(), otpCode.trim());
    } catch (err: any) {
      const msg = err?.message || "Verification failed";
      if (msg.includes("400")) {
        try {
          const parsed = JSON.parse(msg.split(": ").slice(1).join(": "));
          setError(parsed.message || "Invalid or expired code");
        } catch {
          setError("Invalid or expired verification code");
        }
      } else if (msg.includes("404")) {
        setError("No account found with this email");
      } else if (msg.includes("403")) {
        setError("Account is disabled");
      } else {
        setError("Verification failed. Please try again.");
      }
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendDisabled) return;
    setError("");
    setLoading(true);
    try {
      await requestOtp(otpEmail.trim().toLowerCase());
      startResendCooldown();
    } catch (err: any) {
      setError("Failed to resend code. Please try again.");
      shake();
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: LoginMode) => {
    setMode(newMode);
    setError("");
    setOtpStep("email");
    setOtpCode("");
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.inner,
          { paddingTop: insets.top + webTopInset + 60, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 },
        ]}
      >
        <View style={styles.logoSection}>
          <View style={[styles.logoCircle, { backgroundColor: theme.tint + "18" }]}>
            <Ionicons name="location" size={48} color={theme.tint} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>KnockBase</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Door-to-door sales tracker
          </Text>
        </View>

        {/* Mode Tabs */}
        <View style={[styles.tabRow, { backgroundColor: theme.surface }]}>
          <Pressable
            style={[styles.tab, mode === "otp" && { backgroundColor: theme.tint }]}
            onPress={() => switchMode("otp")}
          >
            <Ionicons
              name="mail-outline"
              size={16}
              color={mode === "otp" ? "#FFF" : theme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, { color: mode === "otp" ? "#FFF" : theme.textSecondary }]}>
              Email Code
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === "password" && { backgroundColor: theme.tint }]}
            onPress={() => switchMode("password")}
          >
            <Ionicons
              name="lock-closed-outline"
              size={16}
              color={mode === "password" ? "#FFF" : theme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, { color: mode === "password" ? "#FFF" : theme.textSecondary }]}>
              Password
            </Text>
          </Pressable>
        </View>

        <Animated.View
          style={[styles.formCard, { backgroundColor: theme.surface, transform: [{ translateX: shakeAnim }] }]}
        >
          {mode === "password" ? (
            <>
              <View style={[styles.inputGroup, { borderColor: theme.border }]}>
                <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Email"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  editable={!loading}
                  testID="email-input"
                />
              </View>

              <View style={[styles.inputGroup, { borderColor: theme.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text, flex: 1 }]}
                  placeholder="Password"
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handlePasswordLogin}
                  editable={!loading}
                  testID="password-input"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
            </>
          ) : otpStep === "email" ? (
            <>
              <Text style={[styles.otpInstructions, { color: theme.textSecondary }]}>
                Enter your email to receive a one-time login code
              </Text>
              <View style={[styles.inputGroup, { borderColor: theme.border }]}>
                <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Email address"
                  placeholderTextColor={theme.textSecondary}
                  value={otpEmail}
                  onChangeText={setOtpEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="done"
                  onSubmitEditing={handleRequestOtp}
                  editable={!loading}
                  testID="otp-email-input"
                />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.otpInstructions, { color: theme.textSecondary }]}>
                Enter the 6-digit code sent to{"\n"}
                <Text style={{ color: theme.text, fontFamily: "Inter_600SemiBold" }}>{otpEmail}</Text>
              </Text>
              <View style={[styles.inputGroup, { borderColor: theme.border }]}>
                <Ionicons name="keypad-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text, letterSpacing: 8, fontSize: 20, fontFamily: "Inter_600SemiBold" }]}
                  placeholder="000000"
                  placeholderTextColor={theme.textSecondary}
                  value={otpCode}
                  onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOtp}
                  editable={!loading}
                  testID="otp-code-input"
                />
              </View>

              <View style={styles.resendRow}>
                <Pressable
                  onPress={() => {
                    setOtpStep("email");
                    setOtpCode("");
                    setError("");
                  }}
                >
                  <Text style={[styles.linkText, { color: theme.tint }]}>Change email</Text>
                </Pressable>
                <Pressable onPress={handleResendOtp} disabled={resendDisabled || loading}>
                  <Text
                    style={[
                      styles.linkText,
                      { color: resendDisabled ? theme.textSecondary : theme.tint },
                    ]}
                  >
                    {resendDisabled ? `Resend in ${resendCountdown}s` : "Resend code"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color={theme.danger} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.loginBtn, { backgroundColor: theme.tint, opacity: loading ? 0.7 : 1 }]}
            onPress={
              mode === "password"
                ? handlePasswordLogin
                : otpStep === "email"
                  ? handleRequestOtp
                  : handleVerifyOtp
            }
            disabled={loading}
            testID="login-button"
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>
                {mode === "password"
                  ? "Sign In"
                  : otpStep === "email"
                    ? "Send Code"
                    : "Verify & Sign In"}
              </Text>
            )}
          </Pressable>
        </Animated.View>

        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Contact your team owner for account access
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  tabRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  formCard: {
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    height: "100%" as any,
  },
  eyeBtn: {
    padding: 4,
  },
  otpInstructions: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  linkText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  loginBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  loginBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  hint: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 24,
  },
});
