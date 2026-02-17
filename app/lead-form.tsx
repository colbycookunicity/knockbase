import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useLeads } from "@/lib/leads-context";
import { useTheme } from "@/lib/useTheme";
import { LeadStatus, LEAD_STATUS_CONFIG } from "@/lib/types";

const COMMON_TAGS = ["HOA", "Renter", "Owner", "Gated", "Dog", "Spanish", "Senior", "New Build"];

export default function LeadFormScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    latitude?: string;
    longitude?: string;
    pickedAddress?: string;
  }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { leads, addLead, updateLead } = useLeads();

  const existingLead = useMemo(
    () => (params.id ? leads.find((l) => l.id === params.id) : null),
    [params.id, leads]
  );

  const isEditing = !!existingLead;

  const [firstName, setFirstName] = useState(existingLead?.firstName || "");
  const [lastName, setLastName] = useState(existingLead?.lastName || "");
  const [phone, setPhone] = useState(existingLead?.phone || "");
  const [email, setEmail] = useState(existingLead?.email || "");
  const [address, setAddress] = useState(existingLead?.address || params.pickedAddress || "");
  const [notes, setNotes] = useState(existingLead?.notes || "");
  const [tags, setTags] = useState<string[]>(existingLead?.tags || []);
  const [status, setStatus] = useState<LeadStatus>(existingLead?.status || "untouched");
  const [appointmentDate, setAppointmentDate] = useState<Date | null>(
    existingLead?.appointmentDate ? new Date(existingLead.appointmentDate) : null
  );
  const [followUpDate, setFollowUpDate] = useState<Date | null>(
    existingLead?.followUpDate ? new Date(existingLead.followUpDate) : null
  );
  const [showAppointmentPicker, setShowAppointmentPicker] = useState(false);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [customTag, setCustomTag] = useState("");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [pickedLat, setPickedLat] = useState(existingLead?.latitude || parseFloat(params.latitude || "0"));
  const [pickedLng, setPickedLng] = useState(existingLead?.longitude || parseFloat(params.longitude || "0"));
  const [locating, setLocating] = useState(false);

  const latitude = pickedLat;
  const longitude = pickedLng;

  const handleUseMyLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location access is required to use this feature.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng } = loc.coords;
      setPickedLat(lat);
      setPickedLng(lng);
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.streetNumber, r.street, r.city, r.region, r.postalCode].filter(Boolean);
        setAddress(parts.join(", "));
      }
    } catch {
      Alert.alert("Error", "Could not fetch your location. Please try again.");
    } finally {
      setLocating(false);
    }
  };

  const toggleTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      setCustomTag("");
    }
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isEditing && existingLead) {
      await updateLead(existingLead.id, {
        firstName,
        lastName,
        phone,
        email,
        address,
        notes,
        tags,
        status,
        appointmentDate: appointmentDate?.toISOString() || null,
        followUpDate: followUpDate?.toISOString() || null,
      });
    } else {
      await addLead({
        firstName,
        lastName,
        phone,
        email,
        address,
        latitude,
        longitude,
        status,
        notes,
        tags,
        followUpDate: followUpDate?.toISOString() || null,
        appointmentDate: appointmentDate?.toISOString() || null,
        knockedAt: null,
      });
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {isEditing ? "Edit Lead" : "New Lead"}
        </Text>
        <Pressable onPress={handleSave} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Feather name="check" size={24} color={theme.tint} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Contact</Text>
        <View style={styles.row}>
          <FormInput
            placeholder="First Name"
            value={firstName}
            onChangeText={setFirstName}
            theme={theme}
            icon="user"
            style={{ flex: 1 }}
          />
          <FormInput
            placeholder="Last Name"
            value={lastName}
            onChangeText={setLastName}
            theme={theme}
            style={{ flex: 1 }}
          />
        </View>
        <FormInput
          placeholder="Phone Number"
          value={phone}
          onChangeText={setPhone}
          theme={theme}
          icon="phone"
          keyboardType="phone-pad"
        />
        <FormInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          theme={theme}
          icon="mail"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>Location</Text>
        <FormInput
          placeholder="Address"
          value={address}
          onChangeText={setAddress}
          theme={theme}
          icon="map-pin"
          rightElement={
            <Pressable
              onPress={handleUseMyLocation}
              disabled={locating}
              style={({ pressed }) => [
                styles.myLocationBtn,
                { backgroundColor: theme.tint + "18", opacity: pressed ? 0.7 : 1 },
              ]}
            >
              {locating ? (
                <ActivityIndicator size={14} color={theme.tint} />
              ) : (
                <Feather name="navigation" size={14} color={theme.tint} />
              )}
              <Text style={[styles.myLocationText, { color: theme.tint }]}>
                {locating ? "Locating..." : "Use My Location"}
              </Text>
            </Pressable>
          }
        />
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({
              pathname: "/map-picker",
              params: latitude !== 0 ? { initialLat: latitude.toString(), initialLng: longitude.toString() } : {},
            });
          }}
          style={[styles.pickMapBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Feather name="crosshair" size={16} color={theme.tint} />
          <Text style={[styles.pickMapText, { color: theme.tint }]}>
            {latitude !== 0 ? "Change Pin on Map" : "Pick on Map"}
          </Text>
        </Pressable>
        {latitude !== 0 && (
          <Text style={[styles.coordText, { color: theme.textSecondary }]}>
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </Text>
        )}

        <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>Status</Text>
        <View style={styles.statusGrid}>
          {(Object.keys(LEAD_STATUS_CONFIG) as LeadStatus[]).map((s) => {
            const cfg = LEAD_STATUS_CONFIG[s];
            const isActive = status === s;
            return (
              <Pressable
                key={s}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStatus(s);
                }}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: isActive ? cfg.color + "20" : theme.surface,
                    borderColor: isActive ? cfg.color : theme.border,
                    borderWidth: isActive ? 2 : 1,
                  },
                ]}
              >
                <Feather name={cfg.icon as any} size={14} color={cfg.color} />
                <Text style={[styles.statusChipText, { color: isActive ? cfg.color : theme.textSecondary }]}>
                  {cfg.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>Scheduling</Text>
        <Pressable
          onPress={() => setShowAppointmentPicker(!showAppointmentPicker)}
          style={[styles.dateBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Feather name="calendar" size={16} color={theme.accent} />
          <Text style={[styles.dateBtnText, { color: appointmentDate ? theme.text : theme.textSecondary }]}>
            {appointmentDate
              ? appointmentDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "Set Appointment Date"}
          </Text>
          {appointmentDate && (
            <Pressable
              onPress={() => {
                setAppointmentDate(null);
                setShowAppointmentPicker(false);
              }}
            >
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </Pressable>
        {showAppointmentPicker && (
          <DateTimePicker
            value={appointmentDate || new Date()}
            mode="datetime"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, date) => {
              if (Platform.OS === "android") setShowAppointmentPicker(false);
              if (date) setAppointmentDate(date);
            }}
            minimumDate={new Date()}
          />
        )}

        <Pressable
          onPress={() => setShowFollowUpPicker(!showFollowUpPicker)}
          style={[styles.dateBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Feather name="refresh-cw" size={16} color={theme.info} />
          <Text style={[styles.dateBtnText, { color: followUpDate ? theme.text : theme.textSecondary }]}>
            {followUpDate
              ? followUpDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : "Set Follow-up Date"}
          </Text>
          {followUpDate && (
            <Pressable
              onPress={() => {
                setFollowUpDate(null);
                setShowFollowUpPicker(false);
              }}
            >
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </Pressable>
        {showFollowUpPicker && (
          <DateTimePicker
            value={followUpDate || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, date) => {
              if (Platform.OS === "android") setShowFollowUpPicker(false);
              if (date) setFollowUpDate(date);
            }}
            minimumDate={new Date()}
          />
        )}

        <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>Tags</Text>
        <View style={styles.tagsGrid}>
          {COMMON_TAGS.map((tag) => {
            const isActive = tags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                style={[
                  styles.tagChip,
                  {
                    backgroundColor: isActive ? theme.tint + "20" : theme.surface,
                    borderColor: isActive ? theme.tint : theme.border,
                  },
                ]}
              >
                <Text style={[styles.tagChipText, { color: isActive ? theme.tint : theme.textSecondary }]}>
                  {tag}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.customTagRow}>
          <TextInput
            style={[
              styles.customTagInput,
              { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
            ]}
            value={customTag}
            onChangeText={setCustomTag}
            placeholder="Custom tag..."
            placeholderTextColor={theme.textSecondary}
            onSubmitEditing={addCustomTag}
            returnKeyType="done"
          />
          <Pressable onPress={addCustomTag} style={[styles.addTagBtn, { backgroundColor: theme.tint }]}>
            <Feather name="plus" size={16} color="#FFF" />
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>Notes</Text>
        <TextInput
          style={[
            styles.notesInput,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
          ]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes about this lead..."
          placeholderTextColor={theme.textSecondary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: theme.tint,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Feather name="check" size={18} color="#FFF" />
          <Text style={styles.saveBtnText}>{isEditing ? "Save Changes" : "Create Lead"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormInput({
  placeholder,
  value,
  onChangeText,
  theme,
  icon,
  style,
  rightElement,
  ...props
}: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  theme: any;
  icon?: string;
  style?: any;
  rightElement?: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <View
      style={[
        formStyles.inputContainer,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      {icon && <Feather name={icon as any} size={16} color={theme.textSecondary} />}
      <TextInput
        style={[formStyles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        {...props}
      />
      {rightElement}
    </View>
  );
}

const formStyles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  coordText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: -4,
    marginLeft: 4,
  },
  myLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  myLocationText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  pickMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  pickMapText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  statusChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateBtnText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  tagsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  customTagRow: {
    flexDirection: "row",
    gap: 8,
  },
  customTagInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  addTagBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  notesInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 100,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
