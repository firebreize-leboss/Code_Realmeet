// constants/categories.ts
// Catégories prédéfinies pour les activités

export interface PredefinedCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const PREDEFINED_CATEGORIES: PredefinedCategory[] = [
  {
    id: 'rencontre-amoureuse',
    name: 'Rencontre amoureuse',
    icon: 'heart.fill',
    color: '#FFB3D9' // Soft pink for light theme
  },
  {
    id: 'repas',
    name: 'Repas',
    icon: 'fork.knife',
    color: '#FFD580' // Soft orange for light theme
  },
  {
    id: 'festival',
    name: 'Festival',
    icon: 'music.note',
    color: '#D1A3E6' // Soft purple for light theme
  },
  {
    id: 'bar',
    name: 'Bar',
    icon: 'cup.and.saucer.fill',
    color: '#FFB380' // Soft coral for light theme
  },
  {
    id: 'loisirs',
    name: 'Loisirs',
    icon: 'figure.play',
    color: '#80E6D9' // Soft teal for light theme
  },
  {
    id: 'sport',
    name: 'Sport',
    icon: 'figure.run',
    color: '#A8E6A3' // Soft green for light theme
  },
  {
    id: 'soirees',
    name: 'Soirées',
    icon: 'sparkles',
    color: '#C880E6' // Soft violet for light theme
  },
  {
    id: 'culture',
    name: 'Culture',
    icon: 'paintpalette.fill',
    color: '#80C8FF' // Soft blue for light theme
  },
];