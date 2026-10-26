import api from "./api";

type IdentifyResponse = {
  success: boolean;
  data: {
    identifier: string;
    role: "DRIVER" | "GODOWN_MANAGER" | "PURCHASE_MANAGER" | "CASHIER";
    masked: string;
    availableMethods: {
      password: boolean;
      otp: boolean;
    };
  };
  message?: string;
};

type LoginResponse = {
  success: boolean;
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: "DRIVER" | "GODOWN_MANAGER" | "PURCHASE_MANAGER" | "CASHIER";
    status: "ACTIVE" | "INACTIVE";
    agency_id?: number | null;
    agency_name?: string | null;
    company_name?: string | null;
  };
  message?: string;
};

export const identifyAuthMethod = async (identifier: string) => {
  const res = await api.post<IdentifyResponse>("/auth/identify", {
    identifier,
  });
  return res.data;
};

export const loginWithPassword = async (
  identifier: string,
  password: string,
) => {
  const res = await api.post<LoginResponse>("/auth/login/password", {
    identifier,
    password,
  });
  return res.data;
};

export const requestOtp = async (identifier: string) => {
  const res = await api.post("/auth/login/otp/request", { identifier });
  return res.data;
};

export const verifyOtp = async (identifier: string, otp: string) => {
  const res = await api.post<LoginResponse>("/auth/login/otp/verify", {
    identifier,
    otp,
  });
  return res.data;
};

export const fetchUserSettings = async (userId: number) => {
  const res = await api.get<{
    success: boolean;
    data: {
      id: number;
      name: string;
      agency_name?: string | null;
      company_name?: string | null;
      email?: string | null;
      phone?: string | null;
      role: string;
    };
  }>(`/users/${userId}/settings`);
  return res.data;
};

