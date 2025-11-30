import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

const functions = getFunctions(getApp());

interface SetAdminRoleResponse {
  success: boolean;
  targetUserId: string;
  isAdmin: boolean;
}

interface SetupInitialAdminResponse {
  success: boolean;
  message: string;
}

interface CreateUserProfileResponse {
  success: boolean;
  isAdmin: boolean;
}

/**
 * Set admin role for a user (only callable by existing admins)
 */
export const setAdminRole = async (
  targetUserId: string,
  isAdmin: boolean
): Promise<SetAdminRoleResponse> => {
  const callable = httpsCallable<
    { targetUserId: string; isAdmin: boolean },
    SetAdminRoleResponse
  >(functions, "setAdminRole");

  const result = await callable({ targetUserId, isAdmin });
  return result.data;
};

/**
 * Setup initial admin (one-time, when no admin exists)
 */
export const setupInitialAdmin = async (): Promise<SetupInitialAdminResponse> => {
  const callable = httpsCallable<void, SetupInitialAdminResponse>(
    functions,
    "setupInitialAdmin"
  );

  const result = await callable();
  return result.data;
};

/**
 * Create user profile after signup (call this after user registers)
 */
export const createUserProfileViaFunction = async (): Promise<CreateUserProfileResponse> => {
  const callable = httpsCallable<void, CreateUserProfileResponse>(
    functions,
    "createUserProfile"
  );

  const result = await callable();
  return result.data;
};
