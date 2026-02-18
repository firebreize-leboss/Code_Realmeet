// components/IconSymbol.tsx
// This file is a fallback for using MaterialIcons on Android and web.

import React from "react";
import { SymbolWeight } from "expo-symbols";
import {
  OpaqueColorValue,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

// Add your SFSymbol to MaterialIcons mappings here.
const MAPPING = {
  // See MaterialIcons here: https://icons.expo.fyi
  // See SF Symbols in the SF Symbols app on Mac.

  // Navigation & Home
  "house.fill": "home",
  "house": "home",
  "arrow.left": "arrow-back",
  "arrow.right": "arrow-forward",
  "arrow.up": "arrow-upward",
  "arrow.down": "arrow-downward",
  "chevron.left": "chevron-left",
  "chevron.right": "chevron-right",
  "chevron.up": "keyboard-arrow-up",
  "chevron.down": "keyboard-arrow-down",
  "arrow.clockwise": "refresh",
  "arrow.counterclockwise": "refresh",
  "arrow.up.circle.fill": "arrow-circle-up",

  // Communication & Social
  "paperplane.fill": "send",
  "paperplane": "send",
  "envelope.fill": "mail",
  "envelope": "mail-outline",
  "phone.fill": "phone",
  "phone": "phone",
  "message.fill": "chat",
  "message": "chat-bubble-outline",
  "bell.fill": "notifications",
  "bell": "notifications-none",
  "bell.slash.fill": "notifications-off",
  "bell.slash": "notifications-off",
  "heart.fill": "favorite",
  "heart": "favorite-border",
  "person.badge.plus": "person-add",
  "person.2.slash": "person-off",
  "eye.slash": "visibility-off",
  "clock": "schedule",
  "figure.run": "directions-run",

  // Actions & Controls
  "plus": "add",
  "plus.circle.fill": "add-circle",
  "minus": "remove",
  "xmark": "close",
  "checkmark": "check",
  "checkmark.circle.fill": "check-circle",
  "checkmark.circle": "check-circle-outline",
  "checkmark.square.fill": "check-box",
  "checkmark.square": "check-box-outline-blank",
  "multiply": "clear",
  "trash.fill": "delete",
  "trash": "delete-outline",

  // Editing & Creation
  "pencil": "edit",
  "pencil.and.list.clipboard": "edit-note",
  "square.and.pencil": "edit",
  "doc.text.fill": "description",
  "doc.text": "description",
  "folder.fill": "folder",
  "folder": "folder-open",
  "doc.fill": "insert-drive-file",
  "doc": "insert-drive-file",

  // Media & Content
  "photo.fill": "image",
  "photo": "image",
  "camera.fill": "camera-alt",
  "camera": "camera-alt",
  "video.fill": "videocam",
  "video": "videocam",
  "music.note": "music-note",
  "speaker.wave.2.fill": "volume-up",
  "speaker.slash.fill": "volume-off",
  "play.fill": "play-arrow",
  "pause.fill": "pause",
  "stop.fill": "stop",

  // 🎤 Audio & Voice
  "mic.fill": "mic",
  "mic": "mic-none",
  "mic.slash.fill": "mic-off",
  "mic.slash": "mic-off",

  // System & Settings
  "gear": "settings",
  "gearshape.fill": "settings",
  "slider.horizontal.3": "tune",
  "info.circle.fill": "info",
  "info.circle": "info",
  "exclamationmark.triangle.fill": "warning",
  "exclamationmark.triangle": "warning",
  "exclamationmark.circle.fill": "error",
  "exclamationmark.circle": "error-outline",
  "questionmark.circle.fill": "help",
  "questionmark.circle": "help-outline",
  "shield.fill": "shield",

  // Lists
  "list.bullet.rectangle.fill": "list",
  "list.bullet.rectangle": "list",

  // Shapes & Symbols
  "square": "crop-square",
  "square.grid.2x2.fill": "grid-view",
  "square.grid.3x3": "apps",
  "square.stack.3d.up.fill": "layers",
  "circle": "circle",
  "triangle.fill": "change-history",
  "star.fill": "star",
  "star": "star-border",
  "bookmark.fill": "bookmark",
  "bookmark": "bookmark-border",

  // ⋯ More options
  "ellipsis": "more-horiz",
  "ellipsis.circle": "more-horiz",
  "ellipsis.circle.fill": "more-horiz",

  // Technology & Code
  "chevron.left.forwardslash.chevron.right": "code",
  "qrcode.viewfinder": "qr-code",
  "wifi": "wifi",
  "antenna.radiowaves.left.and.right": "signal-cellular-alt",
  "battery.100": "battery-full",
  "battery.25": "battery-2-bar",
  "lock.fill": "lock",
  "lock.open.fill": "lock-open",

  // Shopping & Commerce
  "cart.fill": "shopping-cart",
  "cart": "shopping-cart",
  "creditcard.fill": "credit-card",
  "creditcard": "credit-card",
  "dollarsign.circle.fill": "monetization-on",
  "bag.fill": "shopping-bag",
  "bag": "shopping-bag",

  // Location & Maps
  "location.fill": "location-on",
  "location": "location-on",
  "map.fill": "map",
  "map": "map",
  "compass.drawing": "explore",

  // Time & Calendar
  "clock.fill": "access-time",
  "clock": "access-time",
  "calendar": "event",
  "calendar.badge.plus": "event",
  "timer": "timer",

  // User & Profile
  "person": "person",
  "person.fill": "person",
  "person.2.fill": "group",
  "person.2": "group",
  "person.3.fill": "groups",
  "person.3": "groups",
  "person.circle.fill": "account-circle",
  "person.circle": "account-circle",
  "person.crop.circle.fill": "account-circle",
  "person.crop.circle": "account-circle",
  "person.badge.plus.fill": "person-add",
  "person.badge.plus": "person-add",
  "person.badge.minus.fill": "person-remove",
  "person.badge.minus": "person-remove",

  // ✋ Blocking & Safety
  "hand.raised.fill": "block",
  "hand.raised": "block",
  "hand.raised.slash.fill": "do-not-disturb-off",
  "hand.raised.slash": "do-not-disturb-off",

  // Sharing & Export
  "square.and.arrow.up": "share",
  "square.and.arrow.down": "download",
  "arrow.up.doc.fill": "upload-file",
  "link": "link",

  // Search & Discovery
  "magnifyingglass": "search",
  "line.3.horizontal.decrease": "filter-list",
  "arrow.up.arrow.down": "sort",

  // Visibility & Display
  "eye.fill": "visibility",
  "eye.slash.fill": "visibility-off",
  "lightbulb.fill": "lightbulb",
  "moon.fill": "dark-mode",
  "sun.max.fill": "light-mode",

  // Business & Buildings
  "building.2.fill": "business",
  "building.2": "business",

  // Charts & Analytics
  "chart.bar.fill": "bar-chart",

  // Support
  "headphones": "headset",

  // Logos (Social)
  "logo.apple": "apple",
  "logo.google": "g-mobiledata",

  // ⭐ CATÉGORIES
  "figure.hiking": "hiking",
  "cup.and.saucer.fill": "local-cafe",
  "film.fill": "movie",
  "gamecontroller.fill": "sports-esports",
  "figure.run": "directions-run",
  "fork.knife": "restaurant",
  "paintpalette.fill": "palette",

  // ✨ Effects & Misc
  "sparkles": "auto-awesome",
  "figure.play": "sports",
  "figure.walk": "directions-walk",

  // 📥 Storage & Inbox
  "tray": "inbox",
  "tray.fill": "inbox",

  // 📋 Clipboard
  "doc.on.clipboard": "content-paste",
  "doc.on.clipboard.fill": "content-paste",

  "person.2.wave.2": "people",
  
  // Success
  "checkmark.seal.fill": "verified",
  "checkmark.seal": "verified",
} as Partial<
  Record<
    import("expo-symbols").SymbolViewProps["name"],
    React.ComponentProps<typeof MaterialIcons>["name"]
  >
>;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name];
  
  // Fallback si l'icône n'est pas mappée
  if (!iconName) {
    console.warn(`IconSymbol: No mapping found for "${name}", using fallback`);
    return (
      <MaterialIcons
        color={color}
        size={size}
        name="help-outline"
        style={style as StyleProp<TextStyle>}
      />
    );
  }

  return (
    <MaterialIcons
      color={color}
      size={size}
      name={iconName}
      style={style as StyleProp<TextStyle>}
    />
  );
}