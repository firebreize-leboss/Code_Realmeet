// contexts/SignupContext.tsx
// Contexte centralisé pour le wizard d'inscription multi-étapes

import React, { createContext, useContext, useState, useCallback } from 'react';
import { UserIntention } from '@/lib/database.types';

// Types pour les données du formulaire
export interface SignupFormData {
  // Étape 1: Photo + Nom
  profileImage: string | null;
  firstName: string;
  lastName: string;
  // Étape 2: Date de naissance
  birthDate: string;
  // Étape 3: Contact
  email: string;
  phone: string;
  // Étape 4: Ville
  city: string;
  citySelected: boolean;
  // Étape 5: Intention
  intention: UserIntention;
  // Étape 6: Bio
  bio: string;
  // Étape 7: Intérêts + Mot de passe
  interests: string[];
  password: string;
  confirmPassword: string;
}

// État initial du formulaire
const initialFormData: SignupFormData = {
  profileImage: null,
  firstName: '',
  lastName: '',
  birthDate: '',
  email: '',
  phone: '',
  city: '',
  citySelected: false,
  intention: null,
  bio: '',
  interests: [],
  password: '',
  confirmPassword: '',
};

// Nombre total d'étapes (hors review et success)
export const TOTAL_STEPS = 7;

// Configuration des étapes
export const STEP_CONFIG = [
  { id: 1, title: 'Photo & Prénom', shortTitle: 'Photo' },
  { id: 2, title: 'Date de naissance', shortTitle: 'Naissance' },
  { id: 3, title: 'Contact', shortTitle: 'Contact' },
  { id: 4, title: 'Ville', shortTitle: 'Ville' },
  { id: 5, title: 'Ce que je recherche', shortTitle: 'Objectif' },
  { id: 6, title: 'Bio', shortTitle: 'Bio' },
  { id: 7, title: 'Intérêts & Sécurité', shortTitle: 'Final' },
] as const;

interface SignupContextType {
  // Données du formulaire
  formData: SignupFormData;
  // Navigation entre étapes
  currentStep: number;
  // Actions
  updateFormData: <K extends keyof SignupFormData>(field: K, value: SignupFormData[K]) => void;
  updateMultipleFields: (updates: Partial<SignupFormData>) => void;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  // Validation
  isStepValid: (step: number) => boolean;
  getStepErrors: (step: number) => Record<string, string>;
  // État
  resetForm: () => void;
}

const SignupContext = createContext<SignupContextType | null>(null);

export function SignupProvider({ children }: { children: React.ReactNode }) {
  const [formData, setFormData] = useState<SignupFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState(1);

  // Mettre à jour un champ unique
  const updateFormData = useCallback(<K extends keyof SignupFormData>(
    field: K,
    value: SignupFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Mettre à jour plusieurs champs
  const updateMultipleFields = useCallback((updates: Partial<SignupFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Navigation
  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step);
    }
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Validation par étape
  const isStepValid = useCallback((step: number): boolean => {
    const errors = getStepErrors(step);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const getStepErrors = useCallback((step: number): Record<string, string> => {
    const errors: Record<string, string> = {};

    switch (step) {
      case 1: // Photo + Nom
        if (!formData.firstName.trim()) {
          errors.firstName = 'Le prénom est requis';
        }
        if (!formData.lastName.trim()) {
          errors.lastName = 'Le nom est requis';
        }
        break;

      case 2: // Date de naissance
        if (!formData.birthDate) {
          errors.birthDate = 'La date de naissance est requise';
        } else if (formData.birthDate.length !== 10) {
          errors.birthDate = 'Format invalide (JJ/MM/AAAA)';
        } else {
          const [day, month, year] = formData.birthDate.split('/').map(Number);
          const birthYear = year;
          const currentYear = new Date().getFullYear();
          if (currentYear - birthYear < 18) {
            errors.birthDate = 'Vous devez avoir au moins 18 ans';
          }
          if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) {
            errors.birthDate = 'Date invalide';
          }
        }
        break;

      case 3: // Contact
        if (!formData.email.trim()) {
          errors.email = 'L\'email est requis';
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(formData.email)) {
            errors.email = 'Format d\'email invalide';
          }
        }
        // Téléphone optionnel mais si renseigné, vérifier le format
        if (formData.phone && formData.phone.length > 0) {
          const phoneClean = formData.phone.replace(/[\s\-\.\(\)]/g, '');
          if (phoneClean.length < 10) {
            errors.phone = 'Numéro de téléphone invalide';
          }
        }
        break;

      case 4: // Ville
        if (!formData.city.trim()) {
          errors.city = 'La ville est requise';
        } else if (!formData.citySelected) {
          errors.city = 'Veuillez sélectionner une ville dans la liste de suggestions';
        }
        break;

      case 5: // Intention
        if (!formData.intention) {
          errors.intention = 'Veuillez choisir ce que vous recherchez';
        }
        break;

      case 6: // Bio (optionnel)
        // Bio est optionnelle, pas d'erreur
        break;

      case 7: // Intérêts + Mot de passe
        if (!formData.password) {
          errors.password = 'Le mot de passe est requis';
        } else if (formData.password.length < 6) {
          errors.password = 'Minimum 6 caractères';
        }
        if (!formData.confirmPassword) {
          errors.confirmPassword = 'Confirmez le mot de passe';
        } else if (formData.password !== formData.confirmPassword) {
          errors.confirmPassword = 'Les mots de passe ne correspondent pas';
        }
        break;
    }

    return errors;
  }, [formData]);

  // Réinitialiser le formulaire
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setCurrentStep(1);
  }, []);

  const value: SignupContextType = {
    formData,
    currentStep,
    updateFormData,
    updateMultipleFields,
    goToStep,
    nextStep,
    prevStep,
    isStepValid,
    getStepErrors,
    resetForm,
  };

  return (
    <SignupContext.Provider value={value}>
      {children}
    </SignupContext.Provider>
  );
}

export function useSignup() {
  const context = useContext(SignupContext);
  if (!context) {
    throw new Error('useSignup doit être utilisé dans un SignupProvider');
  }
  return context;
}
