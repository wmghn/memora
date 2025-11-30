"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserProfile = exports.onUserProfileCreated = exports.setupInitialAdmin = exports.setAdminRole = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
// Admin emails from environment variable (comma-separated)
const ADMIN_EMAILS = (process.env.VITE_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
/**
 * Callable function to set admin status (only callable by existing admins)
 */
exports.setAdminRole = (0, https_1.onCall)(async (request) => {
    const { data, auth } = request;
    // Check if caller is authenticated
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be authenticated to call this function");
    }
    // Check if caller is admin
    const callerDoc = await db.doc(`users/${auth.uid}`).get();
    const callerData = callerDoc.data();
    if (!(callerData === null || callerData === void 0 ? void 0 : callerData.isAdmin)) {
        throw new https_1.HttpsError("permission-denied", "Only admins can set admin roles");
    }
    const { targetUserId, isAdmin } = data;
    if (!targetUserId || typeof isAdmin !== "boolean") {
        throw new https_1.HttpsError("invalid-argument", "Must provide targetUserId and isAdmin boolean");
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
exports.setupInitialAdmin = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be authenticated");
    }
    // Check if any admin exists
    const adminsSnapshot = await db
        .collection("users")
        .where("isAdmin", "==", true)
        .limit(1)
        .get();
    if (!adminsSnapshot.empty) {
        throw new https_1.HttpsError("already-exists", "An admin already exists. Use setAdminRole instead.");
    }
    // Get caller's email
    const userRecord = await admin.auth().getUser(auth.uid);
    if (!userRecord.email || !ADMIN_EMAILS.includes(userRecord.email.toLowerCase())) {
        throw new https_1.HttpsError("permission-denied", "Your email is not in the admin list");
    }
    // Set this user as admin
    await db.doc(`users/${auth.uid}`).set({
        email: userRecord.email,
        displayName: userRecord.displayName || userRecord.email.split("@")[0],
        isAdmin: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await admin.auth().setCustomUserClaims(auth.uid, { admin: true });
    console.log(`Initial admin setup completed for ${userRecord.email}`);
    return { success: true, message: "You are now an admin" };
});
/**
 * Create user profile when user document is created
 * Trigger: when a new document is created in users collection
 */
exports.onUserProfileCreated = (0, firestore_1.onDocumentCreated)("users/{userId}", async (event) => {
    var _a;
    const snapshot = event.data;
    if (!snapshot)
        return;
    const userId = event.params.userId;
    const data = snapshot.data();
    // Skip if isAdmin is already set
    if (data.isAdmin !== undefined)
        return;
    // Check if email is in admin list
    const email = ((_a = data.email) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "";
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
exports.createUserProfile = (0, https_1.onCall)(async (request) => {
    var _a;
    const { auth } = request;
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be authenticated");
    }
    const userRecord = await admin.auth().getUser(auth.uid);
    const email = ((_a = userRecord.email) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "";
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
//# sourceMappingURL=index.js.map