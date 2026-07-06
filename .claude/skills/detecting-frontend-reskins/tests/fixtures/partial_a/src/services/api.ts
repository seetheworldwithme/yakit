import axios from 'axios'
export const fetchRevenue = () => axios.get('/api/v1/revenue/summary')
export const fetchUsers = () => axios.get('/api/v1/users/active')
