export interface Task {
  nom: string;
  duree: number;
  preced: string[];
  succ?: string[];       // Optionnel si non envoyé
  dateTot?: number;      // Rempli par le backend
  dateTard?: number;
  marge?: number;
}
