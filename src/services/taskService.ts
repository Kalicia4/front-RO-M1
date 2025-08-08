import axios from "axios";
import type { Task } from "../types/task";

const API_BASE = "http://localhost:8080/api/tache";

export const saveTasks = (tasks: Task[]) => axios.post(`${API_BASE}/auto`, tasks);
export const getDateTot = () => axios.get(`${API_BASE}/dateTot`);
export const getDateTard = () => axios.get(`${API_BASE}/dateTard`);
export const getMarge = () => axios.get(`${API_BASE}/marge`);
export const getCritique = () => axios.get(`${API_BASE}/critique`);