import { APP_ROLES, AppRole } from './appRole';

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_USER_KEY = 'auth_user';
export const AGENCY_NAME_KEY = 'agency_name';

export type AuthUser = {
  id: number;
  driver_id?: number | null;
  name: string;
  email: string;
  phone: string;
  role: AppRole;
  agency_id?: number | null;
  agency_name?: string | null;
  company_name?: string | null;
};

export const isSupportedMobileRole = (role: AppRole) => {
  return (
    role === APP_ROLES.DRIVER ||
    role === APP_ROLES.GODOWN_MANAGER ||
    role === APP_ROLES.PURCHASE_MANAGER
  );
};

export const getHomeRouteByRole = (role: AppRole) => {
  if (role === APP_ROLES.GODOWN_MANAGER) return '/godown-home';
  if (role === APP_ROLES.PURCHASE_MANAGER) return '/purchase-home';
  return '/';
};
