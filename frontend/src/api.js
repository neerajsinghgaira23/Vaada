import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
let businessId = 1;

export function setBusinessId(id) { businessId = id; }
export function getBusinessId() { return businessId; }

const api = axios.create({ baseURL: BASE });
api.interceptors.request.use(cfg => {
  cfg.headers['X-Business-Id'] = businessId;
  return cfg;
});

// Original routes
export const getBusinesses = () => api.get('/businesses');
export const getDashboard = () => api.get('/dashboard');
export const getQueue = () => api.get('/queue');
export const getDemoDate = () => api.get('/demo/date');
export const advanceDemoDate = (days) => api.post('/demo/advance', { days });
export const getEvents = () => api.get('/events');
export const simulatePaid = (invoice_id, amount) => api.post('/simulate-paid', { invoice_id, amount });

// New routes
export const getHealth = () => api.get('/health');
export const getCustomers = () => api.get('/customers');
export const getCustomerDetail = (id) => api.get(`/customers/${id}`);
export const getInvoices = (params) => api.get('/invoices', { params });
export const getInvoiceDetail = (id) => api.get(`/invoices/${id}`);
export const getPromises = (params) => api.get('/promises', { params });
export const getAnalytics = (params) => api.get('/analytics', { params });
export const searchAll = (q) => api.get('/search', { params: { q } });
export const getSettings = () => api.get('/settings');
export const updateSettings = (body) => api.put('/settings', body);
export const resetDemo = () => api.post('/demo/reset');

// Cashfree Payment Links
export const createPaymentLink = (invoice_id, amount, promise_id = null) =>
  api.post('/links', { invoice_id, amount, promise_id });
