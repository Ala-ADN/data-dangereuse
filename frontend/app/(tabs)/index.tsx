import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

// ═══════════════════════════════════════════════════════════════════════════════
// OLEA INSURANCE — Design Tokens
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  primary: '#F8AF3C',
  accent: '#B7482B',
  textPrimary: '#666666',
  textHeading: '#000000',
  border: '#B8B8B8',
  background: '#FFFFFF',
  surface: '#CBBBA0',
  appBg: '#F4F2EE',
  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.45)',
  scannerBg: '#0D0D1A',
  inputBg: '#FAFAF8',
  successLight: '#E8F5E9',
  success: '#388E3C',
  dangerLight: '#FFF3E0',
  autoFillBorder: '#F8AF3C',
  accentLight: 'rgba(183,72,43,0.08)',
  primaryLight: 'rgba(248,175,60,0.10)',
  surfaceLight: 'rgba(203,187,160,0.18)',
};

const R = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

const SHADOW_CARD = {
  shadowColor: '#9E8E78',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.10,
  shadowRadius: 16,
  elevation: 5,
};

const SHADOW_BUTTON = {
  shadowColor: '#F8AF3C',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 8,
};

const { width: SCREEN_W } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════════
// Types & Mock Data
// ═══════════════════════════════════════════════════════════════════════════════

type Screen = 'Home' | 'Scanner' | 'Form' | 'Result';

interface FormData {
  estimatedAnnualIncome: string;
  employmentStatus: string;
  adultDependents: number;
  childDependents: number;
  infantDependents: number;
  regionCode: string;
  existingPolicyholder: boolean;
  previousClaimsFiled: string;
  yearsWithoutClaims: string;
  previousPolicyDuration: string;
  policyCancelledPostPurchase: boolean;
  deductibleTier: string;
  paymentSchedule: string;
  vehiclesOnPolicy: number;
  customRidersRequested: string;
  gracePeriodExtensions: string;
  brokerId: string;
  policyStartDate: string;
  underwritingProcessingDays: string;
}

const EMPTY_FORM: FormData = {
  estimatedAnnualIncome: '',
  employmentStatus: '',
  adultDependents: 0,
  childDependents: 0,
  infantDependents: 0,
  regionCode: '',
  existingPolicyholder: false,
  previousClaimsFiled: '',
  yearsWithoutClaims: '',
  previousPolicyDuration: '',
  policyCancelledPostPurchase: false,
  deductibleTier: '',
  paymentSchedule: '',
  vehiclesOnPolicy: 1,
  customRidersRequested: '',
  gracePeriodExtensions: '',
  brokerId: 'BRK-2026-0847',
  policyStartDate: '2026-03-01',
  underwritingProcessingDays: '14',
};

const AUTOFILL_FORM: Partial<FormData> = {
  estimatedAnnualIncome: '72000',
  employmentStatus: 'Employed',
  adultDependents: 1,
  childDependents: 2,
  infantDependents: 1,
  regionCode: 'CA-90210',
};

const AUTOFILL_KEYS = Object.keys(AUTOFILL_FORM) as (keyof FormData)[];

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
  keyboardType = 'default',
  isAutoFilled = false,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
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
          !editable && { backgroundColor: '#F0EDE8' },
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
          { borderColor, flexDirection: 'row', alignItems: 'center' },
          isAutoFilled && s.autoFillBg,
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            s.input,
            { flex: 1 },
            !value && { color: '#B0AAA0' },
          ]}
        >
          {value || `Select ${label}`}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={C.textPrimary}
          style={{ marginRight: 4 }}
        />
        {isAutoFilled && (
          <View style={[s.autoFillBadge, { position: 'relative', right: 0, top: 0, marginLeft: 4 }]}>
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
                    opt === value && { color: C.accent, fontWeight: '700' },
                  ]}
                >
                  {opt}
                </Text>
                {opt === value && (
                  <Ionicons name="checkmark-circle" size={20} color={C.primary} />
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
        trackColor={{ false: '#D9D3CB', true: C.primary }}
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
    outputRange: ['0deg', '180deg'],
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
      ])
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
            Get your smart insurance{'\n'}recommendation{' '}
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
            onPress={() => onNavigate('Scanner')}
            activeOpacity={0.85}
          >
            <View style={s.homeBtnIcon}>
              <Ionicons name="cloud-upload-outline" size={22} color={C.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.homePrimaryBtnText}>Upload a document</Text>
              <Text style={s.homePrimaryBtnHint}>Recommended — fastest way</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={C.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.homeSecondaryBtn}
            onPress={() => onNavigate('Form')}
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
// Screen 2 — SCANNER (OCR Simulation)
// ═══════════════════════════════════════════════════════════════════════════════

function ScannerView({
  onNavigate,
  onScanComplete,
}: {
  onNavigate: (s: Screen) => void;
  onScanComplete: () => void;
}) {
  const [phase, setPhase] = useState<'upload' | 'scanning' | 'done'>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
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
      ])
    ).start();
  }, []);

  // Scan line loop (only active during scanning)
  useEffect(() => {
    if (phase !== 'scanning') return;
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
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  // Pulse for upload button
  useEffect(() => {
    if (phase !== 'upload') return;
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
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  const lineTranslateY = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const picked = result.assets[0];
        setFileName(picked.name ?? 'document');
        // Transition to scanning phase
        setPhase('scanning');
        // After 2.5s of scanning animation, proceed
        setTimeout(() => {
          setPhase('done');
          onScanComplete();
          onNavigate('Form');
        }, 2500);
      }
    } catch (_err) {
      // User cancelled or error — stay on upload
    }
  };

  const isScanning = phase === 'scanning';

  return (
    <SafeAreaView style={s.scanContainer}>
      <Animated.View style={[{ flex: 1 }, anim]}>
        <ScreenHeader title="Upload Document" onBack={() => onNavigate('Home')} />

        <View style={s.scanBody}>
          {phase === 'upload' ? (
            /* ── Upload State ── */
            <View style={s.uploadArea}>
              <TouchableOpacity
                style={s.uploadDropzone}
                onPress={handlePickFile}
                activeOpacity={0.8}
              >
                <Animated.View style={{ transform: [{ translateY: uploadIconBounce }] }}>
                  <View style={s.uploadIconCircle}>
                    <Ionicons name="cloud-upload-outline" size={40} color={C.primary} />
                  </View>
                </Animated.View>
                <Text style={s.uploadTitle}>Upload your document</Text>
                <Text style={s.uploadSubtitle}>
                  PDF, JPG, or PNG — tap to browse files
                </Text>
                <View style={s.uploadFormats}>
                  <View style={s.uploadFormatTag}>
                    <Text style={s.uploadFormatText}>PDF</Text>
                  </View>
                  <View style={s.uploadFormatTag}>
                    <Text style={s.uploadFormatText}>JPG</Text>
                  </View>
                  <View style={s.uploadFormatTag}>
                    <Text style={s.uploadFormatText}>PNG</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Scanning State ── */
            <View style={{ alignItems: 'center' }}>
              <View style={s.viewfinder}>
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

                {/* Center file icon */}
                <View style={s.scanCenterIcon}>
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={48}
                    color="rgba(248,175,60,0.4)"
                  />
                </View>

                {/* Overlay with spinner */}
                <View style={s.scanOverlay}>
                  <ActivityIndicator size="large" color={C.primary} />
                  <Text style={s.scanOverlayText}>
                    AI analyzing document...
                  </Text>
                </View>
              </View>

              {/* Show selected file name */}
              {fileName && (
                <View style={s.fileNamePill}>
                  <Ionicons name="document-text-outline" size={16} color={C.primary} />
                  <Text style={s.fileNameText} numberOfLines={1}>{fileName}</Text>
                </View>
              )}
            </View>
          )}

          <Text style={s.scanHint}>
            {phase === 'upload'
              ? 'Select your insurance document to get started'
              : 'Extracting data from your document…'}
          </Text>
        </View>

        {/* Footer Button */}
        <View style={s.scanFooter}>
          {phase === 'upload' ? (
            <>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={s.shutterBtn}
                  onPress={handlePickFile}
                  activeOpacity={0.8}
                >
                  <View style={s.shutterInner}>
                    <Ionicons name="folder-open-outline" size={28} color={C.white} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
              <Text style={s.shutterLabel}>Browse Files</Text>
            </>
          ) : (
            <>
              <View style={[s.shutterBtn, { opacity: 0.5, borderColor: C.textPrimary }]}>
                <View style={[s.shutterInner, { backgroundColor: C.textPrimary }]}>
                  <ActivityIndicator size="small" color={C.white} />
                </View>
              </View>
              <Text style={s.shutterLabel}>Processing…</Text>
            </>
          )}
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
  onNavigate,
}: {
  isAutoFilled: boolean;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onNavigate: (s: Screen) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const badgeAnim = useFadeIn(500, 0);

  const update = useCallback(
    <K extends keyof FormData>(key: K, val: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: val }));
    },
    [setFormData]
  );

  const isAF = (key: keyof FormData) =>
    isAutoFilled && AUTOFILL_KEYS.includes(key as any);

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onNavigate('Result');
    }, 1800);
  };

  return (
    <SafeAreaView style={s.formContainer}>
      <ScreenHeader
        title="Verify your data"
        onBack={() => onNavigate('Home')}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={s.formScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Auto-fill badge */}
          {isAutoFilled && (
            <Animated.View style={[s.autoFillNotice, badgeAnim]}>
              <Text style={s.autoFillNoticeIcon}>✨</Text>
              <Text style={s.autoFillNoticeText}>
                AI successfully extracted partial data. Please complete the
                rest.
              </Text>
            </Animated.View>
          )}

          {/* ─── Card 1: Demographics & Financials ─── */}
          <FormCard
            title="Demographics & Financials"
            icon={
              <Ionicons name="people-circle-outline" size={20} color={C.accent} />
            }
          >
            <LabeledInput
              label="Estimated Annual Income"
              value={formData.estimatedAnnualIncome}
              onChangeText={(t) => update('estimatedAnnualIncome', t)}
              placeholder="e.g. 72000"
              keyboardType="numeric"
              isAutoFilled={isAF('estimatedAnnualIncome')}
            />
            <Dropdown
              label="Employment Status"
              value={formData.employmentStatus}
              options={['Employed', 'Self-Employed', 'Unemployed']}
              onSelect={(v) => update('employmentStatus', v)}
              isAutoFilled={isAF('employmentStatus')}
            />
            <Stepper
              label="Adult Dependents"
              value={formData.adultDependents}
              onChange={(n) => update('adultDependents', n)}
              isAutoFilled={isAF('adultDependents')}
            />
            <Stepper
              label="Child Dependents"
              value={formData.childDependents}
              onChange={(n) => update('childDependents', n)}
              isAutoFilled={isAF('childDependents')}
            />
            <Stepper
              label="Infant Dependents"
              value={formData.infantDependents}
              onChange={(n) => update('infantDependents', n)}
              isAutoFilled={isAF('infantDependents')}
            />
            <LabeledInput
              label="Region Code"
              value={formData.regionCode}
              onChangeText={(t) => update('regionCode', t)}
              placeholder="e.g. CA-90210"
              isAutoFilled={isAF('regionCode')}
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
              value={formData.existingPolicyholder}
              onToggle={(v) => update('existingPolicyholder', v)}
            />
            <LabeledInput
              label="Previous Claims Filed"
              value={formData.previousClaimsFiled}
              onChangeText={(t) => update('previousClaimsFiled', t)}
              placeholder="0"
              keyboardType="numeric"
            />
            <LabeledInput
              label="Years Without Claims"
              value={formData.yearsWithoutClaims}
              onChangeText={(t) => update('yearsWithoutClaims', t)}
              placeholder="0"
              keyboardType="numeric"
            />
            <LabeledInput
              label="Previous Policy Duration (Months)"
              value={formData.previousPolicyDuration}
              onChangeText={(t) => update('previousPolicyDuration', t)}
              placeholder="0"
              keyboardType="numeric"
            />
            <ToggleField
              label="Policy Cancelled Post-Purchase?"
              value={formData.policyCancelledPostPurchase}
              onToggle={(v) => update('policyCancelledPostPurchase', v)}
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
              value={formData.deductibleTier}
              options={['Low', 'Medium', 'High']}
              onSelect={(v) => update('deductibleTier', v)}
            />
            <Dropdown
              label="Payment Schedule"
              value={formData.paymentSchedule}
              options={['Monthly', 'Annual']}
              onSelect={(v) => update('paymentSchedule', v)}
            />
            <Stepper
              label="Vehicles on Policy"
              value={formData.vehiclesOnPolicy}
              onChange={(n) => update('vehiclesOnPolicy', n)}
              min={0}
            />
            <LabeledInput
              label="Custom Riders Requested"
              value={formData.customRidersRequested}
              onChangeText={(t) => update('customRidersRequested', t)}
              placeholder="0"
              keyboardType="numeric"
            />
            <LabeledInput
              label="Grace Period Extensions"
              value={formData.gracePeriodExtensions}
              onChangeText={(t) => update('gracePeriodExtensions', t)}
              placeholder="0"
              keyboardType="numeric"
            />
          </FormCard>

          {/* ─── Collapsible: System Data ─── */}
          <CollapsibleSection title="System Data (Internal)">
            <LabeledInput
              label="Broker ID"
              value={formData.brokerId}
              onChangeText={() => {}}
              editable={false}
            />
            <LabeledInput
              label="Policy Start Date"
              value={formData.policyStartDate}
              onChangeText={() => {}}
              editable={false}
            />
            <LabeledInput
              label="Underwriting Processing Days"
              value={formData.underwritingProcessingDays}
              onChangeText={() => {}}
              editable={false}
            />
          </CollapsibleSection>

          {/* Submit */}
          <TouchableOpacity
            style={s.submitBtn}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <>
                <Text style={s.submitBtnText}>Generate my custom offer</Text>
                <Ionicons name="arrow-forward-circle" size={22} color={C.white} />
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

function ResultView({ onNavigate }: { onNavigate: (s: Screen) => void }) {
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

  return (
    <SafeAreaView style={s.resultContainer}>
      <ScreenHeader title="Your Offer" onBack={() => onNavigate('Form')} />
      <ScrollView
        contentContainerStyle={s.resultScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Success badge */}
        <Animated.View
          style={[
            s.resultBadge,
            { transform: [{ scale: badgeScale }] },
          ]}
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
              <Text style={s.resultTierNumber}>7</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.resultTierName}>
                Purchased_Coverage_Bundle
              </Text>
              <Text style={s.resultTierDesc}>
                Tier 7 — Premium Auto & Life
              </Text>
            </View>
          </View>

          <View style={s.resultStatsRow}>
            <View style={s.resultStat}>
              <Text style={s.resultStatValue}>$214</Text>
              <Text style={s.resultStatLabel}>Monthly</Text>
            </View>
            <View style={[s.resultStat, s.resultStatMid]}>
              <Text style={s.resultStatValue}>92%</Text>
              <Text style={s.resultStatLabel}>Confidence</Text>
            </View>
            <View style={s.resultStat}>
              <Text style={s.resultStatValue}>A+</Text>
              <Text style={s.resultStatLabel}>Risk Grade</Text>
            </View>
          </View>
        </Animated.View>

        {/* ─── SHAP / AI Insights ─── */}
        <Animated.View style={[s.shapBox, a3]}>
          <View style={s.shapHeader}>
            <MaterialCommunityIcons
              name="brain"
              size={20}
              color={C.accent}
            />
            <Text style={s.shapTitle}>SHAP / AI Insights</Text>
          </View>
          <Text style={s.shapText}>
            Based on your dataset profile, your high{' '}
            <Text style={s.shapHighlight}>Estimated_Annual_Income</Text> and
            having{' '}
            <Text style={s.shapHighlight}>Infant_Dependents</Text>{' '}
            strongly pushed the model toward Bundle 7. Your{' '}
            <Text style={s.shapHighlight}>Years_Without_Claims</Text> feature
            maximized your discounts on this specific tier.
          </Text>

          <View style={s.shapBars}>
            <View style={s.shapBarRow}>
              <Text style={s.shapBarLabel}>Annual Income</Text>
              <View style={s.shapBarTrack}>
                <View style={[s.shapBarFill, { width: '85%', backgroundColor: C.primary }]} />
              </View>
              <Text style={s.shapBarVal}>+0.42</Text>
            </View>
            <View style={s.shapBarRow}>
              <Text style={s.shapBarLabel}>Infant Deps</Text>
              <View style={s.shapBarTrack}>
                <View style={[s.shapBarFill, { width: '65%', backgroundColor: C.accent }]} />
              </View>
              <Text style={s.shapBarVal}>+0.31</Text>
            </View>
            <View style={s.shapBarRow}>
              <Text style={s.shapBarLabel}>No Claims Yrs</Text>
              <View style={s.shapBarTrack}>
                <View style={[s.shapBarFill, { width: '50%', backgroundColor: C.success }]} />
              </View>
              <Text style={s.shapBarVal}>+0.22</Text>
            </View>
          </View>
        </Animated.View>

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
            onPress={() => onNavigate('Home')}
          >
            <Text style={s.resultSecondaryBtnText}>
              Start a new simulation
            </Text>
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
  const [currentScreen, setCurrentScreen] = useState<Screen>('Home');
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });

  const navigate = useCallback(
    (screen: Screen) => {
      if (screen === 'Home') {
        // Reset everything
        setIsAutoFilled(false);
        setFormData({ ...EMPTY_FORM });
      }
      if (screen === 'Form' && !isAutoFilled) {
        // Manual entry — keep empty form
        setFormData({ ...EMPTY_FORM });
      }
      setCurrentScreen(screen);
    },
    [isAutoFilled]
  );

  const handleScanComplete = useCallback(() => {
    setIsAutoFilled(true);
    setFormData((prev) => ({
      ...prev,
      ...AUTOFILL_FORM,
    }));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.appBg }}>
      {currentScreen === 'Home' && <HomeView onNavigate={navigate} />}
      {currentScreen === 'Scanner' && (
        <ScannerView onNavigate={navigate} onScanComplete={handleScanComplete} />
      )}
      {currentScreen === 'Form' && (
        <FormView
          isAutoFilled={isAutoFilled}
          formData={formData}
          setFormData={setFormData}
          onNavigate={navigate}
        />
      )}
      {currentScreen === 'Result' && <ResultView onNavigate={navigate} />}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  /* ─── Common ─── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW_CARD,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
    fontWeight: '600',
    color: C.textPrimary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    backgroundColor: C.inputBg,
    position: 'relative',
  },
  input: {
    fontSize: 16,
    color: C.textHeading,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontWeight: '500',
  },
  autoFillBg: {
    backgroundColor: C.primaryLight,
    borderColor: C.autoFillBorder,
  },
  autoFillBadge: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ─── Stepper ─── */
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 6,
    paddingVertical: 6,
    position: 'relative',
  },
  stepperBtn: {
    width: 42,
    height: 42,
    borderRadius: R.sm,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW_CARD,
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: C.textHeading,
  },

  /* ─── Toggle ─── */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9E3',
  },

  /* ─── Collapsible ─── */
  collapsible: {
    backgroundColor: C.white,
    borderRadius: R.lg,
    marginBottom: 20,
    ...SHADOW_CARD,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  collapsibleTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
    letterSpacing: 0.2,
  },
  collapsibleBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#EDE9E3',
  },

  /* ─── Modal ─── */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: C.overlay,
  },
  modalSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D9D3CB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textHeading,
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: R.md,
    marginBottom: 4,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: C.textHeading,
  },

  /* ═══ HOME ═══ */
  homeContainer: {
    flex: 1,
    backgroundColor: C.appBg,
  },
  homeScroll: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 16 : 40,
    paddingBottom: 40,
  },
  homeBlobA: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(248,175,60,0.08)',
    top: -60,
    right: -80,
  },
  homeBlobB: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(183,72,43,0.06)',
    top: 300,
    left: -70,
  },
  homeBlobC: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(203,187,160,0.12)',
    bottom: 100,
    right: -30,
  },
  homeBrand: {
    marginBottom: 32,
  },
  homeBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  homeLogoCircle: {
    width: 48,
    height: 48,
    borderRadius: R.md,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBrandOlea: {
    fontSize: 26,
    fontWeight: '900',
    color: C.accent,
    letterSpacing: 3,
  },
  homeBrandSub: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textPrimary,
    letterSpacing: 4,
    marginTop: -2,
  },
  homeHero: {
    alignItems: 'center',
    marginBottom: 36,
  },
  homeShieldOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeShieldInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW_CARD,
  },
  homeTagline: {
    fontSize: 28,
    fontWeight: '800',
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
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homePrimaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
  },
  homePrimaryBtnHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  homeSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeSecondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textHeading,
  },
  homeSecondaryBtnHint: {
    fontSize: 12,
    color: C.textPrimary,
    marginTop: 2,
  },
  homeFooter: {
    textAlign: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  viewfinder: {
    width: SCREEN_W - 80,
    height: 280,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
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
    position: 'absolute',
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
    backgroundColor: 'rgba(13,13,26,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  scanOverlayText: {
    color: C.white,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
    letterSpacing: 0.3,
  },
  scanHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
  scanFooter: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 20,
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: C.primary,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterLabel: {
    color: C.white,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    letterSpacing: 0.5,
  },

  /* ─── Upload State ─── */
  uploadArea: {
    width: '100%',
    paddingHorizontal: 16,
  },
  uploadDropzone: {
    borderWidth: 2,
    borderColor: 'rgba(248,175,60,0.35)',
    borderStyle: 'dashed',
    borderRadius: R.xl,
    backgroundColor: 'rgba(248,175,60,0.06)',
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  uploadIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(248,175,60,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.white,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  uploadFormats: {
    flexDirection: 'row',
    gap: 8,
  },
  uploadFormatTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: R.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  uploadFormatText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1,
  },
  fileNamePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248,175,60,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: R.full,
    marginTop: 18,
    maxWidth: SCREEN_W - 100,
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.primary,
    flexShrink: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '500',
    lineHeight: 18,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '700',
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
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: {
    backgroundColor: C.white,
    borderRadius: R.xl,
    padding: 24,
    width: '100%',
    marginBottom: 20,
    ...SHADOW_CARD,
  },
  resultCardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.textHeading,
    textAlign: 'center',
    marginBottom: 4,
  },
  resultDivider: {
    height: 1,
    backgroundColor: '#EDE9E3',
    marginVertical: 18,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  resultTierBox: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTierNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: C.white,
  },
  resultTierName: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textPrimary,
    letterSpacing: 0.3,
  },
  resultTierDesc: {
    fontSize: 15,
    fontWeight: '700',
    color: C.accent,
    marginTop: 2,
  },
  resultStatsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#EDE9E3',
    paddingTop: 16,
  },
  resultStat: {
    flex: 1,
    alignItems: 'center',
  },
  resultStatMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#EDE9E3',
  },
  resultStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: C.textHeading,
  },
  resultStatLabel: {
    fontSize: 11,
    color: C.textPrimary,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },

  /* ─── SHAP Box ─── */
  shapBox: {
    backgroundColor: '#FAF8F5',
    borderRadius: R.lg,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: C.accent,
  },
  shapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  shapTitle: {
    fontSize: 15,
    fontWeight: '700',
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
    fontWeight: '700',
    color: C.textHeading,
    backgroundColor: 'rgba(248,175,60,0.15)',
    paddingHorizontal: 2,
  },
  shapBars: {
    gap: 10,
  },
  shapBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shapBarLabel: {
    width: 90,
    fontSize: 11,
    fontWeight: '600',
    color: C.textPrimary,
  },
  shapBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EDE9E3',
    overflow: 'hidden',
  },
  shapBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  shapBarVal: {
    width: 40,
    fontSize: 12,
    fontWeight: '700',
    color: C.textHeading,
    textAlign: 'right',
  },

  /* ─── Result Buttons ─── */
  resultPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    borderRadius: R.lg,
    paddingVertical: 18,
    width: '100%',
    marginBottom: 14,
    ...SHADOW_BUTTON,
  },
  resultPrimaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
  },
  resultSecondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resultSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.accent,
    textDecorationLine: 'underline',
  },
});
