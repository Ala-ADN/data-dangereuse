import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  TouchableOpacity,
  TextInput,
  Switch,
  Text,
  View,
  StyleSheet,
  Platform,
  Animated,
  ActivityIndicator,
  Modal,
  Dimensions,
  Pressable,
  Easing,
  Alert,
  Image,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  uploadForOCR,
  predictFromFeatures,
  getExplanation,
  type OCRResponse,
  type PredictionRequest,
  type PredictionResponse,
  type ExplanationResponse,
  type FeatureImportance,
} from "@/services/api";

// ═══════════════════════════════════════════════════════════════════════════════
// OLEA INSURANCE — Design Tokens
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  primary: "#F8AF3C",
  accent: "#B7482B",
  textPrimary: "#666666",
  textHeading: "#000000",
  border: "#B8B8B8",
  background: "#FFFFFF",
  surface: "#CBBBA0",
  appBg: "#F4F2EE",
  white: "#FFFFFF",
  overlay: "rgba(0,0,0,0.45)",
  scannerBg: "#0D0D1A",
  inputBg: "#FAFAF8",
  successLight: "#E8F5E9",
  success: "#388E3C",
  dangerLight: "#FFF3E0",
  autoFillBorder: "#F8AF3C",
  accentLight: "rgba(183,72,43,0.08)",
  primaryLight: "rgba(248,175,60,0.10)",
  surfaceLight: "rgba(203,187,160,0.18)",
};

const R = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

const SHADOW_CARD = {
  shadowColor: "#9E8E78",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.1,
  shadowRadius: 16,
  elevation: 5,
};

const SHADOW_BUTTON = {
  shadowColor: "#F8AF3C",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 8,
};

const { width: SCREEN_W } = Dimensions.get("window");

// ═══════════════════════════════════════════════════════════════════════════════
// Types & Mock Data
// ═══════════════════════════════════════════════════════════════════════════════

type Screen = "Home" | "Scanner" | "Form" | "Result";

// ── Form data mirrors all 27 backend OCR columns ──
interface FormData {
  // Demographics & Financials
  Adult_Dependents: string;
  Child_Dependents: string;
  Infant_Dependents: string;
  Estimated_Annual_Income: string;
  Employment_Status: string;
  Region_Code: string;
  // Customer History & Risk Profile
  Existing_Policyholder: boolean;
  Previous_Claims_Filed: string;
  Years_Without_Claims: string;
  Previous_Policy_Duration_Months: string;
  Policy_Cancelled_Post_Purchase: boolean;
  // Policy Details & Preferences
  Deductible_Tier: string;
  Payment_Schedule: string;
  Vehicles_on_Policy: string;
  Custom_Riders_Requested: string;
  Grace_Period_Extensions: string;
  // Sales & Underwriting
  Days_Since_Quote: string;
  Underwriting_Processing_Days: string;
  Policy_Amendments_Count: string;
  Acquisition_Channel: string;
  Broker_Agency_Type: string;
  Broker_ID: string;
  Employer_ID: string;
  // Timeline
  Policy_Start_Year: string;
  Policy_Start_Month: string;
  Policy_Start_Week: string;
  Policy_Start_Day: string;
}

const EMPTY_FORM: FormData = {
  Adult_Dependents: "",
  Child_Dependents: "",
  Infant_Dependents: "",
  Estimated_Annual_Income: "",
  Employment_Status: "",
  Region_Code: "",
  Existing_Policyholder: false,
  Previous_Claims_Filed: "",
  Years_Without_Claims: "",
  Previous_Policy_Duration_Months: "",
  Policy_Cancelled_Post_Purchase: false,
  Deductible_Tier: "",
  Payment_Schedule: "",
  Vehicles_on_Policy: "",
  Custom_Riders_Requested: "",
  Grace_Period_Extensions: "",
  Days_Since_Quote: "",
  Underwriting_Processing_Days: "",
  Policy_Amendments_Count: "",
  Acquisition_Channel: "",
  Broker_Agency_Type: "",
  Broker_ID: "",
  Employer_ID: "",
  Policy_Start_Year: "",
  Policy_Start_Month: "",
  Policy_Start_Week: "",
  Policy_Start_Day: "",
};

/** Which form keys were auto-filled by OCR (dynamic, set after scan). */
type OCRMeta = {
  filledKeys: Set<keyof FormData>;
  fieldStatuses: Record<string, string>;
  fieldConfidences: Record<string, number>;
  overallConfidence: number;
  matchedCount: number;
  totalFields: number;
};

/** Bundle ID → display name */
const BUNDLE_NAMES: Record<number, string> = {
  0: "Auto Comprehensive",
  1: "Auto Liability Basic",
  2: "Basic Health",
  3: "Family Comprehensive",
  4: "Health Dental Vision",
  5: "Home Premium",
  6: "Home Standard",
  7: "Premium Health & Life",
  8: "Renter Basic",
  9: "Renter Premium",
};

const BUNDLE_CATEGORIES: Record<number, string> = {
  0: "Auto",
  1: "Auto",
  2: "Health",
  3: "Family",
  4: "Health",
  5: "Home",
  6: "Home",
  7: "Health",
  8: "Renter",
  9: "Renter",
};

const BUNDLE_ICONS: Record<string, string> = {
  Auto: "car-sport",
  Health: "medkit",
  Family: "people",
  Home: "home",
  Renter: "key",
  Life: "heart",
};

// ═══════════════════════════════════════════════════════════════════════════════
// Animation Hook
// ═══════════════════════════════════════════════════════════════════════════════

function useFadeIn(duration = 500, delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Reusable Components
// ═══════════════════════════════════════════════════════════════════════════════

/* ─── Screen Header ─── */
function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  return (
    <View style={s.header}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={s.backBtn}
          activeOpacity={0.6}
        >
          <Ionicons name="chevron-back" size={22} color={C.textHeading} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 40 }} />
      )}
      <Text style={s.headerTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

/* ─── Form Card ─── */
function FormCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const anim = useFadeIn(500, 100);
  return (
    <Animated.View style={[s.card, anim]}>
      <View style={s.cardHeader}>
        {icon}
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      <View style={s.cardContent}>{children}</View>
    </Animated.View>
  );
}

/* ─── Labeled Input ─── */
function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  isAutoFilled = false,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "email-address";
  isAutoFilled?: boolean;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = focused
    ? C.primary
    : isAutoFilled
      ? C.autoFillBorder
      : C.border;
  return (
    <View style={s.inputGroup}>
      <Text style={s.inputLabel}>{label}</Text>
      <View
        style={[
          s.inputWrapper,
          { borderColor },
          isAutoFilled && s.autoFillBg,
          !editable && { backgroundColor: "#F0EDE8" },
        ]}
      >
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
          placeholderTextColor="#B0AAA0"
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={editable}
        />
        {isAutoFilled && (
          <View style={s.autoFillBadge}>
            <Ionicons name="sparkles" size={13} color={C.primary} />
          </View>
        )}
      </View>
    </View>
  );
}

/* ─── Stepper ─── */
function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 20,
  isAutoFilled = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  isAutoFilled?: boolean;
}) {
  return (
    <View style={s.inputGroup}>
      <Text style={s.inputLabel}>{label}</Text>
      <View
        style={[
          s.stepperRow,
          isAutoFilled && {
            borderColor: C.autoFillBorder,
            backgroundColor: C.primaryLight,
          },
        ]}
      >
        <TouchableOpacity
          style={[s.stepperBtn, value <= min && { opacity: 0.35 }]}
          onPress={() => value > min && onChange(value - 1)}
          activeOpacity={0.6}
        >
          <Feather name="minus" size={18} color={C.accent} />
        </TouchableOpacity>
        <Text style={s.stepperValue}>{value}</Text>
        <TouchableOpacity
          style={[s.stepperBtn, value >= max && { opacity: 0.35 }]}
          onPress={() => value < max && onChange(value + 1)}
          activeOpacity={0.6}
        >
          <Feather name="plus" size={18} color={C.accent} />
        </TouchableOpacity>
        {isAutoFilled && (
          <View style={[s.autoFillBadge, { right: 10 }]}>
            <Ionicons name="sparkles" size={13} color={C.primary} />
          </View>
        )}
      </View>
    </View>
  );
}

/* ─── Dropdown ─── */
function Dropdown({
  label,
  value,
  options,
  onSelect,
  isAutoFilled = false,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  isAutoFilled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const borderColor = isAutoFilled ? C.autoFillBorder : C.border;
  return (
    <View style={s.inputGroup}>
      <Text style={s.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={[
          s.inputWrapper,
          { borderColor, flexDirection: "row", alignItems: "center" },
          isAutoFilled && s.autoFillBg,
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[s.input, { flex: 1 }, !value && { color: "#B0AAA0" }]}>
          {value || `Select ${label}`}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={C.textPrimary}
          style={{ marginRight: 4 }}
        />
        {isAutoFilled && (
          <View
            style={[
              s.autoFillBadge,
              { position: "relative", right: 0, top: 0, marginLeft: 4 },
            ]}
          >
            <Ionicons name="sparkles" size={13} color={C.primary} />
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={s.modalOverlay} onPress={() => setOpen(false)}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{label}</Text>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  s.modalOption,
                  opt === value && { backgroundColor: C.primaryLight },
                ]}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    s.modalOptionText,
                    opt === value && { color: C.accent, fontWeight: "700" },
                  ]}
                >
                  {opt}
                </Text>
                {opt === value && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={C.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ─── Toggle Field ─── */
function ToggleField({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <Text style={[s.inputLabel, { flex: 1, marginBottom: 0 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#D9D3CB", true: C.primary }}
        thumbColor={C.white}
        ios_backgroundColor="#D9D3CB"
      />
    </View>
  );
}

/* ─── Collapsible Section ─── */
function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.timing(rotation, {
      toValue: open ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    setOpen(!open);
  };

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={s.collapsible}>
      <TouchableOpacity
        style={s.collapsibleHeader}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <Ionicons name="server-outline" size={16} color={C.textPrimary} />
        <Text style={s.collapsibleTitle}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-down" size={18} color={C.textPrimary} />
        </Animated.View>
      </TouchableOpacity>
      {open && <View style={s.collapsibleBody}>{children}</View>}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Screen 1 — HOME / ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════════

function HomeView({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const a1 = useFadeIn(600, 0);
  const a2 = useFadeIn(600, 150);
  const a3 = useFadeIn(600, 350);
  const a4 = useFadeIn(600, 550);

  // Floating shield animation
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -10,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <SafeAreaView style={s.homeContainer}>
      {/* Decorative background blobs */}
      <View style={s.homeBlobA} />
      <View style={s.homeBlobB} />
      <View style={s.homeBlobC} />

      <ScrollView
        contentContainerStyle={s.homeScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <Animated.View style={[s.homeBrand, a1]}>
          <View style={s.homeBrandRow}>
            <View style={s.homeLogoCircle}>
              <MaterialCommunityIcons
                name="shield-check"
                size={28}
                color={C.white}
              />
            </View>
            <View>
              <Text style={s.homeBrandOlea}>OLEA</Text>
              <Text style={s.homeBrandSub}>INSURANCE</Text>
            </View>
          </View>
        </Animated.View>

        {/* Hero illustration */}
        <Animated.View
          style={[s.homeHero, { transform: [{ translateY: float }] }]}
        >
          <View style={s.homeShieldOuter}>
            <View style={s.homeShieldInner}>
              <MaterialCommunityIcons
                name="shield-star"
                size={64}
                color={C.accent}
              />
            </View>
          </View>
        </Animated.View>

        {/* Tagline */}
        <Animated.View style={a2}>
          <Text style={s.homeTagline}>
            Get your smart insurance{"\n"}recommendation{" "}
            <Text style={{ color: C.primary }}>in a snap.</Text>
          </Text>
          <Text style={s.homeSubtag}>
            Powered by AI to find the perfect coverage bundle for you and your
            family.
          </Text>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View style={[s.homeActions, a3]}>
          <TouchableOpacity
            style={s.homePrimaryBtn}
            onPress={() => onNavigate("Scanner")}
            activeOpacity={0.85}
          >
            <View style={s.homeBtnIcon}>
              <Ionicons name="cloud-upload-outline" size={22} color={C.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.homePrimaryBtnText}>Scan a document</Text>
              <Text style={s.homePrimaryBtnHint}>
                Recommended — fastest way
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={C.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.homeSecondaryBtn}
            onPress={() => onNavigate("Form")}
            activeOpacity={0.85}
          >
            <View style={s.homeBtnIconSec}>
              <Feather name="edit-3" size={20} color={C.textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.homeSecondaryBtnText}>Fill manually</Text>
              <Text style={s.homeSecondaryBtnHint}>Enter details by hand</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={C.border} />
          </TouchableOpacity>
        </Animated.View>

        {/* Footer tagline */}
        <Animated.View style={a4}>
          <Text style={s.homeFooter}>
            Your data stays private. Always encrypted.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Screen 2 — SCANNER (Real Camera + OCR)
// ═══════════════════════════════════════════════════════════════════════════════

function ScannerView({
  onNavigate,
  onScanComplete,
}: {
  onNavigate: (s: Screen) => void;
  onScanComplete: (ocrResult: OCRResponse) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanLine = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const uploadIconBounce = useRef(new Animated.Value(0)).current;
  const anim = useFadeIn(400);

  // Bounce animation for the upload area icon
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(uploadIconBounce, {
          toValue: -8,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(uploadIconBounce, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // Scan line loop (only active during scanning)
  useEffect(() => {
    if (phase !== "scanning") return;
    scanLine.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scanLine, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // Pulse for upload button
  useEffect(() => {
    if (phase !== "upload") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const lineTranslateY = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  /** Pick an image then run OCR */
  const pickAndScan = async (useCamera: boolean) => {
    setError(null);

    // Request permissions
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Camera access is required to scan documents.",
        );
        return;
      }
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.9,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.9,
        });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setPreviewUri(asset.uri);
    setScanning(true);

    try {
      const ocrResult = await uploadForOCR(
        asset.uri,
        asset.fileName ?? "scan.jpg",
      );
      onScanComplete(ocrResult);
      onNavigate("Form");
    } catch (e: any) {
      console.error("OCR failed:", e);
      setError(e.message ?? "OCR extraction failed");
      setScanning(false);
    }
  };

  const isScanning = phase === "scanning";

  return (
    <SafeAreaView style={s.scanContainer}>
      <Animated.View style={[{ flex: 1 }, anim]}>
        <ScreenHeader title="Scan Document" onBack={() => onNavigate("Home")} />

        <View style={s.scanBody}>
          {/* Viewfinder / Preview */}
          <View style={s.viewfinder}>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="contain"
              />
            ) : (
              <>
                {/* Corner brackets */}
                <View style={[s.corner, s.cornerTL]} />
                <View style={[s.corner, s.cornerTR]} />
                <View style={[s.corner, s.cornerBL]} />
                <View style={[s.corner, s.cornerBR]} />

                {/* Scan line */}
                <Animated.View
                  style={[
                    s.scanLineBar,
                    { transform: [{ translateY: lineTranslateY }] },
                  ]}
                />
                {/* Scan line */}
                <Animated.View
                  style={[
                    s.scanLineBar,
                    { transform: [{ translateY: lineTranslateY }] },
                  ]}
                />

                {/* Center icon */}
                <View style={s.scanCenterIcon}>
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={48}
                    color="rgba(248,175,60,0.3)"
                  />
                </View>
              </>
            )}

            {scanning && (
              <View style={s.scanOverlay}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={s.scanOverlayText}>AI analyzing document...</Text>
              </View>
            )}
          </View>

          {error ? (
            <View style={s.scanErrorBox}>
              <Ionicons name="alert-circle" size={18} color={C.accent} />
              <Text style={s.scanErrorText}>{error}</Text>
            </View>
          ) : (
            <Text style={s.scanHint}>
              Take a photo or pick an image of your insurance form
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={s.scanFooter}>
          <View style={s.scanBtnRow}>
            {/* Camera button */}
            <Animated.View
              style={{ transform: [{ scale: scanning ? 1 : pulseAnim }] }}
            >
              <TouchableOpacity
                style={[s.shutterBtn, scanning && { opacity: 0.5 }]}
                onPress={() => pickAndScan(true)}
                disabled={scanning}
                activeOpacity={0.8}
              >
                <View style={s.shutterInner}>
                  {scanning ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : (
                    <Ionicons name="camera" size={28} color={C.white} />
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Gallery picker */}
            <TouchableOpacity
              style={[s.galleryBtn, scanning && { opacity: 0.5 }]}
              onPress={() => pickAndScan(false)}
              disabled={scanning}
              activeOpacity={0.8}
            >
              <Ionicons name="images-outline" size={24} color={C.white} />
            </TouchableOpacity>
          </View>
          <Text style={s.shutterLabel}>
            {scanning ? "Processing…" : "Camera  ·  Gallery"}
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Screen 3 — SMART FORM
// ═══════════════════════════════════════════════════════════════════════════════

function FormView({
  isAutoFilled,
  formData,
  setFormData,
  ocrMeta,
  onNavigate,
  onSubmitPrediction,
}: {
  isAutoFilled: boolean;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  ocrMeta: OCRMeta | null;
  onNavigate: (s: Screen) => void;
  onSubmitPrediction: (form: FormData) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const badgeAnim = useFadeIn(500, 0);

  const update = useCallback(
    <K extends keyof FormData>(key: K, val: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: val }));
    },
    [setFormData],
  );

  /** Was this field auto-filled by OCR? */
  const isAF = (key: keyof FormData) =>
    isAutoFilled && (ocrMeta?.filledKeys.has(key) ?? false);

  /** Get OCR status for a field (for the badge) */
  const ocrStatus = (key: keyof FormData) =>
    ocrMeta?.fieldStatuses[key] ?? "missing";

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmitPrediction(formData);
    } catch (e: any) {
      console.error("Prediction failed:", e);
      setSubmitError(e.message ?? "Prediction request failed");
      setSubmitting(false);
    }
  };

  const confidencePct = ocrMeta
    ? Math.round(ocrMeta.overallConfidence * 100)
    : 0;

  return (
    <SafeAreaView style={s.formContainer}>
      <ScreenHeader
        title="Verify your data"
        onBack={() => onNavigate("Home")}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={s.formScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Auto-fill confidence banner */}
          {isAutoFilled && ocrMeta && (
            <Animated.View style={[s.autoFillNotice, badgeAnim]}>
              <Text style={s.autoFillNoticeIcon}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.autoFillNoticeText}>
                  OCR extracted{" "}
                  <Text style={{ fontWeight: "800" }}>
                    {ocrMeta.matchedCount}/{ocrMeta.totalFields}
                  </Text>{" "}
                  fields ({confidencePct}% confidence).
                  {ocrMeta.matchedCount < ocrMeta.totalFields &&
                    " Please fill the remaining fields."}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* ─── Card 1: Demographics & Financials ─── */}
          <FormCard
            title="Demographics & Financials"
            icon={
              <Ionicons
                name="people-circle-outline"
                size={20}
                color={C.accent}
              />
            }
          >
            <LabeledInput
              label="Estimated Annual Income"
              value={formData.Estimated_Annual_Income}
              onChangeText={(t) => update("Estimated_Annual_Income", t)}
              placeholder="e.g. 65000"
              keyboardType="numeric"
              isAutoFilled={isAF("Estimated_Annual_Income")}
            />
            <Dropdown
              label="Employment Status"
              value={formData.Employment_Status}
              options={[
                "Employed",
                "Self-Employed",
                "Unemployed",
                "Retired",
                "Student",
                "Part-Time",
                "Freelancer",
              ]}
              onSelect={(v) => update("Employment_Status", v)}
              isAutoFilled={isAF("Employment_Status")}
            />
            <LabeledInput
              label="Adult Dependents"
              value={formData.Adult_Dependents}
              onChangeText={(t) => update("Adult_Dependents", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Adult_Dependents")}
            />
            <LabeledInput
              label="Child Dependents"
              value={formData.Child_Dependents}
              onChangeText={(t) => update("Child_Dependents", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Child_Dependents")}
            />
            <LabeledInput
              label="Infant Dependents"
              value={formData.Infant_Dependents}
              onChangeText={(t) => update("Infant_Dependents", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Infant_Dependents")}
            />
            <LabeledInput
              label="Region Code"
              value={formData.Region_Code}
              onChangeText={(t) => update("Region_Code", t)}
              placeholder="e.g. R-105"
              isAutoFilled={isAF("Region_Code")}
            />
          </FormCard>

          {/* ─── Card 2: Customer History & Risk ─── */}
          <FormCard
            title="Customer History & Risk"
            icon={
              <MaterialCommunityIcons
                name="history"
                size={20}
                color={C.accent}
              />
            }
          >
            <ToggleField
              label="Existing Policyholder?"
              value={formData.Existing_Policyholder}
              onToggle={(v) => update("Existing_Policyholder", v)}
            />
            <LabeledInput
              label="Previous Claims Filed"
              value={formData.Previous_Claims_Filed}
              onChangeText={(t) => update("Previous_Claims_Filed", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Previous_Claims_Filed")}
            />
            <LabeledInput
              label="Years Without Claims"
              value={formData.Years_Without_Claims}
              onChangeText={(t) => update("Years_Without_Claims", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Years_Without_Claims")}
            />
            <LabeledInput
              label="Previous Policy Duration (Months)"
              value={formData.Previous_Policy_Duration_Months}
              onChangeText={(t) => update("Previous_Policy_Duration_Months", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Previous_Policy_Duration_Months")}
            />
            <ToggleField
              label="Policy Cancelled Post-Purchase?"
              value={formData.Policy_Cancelled_Post_Purchase}
              onToggle={(v) => update("Policy_Cancelled_Post_Purchase", v)}
            />
          </FormCard>

          {/* ─── Card 3: Policy Preferences ─── */}
          <FormCard
            title="Policy Preferences"
            icon={
              <Ionicons name="options-outline" size={20} color={C.accent} />
            }
          >
            <Dropdown
              label="Deductible Tier"
              value={formData.Deductible_Tier}
              options={["Low", "Medium", "High"]}
              onSelect={(v) => update("Deductible_Tier", v)}
              isAutoFilled={isAF("Deductible_Tier")}
            />
            <Dropdown
              label="Payment Schedule"
              value={formData.Payment_Schedule}
              options={["Monthly", "Quarterly", "Semi-Annual", "Annual"]}
              onSelect={(v) => update("Payment_Schedule", v)}
              isAutoFilled={isAF("Payment_Schedule")}
            />
            <LabeledInput
              label="Vehicles on Policy"
              value={formData.Vehicles_on_Policy}
              onChangeText={(t) => update("Vehicles_on_Policy", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Vehicles_on_Policy")}
            />
            <LabeledInput
              label="Custom Riders Requested"
              value={formData.Custom_Riders_Requested}
              onChangeText={(t) => update("Custom_Riders_Requested", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Custom_Riders_Requested")}
            />
            <LabeledInput
              label="Grace Period Extensions"
              value={formData.Grace_Period_Extensions}
              onChangeText={(t) => update("Grace_Period_Extensions", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Grace_Period_Extensions")}
            />
          </FormCard>

          {/* ─── Card 4: Sales & Underwriting ─── */}
          <FormCard
            title="Sales & Underwriting"
            icon={
              <Ionicons name="briefcase-outline" size={20} color={C.accent} />
            }
          >
            <Dropdown
              label="Acquisition Channel"
              value={formData.Acquisition_Channel}
              options={[
                "Online",
                "Agent",
                "Phone",
                "Broker",
                "Direct",
                "Referral",
              ]}
              onSelect={(v) => update("Acquisition_Channel", v)}
              isAutoFilled={isAF("Acquisition_Channel")}
            />
            <Dropdown
              label="Broker Agency Type"
              value={formData.Broker_Agency_Type}
              options={["Small", "Medium", "Large", "Corporate", "Independent"]}
              onSelect={(v) => update("Broker_Agency_Type", v)}
              isAutoFilled={isAF("Broker_Agency_Type")}
            />
            <LabeledInput
              label="Broker ID"
              value={formData.Broker_ID}
              onChangeText={(t) => update("Broker_ID", t)}
              placeholder="e.g. BRK-4421"
              isAutoFilled={isAF("Broker_ID")}
            />
            <LabeledInput
              label="Employer ID"
              value={formData.Employer_ID}
              onChangeText={(t) => update("Employer_ID", t)}
              placeholder="e.g. EMP-8832"
              isAutoFilled={isAF("Employer_ID")}
            />
            <LabeledInput
              label="Days Since Quote"
              value={formData.Days_Since_Quote}
              onChangeText={(t) => update("Days_Since_Quote", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Days_Since_Quote")}
            />
            <LabeledInput
              label="Underwriting Processing Days"
              value={formData.Underwriting_Processing_Days}
              onChangeText={(t) => update("Underwriting_Processing_Days", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Underwriting_Processing_Days")}
            />
            <LabeledInput
              label="Policy Amendments Count"
              value={formData.Policy_Amendments_Count}
              onChangeText={(t) => update("Policy_Amendments_Count", t)}
              placeholder="0"
              keyboardType="numeric"
              isAutoFilled={isAF("Policy_Amendments_Count")}
            />
          </FormCard>

          {/* ─── Collapsible: Timeline ─── */}
          <CollapsibleSection title="Policy Start Date">
            <LabeledInput
              label="Policy Start Year"
              value={formData.Policy_Start_Year}
              onChangeText={(t) => update("Policy_Start_Year", t)}
              placeholder="e.g. 2026"
              keyboardType="numeric"
              isAutoFilled={isAF("Policy_Start_Year")}
            />
            <Dropdown
              label="Policy Start Month"
              value={formData.Policy_Start_Month}
              options={[
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
              ]}
              onSelect={(v) => update("Policy_Start_Month", v)}
              isAutoFilled={isAF("Policy_Start_Month")}
            />
            <LabeledInput
              label="Policy Start Week"
              value={formData.Policy_Start_Week}
              onChangeText={(t) => update("Policy_Start_Week", t)}
              placeholder="1-52"
              keyboardType="numeric"
              isAutoFilled={isAF("Policy_Start_Week")}
            />
            <LabeledInput
              label="Policy Start Day"
              value={formData.Policy_Start_Day}
              onChangeText={(t) => update("Policy_Start_Day", t)}
              placeholder="1-31"
              keyboardType="numeric"
              isAutoFilled={isAF("Policy_Start_Day")}
            />
          </CollapsibleSection>

          {/* Submit error */}
          {submitError && (
            <View style={s.formErrorBox}>
              <Ionicons name="alert-circle" size={18} color={C.accent} />
              <Text style={s.formErrorText}>{submitError}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={s.submitBtn}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting ? (
              <View style={{ alignItems: "center", gap: 6 }}>
                <ActivityIndicator color={C.white} />
                <Text style={[s.submitBtnText, { fontSize: 13 }]}>
                  Running AI prediction…
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.submitBtnText}>Generate my custom offer</Text>
                <Ionicons
                  name="arrow-forward-circle"
                  size={22}
                  color={C.white}
                />
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Screen 4 — RESULT & EXPLAINABILITY
// ═══════════════════════════════════════════════════════════════════════════════

function ResultView({
  onNavigate,
  prediction,
  explanation,
}: {
  onNavigate: (s: Screen) => void;
  prediction: PredictionResponse;
  explanation: ExplanationResponse | null;
}) {
  const a1 = useFadeIn(500, 0);
  const a2 = useFadeIn(600, 200);
  const a3 = useFadeIn(600, 400);
  const a4 = useFadeIn(600, 600);

  // Scale-in for the badge
  const badgeScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(badgeScale, {
      toValue: 1,
      friction: 5,
      tension: 80,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Derive bundle info from prediction
  const bundleId: number =
    prediction.result?.predicted_bundle ?? prediction.result?.prediction ?? 0;
  const bundleName = BUNDLE_NAMES[bundleId] ?? `Bundle ${bundleId}`;
  const bundleCategory = BUNDLE_CATEGORIES[bundleId] ?? "Insurance";
  const bundleIcon = BUNDLE_ICONS[bundleCategory] ?? "shield-checkmark";
  const confidencePct = Math.round((prediction.confidence ?? 0) * 100);

  // Sort feature importances by absolute value, take top 6
  const topFeatures = (explanation?.feature_importances ?? [])
    .slice()
    .sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance))
    .slice(0, 6);
  const maxImportance =
    topFeatures.length > 0
      ? Math.max(...topFeatures.map((f) => Math.abs(f.importance)))
      : 1;

  /** Make feature names human-readable */
  const humanize = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  /** Bar color cycle */
  const barColors = [
    C.primary,
    C.accent,
    C.success,
    "#5C6BC0",
    "#00897B",
    "#8D6E63",
  ];

  return (
    <SafeAreaView style={s.resultContainer}>
      <ScreenHeader title="Your Offer" onBack={() => onNavigate("Form")} />
      <ScrollView
        contentContainerStyle={s.resultScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Success badge */}
        <Animated.View
          style={[s.resultBadge, { transform: [{ scale: badgeScale }] }]}
        >
          <View style={s.resultBadgeInner}>
            <Ionicons name="checkmark-circle" size={44} color={C.success} />
          </View>
        </Animated.View>

        {/* ─── Result Card ─── */}
        <Animated.View style={[s.resultCard, a2]}>
          <Text style={s.resultCardTitle}>Your Ideal Insurance Bundle</Text>

          <View style={s.resultDivider} />

          <Text style={s.resultLabel}>Predicted Coverage</Text>

          <View style={s.resultTierBox}>
            <View style={s.resultTierBadge}>
              <Text style={s.resultTierNumber}>{bundleId}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.resultTierName}>{bundleName}</Text>
              <Text style={s.resultTierDesc}>
                Tier {bundleId} — {bundleCategory}
              </Text>
            </View>
            <Ionicons name={bundleIcon as any} size={28} color={C.accent} />
          </View>

          <View style={s.resultStatsRow}>
            <View style={s.resultStat}>
              <Text style={s.resultStatValue}>{confidencePct}%</Text>
              <Text style={s.resultStatLabel}>Confidence</Text>
            </View>
            <View style={[s.resultStat, s.resultStatMid]}>
              <Text style={s.resultStatValue}>
                {prediction.model_version ?? "—"}
              </Text>
              <Text style={s.resultStatLabel}>Model</Text>
            </View>
            <View style={s.resultStat}>
              <Ionicons name={bundleIcon as any} size={24} color={C.primary} />
              <Text style={s.resultStatLabel}>{bundleCategory}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ─── SHAP / AI Insights ─── */}
        {explanation && (
          <Animated.View style={[s.shapBox, a3]}>
            <View style={s.shapHeader}>
              <MaterialCommunityIcons name="brain" size={20} color={C.accent} />
              <Text style={s.shapTitle}>
                {explanation.method === "shap" ? "SHAP" : "AI"} Insights
              </Text>
            </View>

            {explanation.summary ? (
              <Text style={s.shapText}>{explanation.summary}</Text>
            ) : null}

            {topFeatures.length > 0 && (
              <View style={s.shapBars}>
                {topFeatures.map((feat, i) => {
                  const pct = Math.round(
                    (Math.abs(feat.importance) / maxImportance) * 100,
                  );
                  const isPositive = feat.importance >= 0;
                  return (
                    <View key={feat.feature} style={s.shapBarRow}>
                      <Text style={s.shapBarLabel} numberOfLines={1}>
                        {humanize(feat.feature)}
                      </Text>
                      <View style={s.shapBarTrack}>
                        <View
                          style={[
                            s.shapBarFill,
                            {
                              width: `${pct}%`,
                              backgroundColor: barColors[i % barColors.length],
                            },
                          ]}
                        />
                      </View>
                      <Text style={s.shapBarVal}>
                        {isPositive ? "+" : ""}
                        {feat.importance.toFixed(2)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {explanation.llm_explanation ? (
              <Text
                style={[s.shapText, { marginTop: 14, fontStyle: "italic" }]}
              >
                {explanation.llm_explanation}
              </Text>
            ) : null}
          </Animated.View>
        )}

        {/* ─── Action Buttons ─── */}
        <Animated.View style={a4}>
          <TouchableOpacity
            style={s.resultPrimaryBtn}
            activeOpacity={0.85}
            onPress={() => {}}
          >
            <Ionicons
              name="checkmark-done"
              size={20}
              color={C.white}
              style={{ marginRight: 8 }}
            />
            <Text style={s.resultPrimaryBtnText}>Subscribe to this offer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.resultSecondaryBtn}
            activeOpacity={0.7}
            onPress={() => onNavigate("Home")}
          >
            <Text style={s.resultSecondaryBtnText}>Start a new simulation</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP — State Machine
// ═══════════════════════════════════════════════════════════════════════════════

export default function OleaInsuranceApp() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("Home");
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });
  const [ocrMeta, setOcrMeta] = useState<OCRMeta | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(
    null,
  );

  const navigate = useCallback(
    (screen: Screen) => {
      if (screen === "Home") {
        // Reset everything
        setIsAutoFilled(false);
        setFormData({ ...EMPTY_FORM });
        setOcrMeta(null);
        setPrediction(null);
        setExplanation(null);
      }
      if (screen === "Form" && !isAutoFilled) {
        // Manual entry — keep empty form
        setFormData({ ...EMPTY_FORM });
      }
      setCurrentScreen(screen);
    },
    [isAutoFilled],
  );

  /** Map OCR response to form state */
  const handleScanComplete = useCallback((ocrResult: OCRResponse) => {
    const filledKeys = new Set<keyof FormData>();
    const newForm: FormData = { ...EMPTY_FORM };

    // Boolean fields need special handling
    const boolFields = new Set<string>([
      "Existing_Policyholder",
      "Policy_Cancelled_Post_Purchase",
    ]);

    for (const [key, value] of Object.entries(ocrResult.fields)) {
      if (!(key in newForm)) continue;
      const status = ocrResult.field_statuses[key];
      if (status !== "extracted" || value == null) continue;

      if (boolFields.has(key)) {
        (newForm as any)[key] = Boolean(value);
      } else {
        (newForm as any)[key] = String(value);
      }
      filledKeys.add(key as keyof FormData);
    }

    const totalFields = Object.keys(EMPTY_FORM).length;
    setFormData(newForm);
    setIsAutoFilled(true);
    setOcrMeta({
      filledKeys,
      fieldStatuses: ocrResult.field_statuses,
      fieldConfidences: ocrResult.field_confidences,
      overallConfidence: ocrResult.confidence,
      matchedCount: ocrResult.stats.matched_fields,
      totalFields,
    });
  }, []);

  /** Convert FormData (all strings/booleans) → PredictionRequest (typed numerics) */
  const buildPredictionRequest = useCallback(
    (form: FormData): PredictionRequest => {
      const int = (v: string | boolean, fallback = 0) => {
        if (typeof v === "boolean") return v ? 1 : 0;
        const n = parseInt(String(v), 10);
        return isNaN(n) ? fallback : n;
      };
      const float = (v: string | boolean, fallback = 0) => {
        const n = parseFloat(String(v));
        return isNaN(n) ? fallback : n;
      };
      /** Extract numeric part from ID strings like 'BRK-4421' → 4421 */
      const numericId = (v: string): number | undefined => {
        if (!v) return undefined;
        const m = v.match(/[\d.]+/);
        return m ? parseFloat(m[0]) : undefined;
      };
      const now = new Date();

      return {
        Region_Code: form.Region_Code || undefined,
        Broker_ID: numericId(form.Broker_ID),
        Broker_Agency_Type: form.Broker_Agency_Type || undefined,
        Employer_ID: form.Employer_ID || undefined,
        Estimated_Annual_Income: float(form.Estimated_Annual_Income),
        Employment_Status: form.Employment_Status || "Full-time",
        Adult_Dependents: int(form.Adult_Dependents),
        Child_Dependents: form.Child_Dependents
          ? int(form.Child_Dependents)
          : undefined,
        Infant_Dependents: int(form.Infant_Dependents),
        Previous_Policy_Duration_Months: int(
          form.Previous_Policy_Duration_Months,
        ),
        Previous_Claims_Filed: int(form.Previous_Claims_Filed),
        Years_Without_Claims: int(form.Years_Without_Claims),
        Deductible_Tier: form.Deductible_Tier || undefined,
        Vehicles_on_Policy: int(form.Vehicles_on_Policy),
        Custom_Riders_Requested: int(form.Custom_Riders_Requested),
        Acquisition_Channel: form.Acquisition_Channel || undefined,
        Payment_Schedule: form.Payment_Schedule || "Monthly",
        Days_Since_Quote: int(form.Days_Since_Quote),
        Underwriting_Processing_Days: int(form.Underwriting_Processing_Days),
        Policy_Start_Month:
          form.Policy_Start_Month || String(now.getMonth() + 1),
        Policy_Cancelled_Post_Purchase: int(
          form.Policy_Cancelled_Post_Purchase,
        ),
        Policy_Start_Year: int(form.Policy_Start_Year, now.getFullYear()),
        Policy_Start_Week: int(form.Policy_Start_Week, 1),
        Policy_Start_Day: int(form.Policy_Start_Day, 1),
        Grace_Period_Extensions: int(form.Grace_Period_Extensions),
        Existing_Policyholder: int(form.Existing_Policyholder),
        Policy_Amendments_Count: int(form.Policy_Amendments_Count),
      };
    },
    [],
  );

  /** Submit form → prediction → explanation → navigate to Result */
  const handleFormSubmit = useCallback(
    async (form: FormData) => {
      const request = buildPredictionRequest(form);

      // 1. Get prediction
      const pred = await predictFromFeatures(request);
      setPrediction(pred);

      // 2. Try to get explanation (non-blocking — show results even if this fails)
      try {
        const expl = await getExplanation(pred.id);
        setExplanation(expl);
      } catch (e) {
        console.warn("Explanation unavailable:", e);
        setExplanation(null);
      }

      // 3. Navigate to Result
      setCurrentScreen("Result");
    },
    [buildPredictionRequest],
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.appBg }}>
      {currentScreen === "Home" && <HomeView onNavigate={navigate} />}
      {currentScreen === "Scanner" && (
        <ScannerView
          onNavigate={navigate}
          onScanComplete={handleScanComplete}
        />
      )}
      {currentScreen === "Form" && (
        <FormView
          isAutoFilled={isAutoFilled}
          formData={formData}
          setFormData={setFormData}
          ocrMeta={ocrMeta}
          onNavigate={navigate}
          onSubmitPrediction={handleFormSubmit}
        />
      )}
      {currentScreen === "Result" && prediction && (
        <ResultView
          onNavigate={navigate}
          prediction={prediction}
          explanation={explanation}
        />
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  /* ─── Common ─── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW_CARD,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.textHeading,
    letterSpacing: 0.3,
  },

  /* ─── Card ─── */
  card: {
    backgroundColor: C.white,
    borderRadius: R.lg,
    marginBottom: 20,
    ...SHADOW_CARD,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.accent,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  cardContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  /* ─── Inputs ─── */
  inputGroup: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textPrimary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    backgroundColor: C.inputBg,
    position: "relative",
  },
  input: {
    fontSize: 16,
    color: C.textHeading,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    fontWeight: "500",
  },
  autoFillBg: {
    backgroundColor: C.primaryLight,
    borderColor: C.autoFillBorder,
  },
  autoFillBadge: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ─── Stepper ─── */
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 6,
    paddingVertical: 6,
    position: "relative",
  },
  stepperBtn: {
    width: 42,
    height: 42,
    borderRadius: R.sm,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW_CARD,
  },
  stepperValue: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: C.textHeading,
  },

  /* ─── Toggle ─── */
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE9E3",
  },

  /* ─── Collapsible ─── */
  collapsible: {
    backgroundColor: C.white,
    borderRadius: R.lg,
    marginBottom: 20,
    ...SHADOW_CARD,
    overflow: "hidden",
  },
  collapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  collapsibleTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: C.textPrimary,
    letterSpacing: 0.2,
  },
  collapsibleBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#EDE9E3",
  },

  /* ─── Modal ─── */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: C.overlay,
  },
  modalSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D9D3CB",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textHeading,
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: R.md,
    marginBottom: 4,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: C.textHeading,
  },

  /* ═══ HOME ═══ */
  homeContainer: {
    flex: 1,
    backgroundColor: C.appBg,
  },
  homeScroll: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 16 : 40,
    paddingBottom: 40,
  },
  homeBlobA: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(248,175,60,0.08)",
    top: -60,
    right: -80,
  },
  homeBlobB: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(183,72,43,0.06)",
    top: 300,
    left: -70,
  },
  homeBlobC: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(203,187,160,0.12)",
    bottom: 100,
    right: -30,
  },
  homeBrand: {
    marginBottom: 32,
  },
  homeBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  homeLogoCircle: {
    width: 48,
    height: 48,
    borderRadius: R.md,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  homeBrandOlea: {
    fontSize: 26,
    fontWeight: "900",
    color: C.accent,
    letterSpacing: 3,
  },
  homeBrandSub: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textPrimary,
    letterSpacing: 4,
    marginTop: -2,
  },
  homeHero: {
    alignItems: "center",
    marginBottom: 36,
  },
  homeShieldOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  homeShieldInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW_CARD,
  },
  homeTagline: {
    fontSize: 28,
    fontWeight: "800",
    color: C.textHeading,
    lineHeight: 36,
    marginBottom: 12,
  },
  homeSubtag: {
    fontSize: 15,
    color: C.textPrimary,
    lineHeight: 22,
    marginBottom: 36,
  },
  homeActions: {
    gap: 14,
    marginBottom: 32,
  },
  homePrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.primary,
    borderRadius: R.lg,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
    ...SHADOW_BUTTON,
  },
  homeBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  homePrimaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: C.white,
  },
  homePrimaryBtnHint: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  homeSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: R.lg,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  homeBtnIconSec: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    backgroundColor: C.appBg,
    alignItems: "center",
    justifyContent: "center",
  },
  homeSecondaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textHeading,
  },
  homeSecondaryBtnHint: {
    fontSize: 12,
    color: C.textPrimary,
    marginTop: 2,
  },
  homeFooter: {
    textAlign: "center",
    fontSize: 12,
    color: C.border,
    letterSpacing: 0.3,
  },

  /* ═══ SCANNER ═══ */
  scanContainer: {
    flex: 1,
    backgroundColor: C.scannerBg,
  },
  scanBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  viewfinder: {
    width: SCREEN_W - 80,
    height: 280,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: C.primary,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: C.primary,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: C.primary,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: C.primary,
    borderBottomRightRadius: 4,
  },
  scanLineBar: {
    position: "absolute",
    top: 20,
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: C.primary,
    borderRadius: 1,
    opacity: 0.6,
  },
  scanCenterIcon: {
    opacity: 0.5,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,13,26,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  scanOverlayText: {
    color: C.white,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 16,
    letterSpacing: 0.3,
  },
  scanHint: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 18,
  },
  scanFooter: {
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    paddingTop: 20,
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: C.primary,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterLabel: {
    color: C.white,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
    letterSpacing: 0.5,
  },
  scanBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  galleryBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  scanErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.dangerLight,
    borderRadius: R.md,
  },
  scanErrorText: {
    color: C.accent,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  /* ─── Form Error ─── */
  formErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.dangerLight,
    borderRadius: R.md,
  },
  formErrorText: {
    color: C.accent,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  /* ═══ FORM ═══ */
  formContainer: {
    flex: 1,
    backgroundColor: C.appBg,
  },
  formScroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  autoFillNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.primaryLight,
    borderRadius: R.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: C.primary,
    gap: 10,
  },
  autoFillNoticeIcon: {
    fontSize: 20,
  },
  autoFillNoticeText: {
    flex: 1,
    fontSize: 13,
    color: C.textHeading,
    fontWeight: "500",
    lineHeight: 18,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accent,
    borderRadius: R.lg,
    paddingVertical: 18,
    marginTop: 10,
    gap: 10,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: C.white,
    letterSpacing: 0.3,
  },

  /* ═══ RESULT ═══ */
  resultContainer: {
    flex: 1,
    backgroundColor: C.appBg,
  },
  resultScroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    alignItems: "center",
  },
  resultBadge: {
    marginBottom: 20,
    marginTop: 8,
  },
  resultBadgeInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.successLight,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCard: {
    backgroundColor: C.white,
    borderRadius: R.xl,
    padding: 24,
    width: "100%",
    marginBottom: 20,
    ...SHADOW_CARD,
  },
  resultCardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.textHeading,
    textAlign: "center",
    marginBottom: 4,
  },
  resultDivider: {
    height: 1,
    backgroundColor: "#EDE9E3",
    marginVertical: 18,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textPrimary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  resultTierBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.primaryLight,
    borderRadius: R.lg,
    padding: 16,
    gap: 14,
    borderWidth: 1.5,
    borderColor: C.primary,
    marginBottom: 20,
  },
  resultTierBadge: {
    width: 52,
    height: 52,
    borderRadius: R.md,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  resultTierNumber: {
    fontSize: 24,
    fontWeight: "900",
    color: C.white,
  },
  resultTierName: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textPrimary,
    letterSpacing: 0.3,
  },
  resultTierDesc: {
    fontSize: 15,
    fontWeight: "700",
    color: C.accent,
    marginTop: 2,
  },
  resultStatsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#EDE9E3",
    paddingTop: 16,
  },
  resultStat: {
    flex: 1,
    alignItems: "center",
  },
  resultStatMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#EDE9E3",
  },
  resultStatValue: {
    fontSize: 22,
    fontWeight: "800",
    color: C.textHeading,
  },
  resultStatLabel: {
    fontSize: 11,
    color: C.textPrimary,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.3,
  },

  /* ─── SHAP Box ─── */
  shapBox: {
    backgroundColor: "#FAF8F5",
    borderRadius: R.lg,
    padding: 20,
    width: "100%",
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: C.accent,
  },
  shapHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  shapTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.accent,
    letterSpacing: 0.4,
  },
  shapText: {
    fontSize: 14,
    lineHeight: 21,
    color: C.textPrimary,
    marginBottom: 16,
  },
  shapHighlight: {
    fontWeight: "700",
    color: C.textHeading,
    backgroundColor: "rgba(248,175,60,0.15)",
    paddingHorizontal: 2,
  },
  shapBars: {
    gap: 10,
  },
  shapBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shapBarLabel: {
    width: 90,
    fontSize: 11,
    fontWeight: "600",
    color: C.textPrimary,
  },
  shapBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EDE9E3",
    overflow: "hidden",
  },
  shapBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  shapBarVal: {
    width: 40,
    fontSize: 12,
    fontWeight: "700",
    color: C.textHeading,
    textAlign: "right",
  },

  /* ─── Result Buttons ─── */
  resultPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.primary,
    borderRadius: R.lg,
    paddingVertical: 18,
    width: "100%",
    marginBottom: 14,
    ...SHADOW_BUTTON,
  },
  resultPrimaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: C.white,
  },
  resultSecondaryBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  resultSecondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.accent,
    textDecorationLine: "underline",
  },
});
