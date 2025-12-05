import axios from 'axios';

// REPLACE THIS WITH YOUR COMPUTER'S IP ADDRESS
// KEEP THE PORT :8000
const API_URL = 'http://192.168.68.152:8000'; 

export default axios.create({
  baseURL: API_URL,
});