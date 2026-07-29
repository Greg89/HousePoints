import * as SecureStore from "expo-secure-store";

/**
 * Persisted values that survive app restarts on the device keychain / keystore.
 * We do **not** store the Auth0 refresh token here — that lives in
 * `react-native-auth0`'s CredentialsManager, which uses the same secure enclave.
 */

const ACTIVE_ORG_SLUG_KEY = "housepoints.activeOrgSlug";

export async function getStoredActiveOrgSlug(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACTIVE_ORG_SLUG_KEY);
  } catch {
    return null;
  }
}

export async function persistActiveOrgSlug(slug: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_ORG_SLUG_KEY, slug);
}

export async function clearStoredActiveOrgSlug(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_ORG_SLUG_KEY);
}
