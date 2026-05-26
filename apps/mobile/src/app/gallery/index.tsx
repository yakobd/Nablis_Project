import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, Modal, Dimensions, ActivityIndicator, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db, useAuth } from "@nablis/shared/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const C = {
  navy:   "#1B2E6B",
  yellow: "#F5C518",
  light:  "#EEF1F8",
  grey:   "#9CA3AF",
  dark:   "#374151",
  border: "#E5E7EB",
  white:  "#FFFFFF",
  bg:     "#F9FAFB",
};

const SCREEN_W = Dimensions.get("window").width;
const ITEM_SIZE = (SCREEN_W - 16 * 2 - 8) / 2;

interface GalleryItem {
  id: string;
  title: string;
  imageURL: string;
  category: string;
}

const CATEGORIES = ["All", "Liturgy", "Community", "Youth", "Retreats", "Celebrations"] as const;
type Cat = (typeof CATEGORIES)[number];

export default function GalleryScreen() {
  const { user }  = useAuth();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const [items, setItems]       = useState<GalleryItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeCat, setActiveCat] = useState<Cat>("All");
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);

  useEffect(() => {
    getDocs(query(collection(db, "gallery"), orderBy("createdAt", "desc")))
      .then((snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryItem))))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCat === "All" ? items : items.filter((i) => i.category === activeCat);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gallery</Text>
        <Text style={styles.headerCount}>{filtered.length}</Text>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.catChip, activeCat === c && styles.catChipActive]}
            onPress={() => setActiveCat(c)}
            activeOpacity={0.8}
          >
            <Text style={[styles.catTxt, activeCat === c && styles.catTxtActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Grid */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="images-outline" size={44} color={C.grey} style={{ opacity: 0.3 }} />
          <Text style={styles.emptyTxt}>No photos in this category.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.imageWrap}
              onPress={() => setLightbox(item)}
              activeOpacity={0.9}
            >
              <Image source={{ uri: item.imageURL }} style={styles.image} />
              <View style={styles.imageOverlay}>
                <Text style={styles.imageTitle} numberOfLines={1}>{item.title}</Text>
                <View style={styles.imageCat}>
                  <Text style={styles.imageCatTxt}>{item.category}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Lightbox */}
      <Modal visible={!!lightbox} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.lightboxBg}>
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightbox(null)}>
            <Ionicons name="close" size={24} color={C.white} />
          </TouchableOpacity>
          {lightbox && (
            <>
              <Image
                source={{ uri: lightbox.imageURL }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
              <View style={styles.lightboxInfo}>
                <Text style={styles.lightboxTitle}>{lightbox.title}</Text>
                <View style={styles.lightboxCat}>
                  <Ionicons name="pricetag-outline" size={12} color={C.white} />
                  <Text style={styles.lightboxCatTxt}>{lightbox.category}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: "800", color: C.navy, textAlign: "center" },
  headerCount:  { width: 36, textAlign: "center", fontSize: 13, color: C.grey, fontWeight: "600" },
  catRow:       { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  catChip:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  catChipActive:{ backgroundColor: C.navy, borderColor: C.navy },
  catTxt:       { fontSize: 12, fontWeight: "600", color: C.grey },
  catTxtActive: { color: C.white },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTxt:     { fontSize: 14, color: C.grey },
  grid:         { paddingHorizontal: 16, paddingBottom: 24 },
  row:          { justifyContent: "space-between", marginBottom: 8 },
  imageWrap:    { width: ITEM_SIZE, height: ITEM_SIZE * 1.1, borderRadius: 14, overflow: "hidden", position: "relative" },
  image:        { width: "100%", height: "100%", backgroundColor: C.light },
  imageOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: "rgba(0,0,0,0.4)" },
  imageTitle:   { color: C.white, fontSize: 11, fontWeight: "700", marginBottom: 3 },
  imageCat:     { backgroundColor: "rgba(27,46,107,0.7)", alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  imageCatTxt:  { color: C.white, fontSize: 9, fontWeight: "700" },
  lightboxBg:   { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  lightboxClose:{ position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 },
  lightboxImage:{ width: SCREEN_W, height: SCREEN_W * 1.2, maxHeight: "70%" as any },
  lightboxInfo: { position: "absolute", bottom: 60, left: 20, right: 20 },
  lightboxTitle:{ color: C.white, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  lightboxCat:  { flexDirection: "row", alignItems: "center", gap: 4 },
  lightboxCatTxt:{ color: "rgba(255,255,255,0.7)", fontSize: 12 },
});
