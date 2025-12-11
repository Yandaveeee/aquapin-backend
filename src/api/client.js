import axios from 'axios';

const API_URL = '192.168.68.152:8000'; 

export default axios.create({
  baseURL: API_URL,
});