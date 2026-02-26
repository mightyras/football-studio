import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { TOUR_STEPS } from './tourSteps';

const STORAGE_KEY = 'football-studio-tour-seen';

export type TourContextValue = {
  isOpen: boolean;
  currentStep: number;
  totalSteps: number;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const markSeen = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  const start = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  const next = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsOpen(false);
      markSeen();
    }
  }, [currentStep, markSeen]);

  const back = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skip = useCallback(() => {
    setIsOpen(false);
    markSeen();
  }, [markSeen]);

  const value: TourContextValue = {
    isOpen,
    currentStep,
    totalSteps: TOUR_STEPS.length,
    start,
    next,
    back,
    skip,
  };

  return (
    <TourContext value={value}>
      {children}
    </TourContext>
  );
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

/** Returns true if the user has never completed or skipped the tour. */
export function isTourUnseen(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}
