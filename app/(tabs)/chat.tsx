
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { mockChats } from '@/data/mockData';

export default function ChatScreen() {
  const router = useRouter();

  const renderChatItem = (chat: typeof mockChats[0]) => (
    <TouchableOpacity
      key={chat.id}
      style={styles.chatItem}
      onPress={() => router.push(`/chat-detail?id=${chat.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.chatImageContainer}>
        <Image source={{ uri: chat.image }} style={styles.chatImage} />
        {chat.isGroup && (
          <View style={styles.groupBadge}>
            <IconSymbol name="person.2.fill" size={12} color={colors.background} />
          </View>
        )}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName} numberOfLines={1}>
            {chat.name}
          </Text>
          <Text style={styles.chatTime}>{chat.lastMessageTime}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={2}>
          {chat.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity style={styles.newChatButton}>
          <IconSymbol name="square.and.pencil" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {mockChats.length > 0 ? (
          mockChats.map(renderChatItem)
        ) : (
          <View style={styles.emptyState}>
            <IconSymbol name="message.fill" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Join activities to start chatting with other members
            </Text>
          </View>
        )}
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
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  newChatButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chatImageContainer: {
    position: 'relative',
  },
  chatImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
  },
  groupBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  chatTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  lastMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
