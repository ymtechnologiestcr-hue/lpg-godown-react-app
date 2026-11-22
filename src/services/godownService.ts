import api from './api';

export const getGodownDashboardData = async () => {
  const res = await api.get('/godown/dashboard');
  return res.data.data;
};

export const getStockInLoads = async () => {
  const res = await api.get('/godown/stock-in-loads');
  return res.data.data;
};

export const getStockInLoadDetail = async (loadId: string | number) => {
  const res = await api.get(`/godown/stock-in-loads/${loadId}`);
  return res.data.data;
};

export const approveStockInLoad = async (loadId: string | number) => {
  const res = await api.put(`/godown/stock-in-loads/${loadId}/approve`);
  return res.data;
};

export const getDriverLists = async () => {
  const res = await api.get('/godown/drivers');
  return res.data.data;
};

export const getCylinderProducts = async () => {
  const res = await api.get('/godown/products');
  return res.data.data;
};

export const getDispatchableCylinderProducts = async () => {
  const res = await api.get('/godown/products?mode=dispatch');
  return res.data.data;
};

export const getStockOutLoads = async () => {
  const res = await api.get('/godown/stock-out-loads');
  return res.data.data;
};

export const createStockOutLoad = async (payload: {
  driver_id: number;
  reference_id?: number | string;
  items: {
    product_id: number;
    empty_quantity: number;
    defective_quantity: number;
  }[];
}) => {
  const res = await api.post('/godown/stock-out-loads', payload);
  return res.data;
};

export const getStockOutLoadDetail = async (loadId: string | number) => {
  const res = await api.get(`/godown/stock-out-loads/${loadId}`);
  return res.data.data;
};

export const approveStockOutLoad = async (loadId: string | number) => {
  const res = await api.put(`/godown/stock-out-loads/${loadId}/approve`);
  return res.data;
};

export const getDefectiveLoads = async () => {
  const res = await api.get('/godown/defective-loads');
  return res.data.data;
};

export const createDefectiveLoad = async (payload: {
  stock_from: 'depot' | 'godown' | 'driver';
  driver_id?: number | null;
  reference_id?: number | string;
  bay_location?: string;
  notes?: string;
  items: {
    product_id: number;
    quantity: number;
  }[];
}) => {
  const res = await api.post('/godown/defective-loads', payload);
  return res.data;
};

export const getDeliveryDrivers = async (
  filter: 'today' | 'yesterday' | 'week' = 'today'
) => {
  const res = await api.get(`/godown/delivery-drivers?filter=${filter}`);
  return res.data.data;
};

export const getDriverDayWiseSummary = async (driverId: number) => {
  const res = await api.get(`/godown/drivers/${driverId}/day-wise-summary`);
  return res.data.data;
};

export const createDriverAllocation = async (payload: {
  driver_id: number;
  client_tx_id: string;
  items: {
    product_id: number;
    quantity: number;
  }[];
}) => {
  const res = await api.post('/godown/driver-allocation', payload);
  return res.data;
};

export const getReturnsToday = async () => {
  const res = await api.get('/godown/returns-today');
  return res.data.data;
};

export const approveReturnByCondition = async (payload: {
  driver_id: number;
  condition: 'empty' | 'normal' | 'defective';
}) => {
  const res = await api.put('/godown/returns-today/approve', payload);
  return res.data;
};

export const getTransferEmptyReturns = async () => {
  const res = await api.get('/godown/transfer-empty-returns');
  return res.data.data;
};

export const approveTransferEmptyReturn = async (id: number) => {
  const res = await api.put('/godown/transfer-empty-returns/approve', { id });
  return res.data;
};

export const cancelStockOutLoad = async (loadId: string | number) => {
  const res = await api.put(`/godown/stock-out-loads/${loadId}/cancel`);
  return res.data;
};

export const getCommercialBookings = async (params?: {
  search?: string;
  status?: 'ALL' | 'PENDING' | 'DONE';
}) => {
  const res = await api.get('/godown/commercial-bookings', {
    params,
  });

  return res.data.data;
};

export const approveCommercialBooking = async (
  bookingId: string | number
) => {
  const res = await api.put(
    `/godown/commercial-bookings/${bookingId}/approve`
  );

  return res.data;
};
