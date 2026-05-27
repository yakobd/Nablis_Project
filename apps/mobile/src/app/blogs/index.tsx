import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function BlogsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [blogs,   setBlogs]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const q    = query(collection(db, 'blogPosts'), where('status', '==', 'published'));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setBlogs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Blogs</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1B2E6B" style={{ marginTop: 40 }} />
      ) : blogs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No blog posts yet</Text>
        </View>
      ) : (
        blogs.map(blog => (
          <View key={blog.id} style={styles.card}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{blog.category || 'General'}</Text>
            </View>
            <Text style={styles.cardTitle}>{blog.title}</Text>
            <Text style={styles.cardExcerpt} numberOfLines={3}>{blog.content}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.authorText}>{blog.authorName || 'Nablis'}</Text>
              <Text style={styles.dateText}>
                {blog.createdAt?.toDate?.()?.toLocaleDateString() || ''}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#EEF1F8' },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:       { marginRight: 16 },
  backText:      { color: '#1B2E6B', fontSize: 16 },
  title:         { fontSize: 24, fontWeight: 'bold', color: '#1B2E6B' },
  empty:         { alignItems: 'center', marginTop: 60 },
  emptyText:     { color: '#6B7280', fontSize: 16 },
  card:          { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  categoryBadge: { backgroundColor: '#EEF1F8', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  categoryText:  { fontSize: 11, color: '#1B2E6B', fontWeight: '600' },
  cardTitle:     { fontSize: 18, fontWeight: 'bold', color: '#1B2E6B', marginBottom: 8 },
  cardExcerpt:   { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 12 },
  cardFooter:    { flexDirection: 'row', justifyContent: 'space-between' },
  authorText:    { fontSize: 12, color: '#9CA3AF' },
  dateText:      { fontSize: 12, color: '#9CA3AF' },
});
