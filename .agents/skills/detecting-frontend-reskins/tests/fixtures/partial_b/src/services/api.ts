import axios from 'axios'
export const loadRevenueReport = () => axios.get('/api/v2/report/revenue')
export const loadActiveAccounts = () => axios.get('/api/v2/report/accounts')
