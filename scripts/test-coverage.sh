#!/bin/bash
set -e

echo "Running test coverage..."
npx vitest run --coverage

echo ""
echo "Coverage thresholds check:"
echo "  Statements: 80%"
echo "  Branches: 80%"
echo "  Functions: 70%"
echo "  Lines: 60%"