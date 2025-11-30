import { db } from "../config/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  orderBy,
  Timestamp
} from "firebase/firestore";
import { Category, Note, UserProfile } from "../types";
import { UserAISettings, AIProviderType } from "./ai/types";

// Collections structure:
// - users/{userId}/categories - private categories
// - users/{userId}/notes - private notes
// - public/categories/{categoryId} - public categories (admin only)
// - public/notes/{noteId} - public notes (admin only)
// - users/{userId} - user profile with isAdmin flag

// ==================== USER PROFILE ====================

export const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, "users", userId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

export const createUserProfile = async (userId: string, email: string, displayName?: string): Promise<void> => {
  const docRef = doc(db, "users", userId);
  const profile: Omit<UserProfile, 'id'> = {
    email,
    displayName: displayName || email.split('@')[0],
    isAdmin: false,
    createdAt: Date.now()
  };
  await setDoc(docRef, profile, { merge: true });
};

// ==================== CATEGORIES ====================

export const fetchCategories = async (userId: string): Promise<Category[]> => {
  try {
    // Fetch private categories
    const privateQuery = query(collection(db, "users", userId, "categories"), orderBy("createdAt", "asc"));
    const privateSnapshot = await getDocs(privateQuery);
    const privateCategories = privateSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isPublic: false
    } as Category));

    // Fetch public categories
    const publicQuery = query(collection(db, "public", "data", "categories"), orderBy("createdAt", "asc"));
    const publicSnapshot = await getDocs(publicQuery);
    const publicCategories = publicSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isPublic: true
    } as Category));

    // Return public first, then private
    return [...publicCategories, ...privateCategories];
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
};

export const addCategory = async (userId: string, category: Omit<Category, 'id'>): Promise<string> => {
  const colRef = collection(db, "users", userId, "categories");
  const docRef = await addDoc(colRef, { ...category, ownerId: userId, isPublic: false, createdAt: Date.now() });
  return docRef.id;
};

export const updateCategory = async (userId: string, category: Category, isAdmin?: boolean): Promise<void> => {
  if (category.isPublic) {
    // Only admin can edit public categories
    if (!isAdmin) {
      throw new Error("Only admin can edit public categories");
    }
    const docRef = doc(db, "public", "data", "categories", category.id);
    const { id, isPublic, ...data } = category;
    await updateDoc(docRef, data);
  } else {
    const docRef = doc(db, "users", userId, "categories", category.id);
    const { id, ...data } = category;
    await updateDoc(docRef, data);
  }
};

export const deleteCategory = async (userId: string, categoryId: string, isPublic?: boolean): Promise<void> => {
  if (isPublic) {
    throw new Error("Cannot delete public categories");
  }
  await deleteDoc(doc(db, "users", userId, "categories", categoryId));
};

export const fetchNotes = async (userId: string): Promise<Note[]> => {
  try {
    // Fetch private notes
    const privateQuery = query(collection(db, "users", userId, "notes"), orderBy("updatedAt", "desc"));
    const privateSnapshot = await getDocs(privateQuery);
    const privateNotes = privateSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isPublic: false
    } as Note));

    // Fetch public notes
    const publicQuery = query(collection(db, "public", "data", "notes"), orderBy("updatedAt", "desc"));
    const publicSnapshot = await getDocs(publicQuery);
    const publicNotes = publicSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isPublic: true
    } as Note));

    // Return public first, then private
    return [...publicNotes, ...privateNotes];
  } catch (error) {
    console.error("Error fetching notes:", error);
    return [];
  }
};

// Helper function to remove undefined values from object
const removeUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as Partial<T>;
};

// Save note - handles both private and public notes
// isAdmin: whether the current user is admin
// categoryIsPublic: whether the category is public (determines default note visibility for admin)
export const saveNote = async (
  userId: string,
  note: Partial<Note> & { categoryId: string },
  isAdmin?: boolean,
  categoryIsPublic?: boolean
): Promise<{ id: string; isPublic: boolean }> => {

  if (note.id) {
    // UPDATE existing note
    if (note.isPublic) {
      // Editing public note - only admin can do this
      if (!isAdmin) {
        throw new Error("Only admin can edit public notes");
      }
      const docRef = doc(db, "public", "data", "notes", note.id);
      const { id, ...data } = note;
      const cleanData = removeUndefined({ ...data, updatedAt: Date.now() });
      await updateDoc(docRef, cleanData);
      return { id: note.id, isPublic: true };
    } else {
      // Editing private note
      const docRef = doc(db, "users", userId, "notes", note.id);
      const { id, ...data } = note;
      const cleanData = removeUndefined({ ...data, updatedAt: Date.now() });
      await updateDoc(docRef, cleanData);
      return { id: note.id, isPublic: false };
    }
  } else {
    // CREATE new note
    // Determine if note should be public:
    // - Admin creating in public category -> public by default
    // - Admin creating in private category -> private
    // - Non-admin -> always private
    const shouldBePublic = isAdmin && categoryIsPublic;

    if (shouldBePublic) {
      // Create in public collection
      const cleanNote = removeUndefined({
        ...note,
        ownerId: userId,
        isPublic: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      const docRef = await addDoc(collection(db, "public", "data", "notes"), cleanNote);
      return { id: docRef.id, isPublic: true };
    } else {
      // Create in private collection
      const cleanNote = removeUndefined({
        ...note,
        ownerId: userId,
        isPublic: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      const docRef = await addDoc(collection(db, "users", userId, "notes"), cleanNote);
      return { id: docRef.id, isPublic: false };
    }
  }
};

export const deleteNote = async (userId: string, noteId: string, isPublic?: boolean, isAdmin?: boolean): Promise<void> => {
  if (isPublic) {
    if (!isAdmin) {
      throw new Error("Only admin can delete public notes");
    }
    await deleteDoc(doc(db, "public", "data", "notes", noteId));
    return;
  }
  await deleteDoc(doc(db, "users", userId, "notes", noteId));
};

export const migrateNotesToCategory = async (userId: string, fromCatId: string, toCatId: string): Promise<void> => {
  // Query all notes in old category
  const q = query(
    collection(db, "users", userId, "notes"),
    where("categoryId", "==", fromCatId)
  );
  const snapshot = await getDocs(q);

  // Batch update would be better for atomicity, but using loop for simplicity in this setup
  const promises = snapshot.docs.map(d =>
    updateDoc(doc(db, "users", userId, "notes", d.id), { categoryId: toCatId })
  );
  await Promise.all(promises);
};

// ==================== ADMIN FUNCTIONS ====================

export const publishCategory = async (adminId: string, category: Omit<Category, 'id' | 'isPublic'>): Promise<string> => {
  const colRef = collection(db, "public", "data", "categories");
  const docRef = await addDoc(colRef, {
    ...category,
    ownerId: adminId,
    isPublic: true,
    createdAt: Date.now()
  });
  return docRef.id;
};

export const updatePublicCategory = async (categoryId: string, category: Partial<Category>): Promise<void> => {
  const docRef = doc(db, "public", "data", "categories", categoryId);
  const { id, isPublic, ...data } = category;
  await updateDoc(docRef, data);
};

export const deletePublicCategory = async (categoryId: string): Promise<void> => {
  await deleteDoc(doc(db, "public", "data", "categories", categoryId));
};

export const publishNote = async (adminId: string, note: Omit<Note, 'id' | 'isPublic'>): Promise<string> => {
  const colRef = collection(db, "public", "data", "notes");
  const docRef = await addDoc(colRef, {
    ...note,
    ownerId: adminId,
    isPublic: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  return docRef.id;
};

export const updatePublicNote = async (noteId: string, note: Partial<Note>): Promise<void> => {
  const docRef = doc(db, "public", "data", "notes", noteId);
  const { id, isPublic, ...data } = note;
  await updateDoc(docRef, { ...data, updatedAt: Date.now() });
};

export const deletePublicNote = async (noteId: string): Promise<void> => {
  await deleteDoc(doc(db, "public", "data", "notes", noteId));
};

// Fetch only public categories (for admin management)
export const fetchPublicCategories = async (): Promise<Category[]> => {
  try {
    const q = query(collection(db, "public", "data", "categories"), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isPublic: true
    } as Category));
  } catch (error) {
    console.error("Error fetching public categories:", error);
    return [];
  }
};

// Fetch only public notes (for admin management)
export const fetchPublicNotes = async (): Promise<Note[]> => {
  try {
    const q = query(collection(db, "public", "data", "notes"), orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isPublic: true
    } as Note));
  } catch (error) {
    console.error("Error fetching public notes:", error);
    return [];
  }
};

// ==================== ADMIN TOGGLE PUBLISH ====================

// Toggle note between public and private
export const toggleNotePublish = async (
  userId: string,
  note: Note,
  makePublic: boolean
): Promise<{ newId: string; isPublic: boolean }> => {
  const cleanNote = removeUndefined({
    categoryId: note.categoryId,
    title: note.title,
    content: note.content,
    imageUrl: note.imageUrl,
    tags: note.tags,
    createdAt: note.createdAt,
    updatedAt: Date.now(),
    ownerId: userId
  });

  if (makePublic) {
    // Move from private to public
    // 1. Create in public collection
    const publicColRef = collection(db, "public", "data", "notes");
    const newDoc = await addDoc(publicColRef, { ...cleanNote, isPublic: true });

    // 2. Delete from private collection
    if (!note.isPublic) {
      await deleteDoc(doc(db, "users", userId, "notes", note.id));
    }

    return { newId: newDoc.id, isPublic: true };
  } else {
    // Move from public to private
    // 1. Create in private collection
    const privateColRef = collection(db, "users", userId, "notes");
    const newDoc = await addDoc(privateColRef, { ...cleanNote, isPublic: false });

    // 2. Delete from public collection
    if (note.isPublic) {
      await deleteDoc(doc(db, "public", "data", "notes", note.id));
    }

    return { newId: newDoc.id, isPublic: false };
  }
};

// Toggle category between public and private
// Also migrates all notes in that category
export const toggleCategoryPublish = async (
  userId: string,
  category: Category,
  makePublic: boolean
): Promise<{ newId: string; isPublic: boolean; migratedNoteIds: Map<string, string> }> => {
  const cleanCategory = removeUndefined({
    name: category.name,
    color: category.color,
    icon: category.icon,
    ownerId: userId,
    createdAt: Date.now()
  });

  // Map of old note id -> new note id
  const migratedNoteIds = new Map<string, string>();

  if (makePublic) {
    // Move category from private to public
    const publicColRef = collection(db, "public", "data", "categories");
    const newCatDoc = await addDoc(publicColRef, { ...cleanCategory, isPublic: true });
    const newCategoryId = newCatDoc.id;

    // Migrate all notes in this category to public
    if (!category.isPublic) {
      const notesQuery = query(
        collection(db, "users", userId, "notes"),
        where("categoryId", "==", category.id)
      );
      const notesSnapshot = await getDocs(notesQuery);

      for (const noteDoc of notesSnapshot.docs) {
        const noteData = noteDoc.data();
        const cleanNote = removeUndefined({
          categoryId: newCategoryId, // Use new category ID
          title: noteData.title,
          content: noteData.content,
          imageUrl: noteData.imageUrl,
          tags: noteData.tags,
          createdAt: noteData.createdAt,
          updatedAt: Date.now(),
          ownerId: userId,
          isPublic: true
        });

        // Create in public
        const newNoteDoc = await addDoc(collection(db, "public", "data", "notes"), cleanNote);
        migratedNoteIds.set(noteDoc.id, newNoteDoc.id);

        // Delete from private
        await deleteDoc(doc(db, "users", userId, "notes", noteDoc.id));
      }

      // Delete old category
      await deleteDoc(doc(db, "users", userId, "categories", category.id));
    }

    return { newId: newCategoryId, isPublic: true, migratedNoteIds };
  } else {
    // Move category from public to private
    const privateColRef = collection(db, "users", userId, "categories");
    const newCatDoc = await addDoc(privateColRef, { ...cleanCategory, isPublic: false });
    const newCategoryId = newCatDoc.id;

    // Migrate all notes in this category to private
    if (category.isPublic) {
      const notesQuery = query(
        collection(db, "public", "data", "notes"),
        where("categoryId", "==", category.id)
      );
      const notesSnapshot = await getDocs(notesQuery);

      for (const noteDoc of notesSnapshot.docs) {
        const noteData = noteDoc.data();
        const cleanNote = removeUndefined({
          categoryId: newCategoryId, // Use new category ID
          title: noteData.title,
          content: noteData.content,
          imageUrl: noteData.imageUrl,
          tags: noteData.tags,
          createdAt: noteData.createdAt,
          updatedAt: Date.now(),
          ownerId: userId,
          isPublic: false
        });

        // Create in private
        const newNoteDoc = await addDoc(collection(db, "users", userId, "notes"), cleanNote);
        migratedNoteIds.set(noteDoc.id, newNoteDoc.id);

        // Delete from public
        await deleteDoc(doc(db, "public", "data", "notes", noteDoc.id));
      }

      // Delete old category
      await deleteDoc(doc(db, "public", "data", "categories", category.id));
    }

    return { newId: newCategoryId, isPublic: false, migratedNoteIds };
  }
};

// Admin can edit public notes
export const savePublicNote = async (note: Partial<Note> & { id: string }): Promise<void> => {
  const docRef = doc(db, "public", "data", "notes", note.id);
  const { id, ...data } = note;
  const cleanData = removeUndefined({ ...data, updatedAt: Date.now() });
  await updateDoc(docRef, cleanData);
};

// Admin can delete public notes
export const deletePublicNoteById = async (noteId: string): Promise<void> => {
  await deleteDoc(doc(db, "public", "data", "notes", noteId));
};

// Admin can delete public categories
export const deletePublicCategoryById = async (categoryId: string): Promise<void> => {
  await deleteDoc(doc(db, "public", "data", "categories", categoryId));
};

// ==================== USER AI SETTINGS (SECURE) ====================
// API keys are stored in a private subcollection that only the user can access

export const saveUserAISettings = async (userId: string, settings: UserAISettings): Promise<void> => {
  // Store in users/{userId}/private/aiSettings - only accessible by the user
  const docRef = doc(db, "users", userId, "private", "aiSettings");
  const cleanSettings = removeUndefined({
    geminiApiKey: settings.geminiApiKey || null,
    chatgptApiKey: settings.chatgptApiKey || null,
    preferredProvider: settings.preferredProvider || null,
    updatedAt: Date.now()
  });
  await setDoc(docRef, cleanSettings, { merge: true });
};

export const fetchUserAISettings = async (userId: string): Promise<UserAISettings | null> => {
  try {
    const docRef = doc(db, "users", userId, "private", "aiSettings");
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        geminiApiKey: data.geminiApiKey || undefined,
        chatgptApiKey: data.chatgptApiKey || undefined,
        preferredProvider: data.preferredProvider || undefined
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching AI settings:", error);
    return null;
  }
};

export const deleteUserAISettings = async (userId: string): Promise<void> => {
  const docRef = doc(db, "users", userId, "private", "aiSettings");
  await deleteDoc(docRef);
};