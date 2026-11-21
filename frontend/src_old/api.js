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

export const getBusinesses = () => api.get('/businesses');
export const getDashboard = () => api.get('/dashboard');
export const getQueue = () => api.get('/queue');
export const getDemoDate = () => api.get('/demo/date');
export const advanceDemoDate = (days) => api.post('/demo/advance', { days });
export const getEvents = () => api.get('/events');
export const simulatePaid = (invoice_id, amount) => api.post('/simulate-paid', { invoice_id, amount });
