import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { VerticalSidebar } from "./VerticalSidebar";
import { AppIcon } from "./AppIcon";

interface AppTopHeaderProps {
  title?: string;
  showBack?: boolean;
  navigation: any;
}

export const AppTopHeader: React.FC<AppTopHeaderProps> = ({
  title,
  showBack = false,
  navigation,
}) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const role = user?.role || "recorder";

  // Provide safe top spacing on all devices (notches, camera punch holes, status bars)
  const topPadding = Math.max(insets.top, Platform.OS === "android" ? 36 : 24) + 8;

  return (
    <View style={[styles.headerContainer, { paddingTop: topPadding }]}>
      {/* Top Main Navigation Row */}
      <View style={styles.topRow}>
        {/* Left Side: Back Button & Menu Drawer Button */}
        <View style={styles.leftNavGroup}>
          {showBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate("Dashboard");
                }
              }}
            >
              <AppIcon name="back" size={16} color="#0284C7" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}

          {/* Menu Icon: Opens Vertical Left Sidebar Navigation Drawer */}
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => setSidebarVisible(true)}
            accessibilityLabel="Open Vertical Navigation Drawer"
          >
            <AppIcon name="menu" size={16} color="#0284C7" />
            <Text style={styles.homeText}>Menu</Text>
          </TouchableOpacity>
        </View>

        {/* Right Side: Role Badge (Exit button at the top removed per user request) */}
        <View style={styles.rightNavGroup}>
          <View style={styles.userInfoBox}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.full_name?.split(" ")[0] || "User"}
            </Text>
            <Text style={styles.userRoleTag}>
              {role.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Screen Title Banner (if provided) */}
      {title && (
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>{title}</Text>
        </View>
      )}

      {/* Vertical Left Navbar Drawer */}
      <VerticalSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftNavGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
  },
  backText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginLeft: 4,
  },
  homeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  homeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0284C7",
    marginLeft: 6,
  },
  rightNavGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userInfoBox: {
    alignItems: "flex-end",
  },
  userName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  userRoleTag: {
    fontSize: 9,
    fontWeight: "800",
    color: "#0284C7",
    letterSpacing: 0.5,
  },
  titleRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  screenTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
});
