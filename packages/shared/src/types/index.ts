export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  modules_enabled: string[];
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export type ModuleId = 'finance' | 'life' | string;

export interface ModuleManifest {
  id: ModuleId;
  label: string;
  icon: string;
  color: string;
  routePrefix: string;
  apiPrefix: string;
  version: string;
  enabled: boolean;
}
