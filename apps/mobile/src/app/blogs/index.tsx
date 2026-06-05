import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../lib/firebase';
import {
  collection, query, where, getDocs, addDoc, doc, serverTimestamp,
} from 'firebase/firestore';

const C = {
  navy: '#1B2E6B', yellow: '#F5C518', light: '#EEF1F8',
  grey: '#9CA3AF', dark: '#374151', border: '#E5E7EB',
  white: '#FFFFFF', bg: '#F9FAFB',
};

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt?: { seconds?: number };
}

function fmtAgo(ts?: { seconds?: number } | null) {
  if (!ts?.seconds) return '';
  const d = Date.now() - ts.seconds * 1000;
  const days = Math.floor(d / 86400000);
  if (days > 0) return `${days}d ago`;
  const hrs = Math.floor(d / 3600000);
  return hrs > 0 ? `${hrs}h ago` : 'Just now';
}

export default function BlogsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const currentUser = auth.currentUser;

  const [blogs,   setBlogs]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail modal state
  const [selectedBlog, setSelectedBlog]       = useState<any | null>(null);
  const [comments,     setComments]           = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment,   setNewComment]         = useState('');
  const [posting,      setPosting]            = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const q    = query(collection(db, 'blogPosts'), where('status', '==', 'published'));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setBlogs(data);
      } catch (e) {
        console.error('[Blogs] fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openBlog(blog: any) {
    setSelectedBlog(blog);
    setComments([]);
    setNewComment('');
    setLoadingComments(true);
    try {
      const snap = await getDocs(collection(db, 'blogPosts', blog.id, 'comments'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
      data.sort((a, b) => ((b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
      // Merge with inline comments array (legacy)
      const inlineComments: Comment[] = (blog.comments ?? []).filter(
        (c: Comment) => !data.some(d => d.id === c.id)
      );
      setComments([...data, ...inlineComments]);
    } catch (e) {
      console.error('[Blogs] load comments error:', e);
    } finally {
      setLoadingComments(false);
    }
  }

  async function postComment() {
    if (!newComment.trim() || !currentUser || !selectedBlog) return;
    setPosting(true);
    try {
      const commentData: Comment = {
        id:         Date.now().toString(),
        authorId:   currentUser.uid,
        authorName: currentUser.displayName || currentUser.email || 'Member',
        content:    newComment.trim(),
        createdAt:  { seconds: Math.floor(Date.now() / 1000) },
      };
      await addDoc(collection(db, 'blogPosts', selectedBlog.id, 'comments'), {
        authorId:   currentUser.uid,
        authorName: currentUser.displayName || currentUser.email || 'Member',
        content:    newComment.trim(),
        createdAt:  serverTimestamp(),
      });
      setComments(prev => [commentData, ...prev]);
      setNewComment('');
    } catch (e) {
      console.error('[Blogs] post comment error:', e);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.light }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Blogs</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.navy} style={{ marginTop: 40 }} />
        ) : blogs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No blog posts yet</Text>
          </View>
        ) : (
          blogs.map(blog => (
            <TouchableOpacity
              key={blog.id}
              style={styles.card}
              onPress={() => openBlog(blog)}
              activeOpacity={0.85}
            >
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
              <Text style={styles.readMore}>Read more →</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Blog Detail Modal */}
      <Modal
        visible={!!selectedBlog}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedBlog(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: C.bg }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Modal header */}
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => setSelectedBlog(null)} style={styles.modalBack}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{selectedBlog?.category || 'General'}</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.detailScroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Article content */}
            <Text style={styles.detailTitle}>{selectedBlog?.title}</Text>
            <View style={styles.detailMeta}>
              <Text style={styles.authorText}>{selectedBlog?.authorName || 'Nablis'}</Text>
              <Text style={styles.dateText}>
                {selectedBlog?.createdAt?.toDate?.()?.toLocaleDateString() || ''}
              </Text>
            </View>
            <Text style={styles.detailContent}>{selectedBlog?.content}</Text>

            {/* Comments section */}
            <View style={styles.commentSection}>
              <Text style={styles.commentSectionTitle}>
                Comments {comments.length > 0 ? `(${comments.length})` : ''}
              </Text>

              {/* Post comment input */}
              <View style={styles.commentInput}>
                <TextInput
                  style={styles.commentTextInput}
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder="Write a comment…"
                  placeholderTextColor={C.grey}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.commentPostBtn, (!newComment.trim() || posting) && { opacity: 0.5 }]}
                  onPress={postComment}
                  disabled={!newComment.trim() || posting}
                >
                  {posting
                    ? <ActivityIndicator size="small" color={C.navy} />
                    : <Text style={styles.commentPostTxt}>Post</Text>}
                </TouchableOpacity>
              </View>

              {/* Comments list */}
              {loadingComments ? (
                <ActivityIndicator color={C.navy} style={{ marginTop: 16 }} />
              ) : comments.length === 0 ? (
                <Text style={styles.noComments}>Be the first to comment!</Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentCard}>
                    <View style={styles.commentHeader}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarTxt}>
                          {(c.authorName || 'M')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.commentAuthor}>{c.authorName}</Text>
                        <Text style={styles.commentTime}>{fmtAgo(c.createdAt)}</Text>
                      </View>
                    </View>
                    <Text style={styles.commentContent}>{c.content}</Text>
                  </View>
                ))
              )}

              <View style={{ height: 32 }} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:           { marginRight: 16 },
  backText:          { color: C.navy, fontSize: 16 },
  title:             { fontSize: 24, fontWeight: 'bold', color: C.navy },
  empty:             { alignItems: 'center', marginTop: 60 },
  emptyText:         { color: C.grey, fontSize: 16 },
  card:              { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.white, borderRadius: 12, padding: 16 },
  categoryBadge:     { backgroundColor: C.light, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  categoryText:      { fontSize: 11, color: C.navy, fontWeight: '600' },
  cardTitle:         { fontSize: 18, fontWeight: 'bold', color: C.navy, marginBottom: 8 },
  cardExcerpt:       { fontSize: 14, color: C.grey, lineHeight: 20, marginBottom: 12 },
  cardFooter:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  authorText:        { fontSize: 12, color: C.grey },
  dateText:          { fontSize: 12, color: C.grey },
  readMore:          { fontSize: 13, fontWeight: '700', color: C.navy },

  // Detail modal
  modalHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  modalBack:         {},
  detailScroll:      { paddingHorizontal: 20, paddingTop: 20 },
  detailTitle:       { fontSize: 22, fontWeight: '800', color: C.navy, marginBottom: 12, lineHeight: 30 },
  detailMeta:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  detailContent:     { fontSize: 15, color: C.dark, lineHeight: 26, marginBottom: 28 },

  // Comments
  commentSection:    { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 20 },
  commentSectionTitle: { fontSize: 16, fontWeight: '800', color: C.navy, marginBottom: 14 },
  commentInput:      { flexDirection: 'row', gap: 10, marginBottom: 20, alignItems: 'flex-end' },
  commentTextInput:  { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.dark, backgroundColor: C.white, maxHeight: 100 },
  commentPostBtn:    { backgroundColor: C.yellow, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  commentPostTxt:    { fontSize: 13, fontWeight: '700', color: C.navy },
  noComments:        { textAlign: 'center', color: C.grey, fontSize: 14, marginVertical: 20 },
  commentCard:       { backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  commentHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  commentAvatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  commentAvatarTxt:  { color: C.yellow, fontSize: 13, fontWeight: '800' },
  commentAuthor:     { fontSize: 13, fontWeight: '700', color: C.dark },
  commentTime:       { fontSize: 11, color: C.grey },
  commentContent:    { fontSize: 14, color: C.dark, lineHeight: 20 },
});
