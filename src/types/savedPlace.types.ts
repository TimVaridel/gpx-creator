export type SavedPlaceCategory =
  | ''
  | 'company'
  | 'border'
  | 'waypoint'
  | 'parking';

export const SAVED_PLACE_CATEGORIES: {
  value: SavedPlaceCategory;
  label: string;
  emoji: string;
}[] = [
  { value: '',         label: 'Sans catégorie',      emoji: '✅' },
  { value: 'company',  label: 'Entreprise / dépôt',  emoji: '🏭' },
  { value: 'border',   label: 'Frontière / douane',  emoji: '📄' },
  { value: 'waypoint', label: 'Point intermédiaire', emoji: '📌' },
  { value: 'parking',  label: 'Parking',             emoji: '🅿️' },
];

export interface SavedPlace {
  id:         string;
  user_id?:   string;
  name:       string;
  lat:        number;
  lng:        number;
  category:   SavedPlaceCategory;
  created_at: string;
}
