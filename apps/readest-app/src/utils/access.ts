import { jwtDecode } from 'jwt-decode';
import { isSupabaseConfigured, supabase } from '@/utils/supabase';
import { UserPlan } from '@/types/quota';
import { DEFAULT_DAILY_TRANSLATION_QUOTA, DEFAULT_STORAGE_QUOTA } from '@/services/constants';
import { isWebAppPlatform } from '@/services/environment';
import { getDailyUsage } from '@/services/translators/utils';
import { getRuntimeConfig } from '@/services/runtimeConfig';

interface Token {
  plan: UserPlan;
  storage_usage_bytes: number;
  storage_purchased_bytes: number;
  [key: string]: string | number;
}

export const getSubscriptionPlan = (token: string): UserPlan => {
  const data = jwtDecode<Token>(token) || {};
  return data['plan'] || 'free';
};

export const getUserProfilePlan = (token: string): UserPlan => {
  const data = jwtDecode<Token>(token) || {};
  let plan = data['plan'] || 'free';
  if (plan === 'free') {
    const purchasedQuota = data['storage_purchased_bytes'] || 0;
    if (purchasedQuota > 0) {
      plan = 'purchase';
    }
  }
  return plan;
};

/**
 * Plans that include the "Send to Readest via email" feature: Plus,
 * Pro, and Lifetime (`purchase`). Free users see an upgrade card on
 * the client and get a 403 from the server endpoints that allocate /
 * rotate the address, plus a bounce from the inbound email Worker.
 *
 * Other Send channels (in-app `/send` page, mobile share-sheet, browser
 * extension) stay open to free users — the gate is the personal email
 * inbox only.
 */
export const EMAIL_IN_PLANS: readonly UserPlan[] = ['plus', 'pro', 'purchase'];

export const isEmailInPlan = (plan: UserPlan): boolean =>
  (EMAIL_IN_PLANS as readonly UserPlan[]).includes(plan);

/**
 * Historical plan list for third-party cloud sync. The local-first build now
 * bypasses this gate via {@link CLOUD_SYNC_REQUIRES_PREMIUM} = false.
 */
export const CLOUD_SYNC_PLANS: readonly UserPlan[] = ['plus', 'pro', 'purchase'];

export const isCloudSyncInPlan = (plan: UserPlan): boolean =>
  (CLOUD_SYNC_PLANS as readonly UserPlan[]).includes(plan);

/**
 * Local-first build policy: self-hosted / user-controlled cloud sync backends
 * are always available and never paywalled.
 */
export const CLOUD_SYNC_REQUIRES_PREMIUM = false;

/**
 * Local-first: the app does not enforce translation usage caps. Provider-side
 * limits (LiteLLM / upstream) remain outside this client.
 */
export const TRANSLATION_QUOTA_UNLIMITED = true;

/**
 * Whether third-party cloud sync is available for a plan. Falls back to the
 * {@link isCloudSyncInPlan} paywall while {@link CLOUD_SYNC_REQUIRES_PREMIUM}
 * is on; flipping the switch off ungates every plan.
 */
export const isCloudSyncAllowed = (plan: UserPlan): boolean =>
  !CLOUD_SYNC_REQUIRES_PREMIUM || isCloudSyncInPlan(plan);

export const STORAGE_QUOTA_GRACE_BYTES = 10 * 1024 * 1024; // 10 MB grace

export const getStoragePlanData = (token: string) => {
  if (!token) {
    // Unauthenticated local-first: no official cloud storage pool.
    return { plan: 'free' as UserPlan, usage: 0, quota: Number.MAX_SAFE_INTEGER };
  }
  const data = jwtDecode<Token>(token) || {};
  const plan = data['plan'] || 'free';
  const usage = data['storage_usage_bytes'] || 0;
  const purchasedQuota = data['storage_purchased_bytes'] || 0;
  const runtimeConfig = getRuntimeConfig();
  const fixedQuota =
    runtimeConfig?.storageFixedQuota ?? parseInt(process.env['STORAGE_FIXED_QUOTA'] ?? '0');
  const planQuota = fixedQuota || DEFAULT_STORAGE_QUOTA[plan] || DEFAULT_STORAGE_QUOTA['free'];
  const quota = planQuota + purchasedQuota;

  return {
    plan,
    usage,
    quota,
  };
};

export const getTranslationQuota = (plan: UserPlan): number => {
  if (TRANSLATION_QUOTA_UNLIMITED) return Number.MAX_SAFE_INTEGER;
  const runtimeConfig = getRuntimeConfig();
  const fixedQuota =
    runtimeConfig?.translationFixedQuota ?? parseInt(process.env['TRANSLATION_FIXED_QUOTA'] ?? '0');
  return (
    fixedQuota || DEFAULT_DAILY_TRANSLATION_QUOTA[plan] || DEFAULT_DAILY_TRANSLATION_QUOTA['free']
  );
};

export const getTranslationPlanData = (token: string) => {
  const data = jwtDecode<Token>(token) || {};
  const plan: UserPlan = data['plan'] || 'free';
  const usage = getDailyUsage() || 0;
  const quota = getTranslationQuota(plan);

  return {
    plan,
    usage,
    quota,
  };
};

export const getDailyTranslationPlanData = (token: string) => {
  const data = jwtDecode<Token>(token) || {};
  const plan = data['plan'] || 'free';
  const quota = getTranslationQuota(plan);

  return {
    plan,
    quota,
  };
};

export const getAccessToken = async (): Promise<string | null> => {
  // In browser context there might be two instances of supabase one in the app route
  // and the other in the pages route, and they might have different sessions
  // making the access token invalid for API calls. In that case we should use localStorage.
  if (isWebAppPlatform()) {
    return localStorage.getItem('token') ?? null;
  }
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
};

export const getUserID = async (): Promise<string | null> => {
  if (isWebAppPlatform()) {
    const user = localStorage.getItem('user') ?? '{}';
    return JSON.parse(user).id ?? null;
  }
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
};

export const validateUserAndToken = async (authHeader: string | null | undefined) => {
  if (!authHeader || !isSupabaseConfigured()) return {};

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return {};
  return { user, token };
};
