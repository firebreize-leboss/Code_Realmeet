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
    color: '#FF6B9D' 
  },
  { 
    id: 'repas', 
    name: 'Repas', 
    icon: 'fork.knife', 
    color: '#F39C12' 
  },
  { 
    id: 'festival', 
    name: 'Festival', 
    icon: 'music.note', 
    color: '#9B59B6' 
  },
  { 
    id: 'bar', 
    name: 'Bar', 
    icon: 'cup.and.saucer.fill', 
    color: '#E67E22' 
  },
  { 
    id: 'loisirs', 
    name: 'Loisirs', 
    icon: 'figure.play', 
    color: '#1ABC9C' 
  },
  { 
    id: 'sport', 
    name: 'Sport', 
    icon: 'figure.run', 
    color: '#27AE60' 
  },
  { 
    id: 'soirees', 
    name: 'Soirées', 
    icon: 'sparkles', 
    color: '#8E44AD' 
  },
  { 
    id: 'culture', 
    name: 'Culture', 
    icon: 'paintpalette.fill', 
    color: '#3498DB' 
  },
];