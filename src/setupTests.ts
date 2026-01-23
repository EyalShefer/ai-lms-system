import '@testing-library/jest-dom';

// Mock Firebase - מונע שגיאות בזמן הרצת טסטים
jest.mock('firebase/app');
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(),
}));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

// Suppress console errors in tests (optional - keeps test output clean)
global.console = {
  ...console,
  error: jest.fn(), // מסתיר שגיאות בזמן טסטים
  warn: jest.fn(),
};

// Setup test environment
beforeAll(() => {
  // Any global setup before all tests
});

afterAll(() => {
  // Cleanup after all tests
});
