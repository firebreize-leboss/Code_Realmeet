
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';

export default function CreateActivityScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [capacity, setCapacity] = useState('');
  const [category, setCategory] = useState('');

  const handleCreate = () => {
    if (!title || !description || !location || !date || !time || !capacity || !category) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    Alert.alert('Success', 'Activity created successfully!', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="xmark" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Activity</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageUpload}>
          <IconSymbol name="photo.fill" size={48} color={colors.textSecondary} />
          <Text style={styles.imageUploadText}>Add Cover Image</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Activity title"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your activity"
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Hiking, Brunch, Music"
              placeholderTextColor={colors.textSecondary}
              value={category}
              onChangeText={setCategory}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                value={date}
                onChangeText={setDate}
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Time</Text>
              <TextInput
                style={styles.input}
                placeholder="HH:MM AM/PM"
                placeholderTextColor={colors.textSecondary}
                value={time}
                onChangeText={setTime}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="Where will this take place?"
              placeholderTextColor={colors.textSecondary}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Capacity</Text>
            <TextInput
              style={styles.input}
              placeholder="Maximum number of participants"
              placeholderTextColor={colors.textSecondary}
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreate}
        >
          <Text style={styles.createButtonText}>Create Activity</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  imageUpload: {
    backgroundColor: colors.card,
    borderRadius: 12,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  imageUploadText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
