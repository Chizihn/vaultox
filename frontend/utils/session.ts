import Cookies from "js-cookie";
import type { CredentialStatus } from "@/types";

const ACCESS_TOKEN_COOKIE = "vaultox_access_token";
const REFRESH_TOKEN_COOKIE = "vaultox_refresh_token";
const CREDENTIAL_STATUS_COOKIE = "vaultox_credential_status";

// Custom storage object for cookies
export const cookieStorage = {
  getItem: (name: string): string | null => {
    try {
      const value = Cookies.get(name);
      return value || null;
    } catch (error) {
      console.warn(`Error reading cookie ${name}:`, error);
      return null;
    }
  },
  setItem: (name: string, value: string, options = {}): void => {
    try {
      Cookies.set(name, value, {
        ...options,
        expires: 2,
        sameSite: "Strict",
        secure: process.env.NODE_ENV === "production",
        path: "/", // Ensure cookie is available everywhere
      });
    } catch (error) {
      console.error(`Error setting cookie ${name}:`, error);
    }
  },
  removeItem: (name: string): void => {
    Cookies.remove(name, { path: "/" }); // Ensure cookie is removed from all paths
  },
};

export function getAccessToken(): string {
  return cookieStorage.getItem(ACCESS_TOKEN_COOKIE) || "";
}

export function setAccessToken(token: string) {
  cookieStorage.setItem(ACCESS_TOKEN_COOKIE, token);
}

export function removeAccessToken() {
  cookieStorage.removeItem(ACCESS_TOKEN_COOKIE);
}

export function getRefreshToken(): string {
  return cookieStorage.getItem(REFRESH_TOKEN_COOKIE) || "";
}

export function setRefreshToken(token: string) {
  cookieStorage.setItem(REFRESH_TOKEN_COOKIE, token);
}

export function removeRefreshToken() {
  cookieStorage.removeItem(REFRESH_TOKEN_COOKIE);
}

export function getCredentialStatus(): CredentialStatus | null {
  const value = cookieStorage.getItem(CREDENTIAL_STATUS_COOKIE);
  if (
    value === "verified" ||
    value === "pending_kyc" ||
    value === "unregistered"
  ) {
    return value;
  }
  return null;
}

export function setCredentialStatus(status: CredentialStatus) {
  cookieStorage.setItem(CREDENTIAL_STATUS_COOKIE, status);
}

export function removeCredentialStatus() {
  cookieStorage.removeItem(CREDENTIAL_STATUS_COOKIE);
}

export function clearAuthSession() {
  removeAccessToken();
  removeRefreshToken();
  removeCredentialStatus();
}
