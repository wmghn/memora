import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { GoogleGenAI, Type } from "@google/genai";

admin.initializeApp();

const db = admin.firestore();

// Admin emails from environment variable (comma-separated)
const ADMIN_EMAILS = (process.env.VITE_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

interface SetAdminRoleData {
  targetUserId: string;
  isAdmin: boolean;
}

/**
 * Callable function to set admin status (only callable by existing admins)
 */
export const setAdminRole = onCall(async (request: CallableRequest<SetAdminRoleData>) => {
  const { data, auth } = request;

  // Check if caller is authenticated
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "Must be authenticated to call this function"
    );
  }

  // Check if caller is admin
  const callerDoc = await db.doc(`users/${auth.uid}`).get();
  const callerData = callerDoc.data();

  if (!callerData?.isAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Only admins can set admin roles"
    );
  }

  const { targetUserId, isAdmin } = data;

  if (!targetUserId || typeof isAdmin !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      "Must provide targetUserId and isAdmin boolean"
    );
  }

  // Update Firestore
  await db.doc(`users/${targetUserId}`).update({ isAdmin });

  // Update custom claims
  await admin.auth().setCustomUserClaims(targetUserId, { admin: isAdmin });

  console.log(`Admin status for ${targetUserId} set to ${isAdmin}`);

  return { success: true, targetUserId, isAdmin };
});

/**
 * Callable function to set initial admin (one-time setup)
 * This should be disabled after initial setup for security
 */
export const setupInitialAdmin = onCall(async (request: CallableRequest) => {
  const { auth } = request;

  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "Must be authenticated"
    );
  }

  // Check if any admin exists
  const adminsSnapshot = await db
    .collection("users")
    .where("isAdmin", "==", true)
    .limit(1)
    .get();

  if (!adminsSnapshot.empty) {
    throw new HttpsError(
      "already-exists",
      "An admin already exists. Use setAdminRole instead."
    );
  }

  // Get caller's email
  const userRecord = await admin.auth().getUser(auth.uid);

  if (!userRecord.email || !ADMIN_EMAILS.includes(userRecord.email.toLowerCase())) {
    throw new HttpsError(
      "permission-denied",
      "Your email is not in the admin list"
    );
  }

  // Set this user as admin
  await db.doc(`users/${auth.uid}`).set(
    {
      email: userRecord.email,
      displayName: userRecord.displayName || userRecord.email.split("@")[0],
      isAdmin: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await admin.auth().setCustomUserClaims(auth.uid, { admin: true });

  console.log(`Initial admin setup completed for ${userRecord.email}`);

  return { success: true, message: "You are now an admin" };
});

/**
 * Create user profile when user document is created
 * Trigger: when a new document is created in users collection
 */
export const onUserProfileCreated = onDocumentCreated("users/{userId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const userId = event.params.userId;
  const data = snapshot.data();

  // Skip if isAdmin is already set
  if (data.isAdmin !== undefined) return;

  // Check if email is in admin list
  const email = data.email?.toLowerCase() || "";
  const isAdmin = ADMIN_EMAILS.includes(email);

  if (isAdmin) {
    await snapshot.ref.update({ isAdmin: true });
    await admin.auth().setCustomUserClaims(userId, { admin: true });
    console.log(`Auto-assigned admin role to ${email}`);
  }
});

/**
 * Callable function to create user profile (call after signup)
 */
export const createUserProfile = onCall(async (request: CallableRequest) => {
  const { auth } = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated");
  }

  const userRecord = await admin.auth().getUser(auth.uid);
  const email = userRecord.email?.toLowerCase() || "";
  const isAdmin = ADMIN_EMAILS.includes(email);

  const userProfile = {
    email: userRecord.email || "",
    displayName: userRecord.displayName || email.split("@")[0] || "User",
    isAdmin,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.doc(`users/${auth.uid}`).set(userProfile, { merge: true });

  if (isAdmin) {
    await admin.auth().setCustomUserClaims(auth.uid, { admin: true });
  }

  console.log(`User profile created for ${email}, isAdmin: ${isAdmin}`);

  return { success: true, isAdmin };
});

// ========================================
// AI Enhancement Functions (Gemini)
// ========================================

interface AIEnhanceData {
  text: string;
  imageBase64?: string;
}

interface AIResponse {
  title: string;
  content: string;
  tags: string[];
}

const MODEL_NAME = "gemini-2.5-flash";

/**
 * Callable function to enhance notes using Gemini AI
 * This keeps the API key secure on the server side
 */
export const enhanceNoteWithAI = onCall(
  { secrets: ["GEMINI_API_KEY"] },
  async (request: CallableRequest<AIEnhanceData>): Promise<AIResponse> => {
    const { data, auth } = request;

    // Check if caller is authenticated
    if (!auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be authenticated to use AI features"
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "AI service is not configured"
      );
    }

    const { text, imageBase64 } = data;

    if (!text || typeof text !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Must provide text to enhance"
      );
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      // Add image if available
      if (imageBase64) {
        const base64Data = imageBase64.split(",")[1] || imageBase64;
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data,
          },
        });
      }

      // Add text prompt
      const prompt = `
        You are an expert tutor helper. The user has provided a note or a formula.

        Task:
        1. Analyze the text ${imageBase64 ? "and the provided image" : ""}.
        2. If it is a formula, explain what it is, variables, and usage.
        3. If it is a concept, summarize it clearly.
        4. Format the output with clear Markdown (bolding, lists).
        5. Suggest 3 relevant short tags.

        Input text: "${text}"
      `;
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "A clear, concise title for this note" },
              content: { type: Type.STRING, description: "The detailed explanation in Markdown format" },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 relevant tags",
              },
            },
          },
        },
      });

      const resultText = response.text;
      if (!resultText) {
        throw new HttpsError("internal", "No response from AI");
      }

      return JSON.parse(resultText) as AIResponse;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw new HttpsError(
        "internal",
        "Failed to enhance note with AI"
      );
    }
  }
);
