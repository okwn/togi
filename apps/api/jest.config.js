module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@togi)/)',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@togi/([^/]+)$': '<rootDir>/../../packages/$1/src/index.ts',
    '^@togi/([^/]+)/([^/]+)$': '<rootDir>/../../packages/$1/src/$2.ts',
    '^@togi/([^/]+)/([^/]+)/([^/]+)$': '<rootDir>/../../packages/$1/src/$2/$3.ts',
  },
};