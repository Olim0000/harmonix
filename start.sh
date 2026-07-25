#!/usr/bin/env bash
# Harmonix development startup script
# Starts both backend and frontend concurrently

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Harmonix development servers...${NC}"

# Ensure .env exists
if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    echo -e "${GREEN}Creating .env from .env.example${NC}"
    cp .env.example .env
    echo -e "${GREEN}Please edit .env and set JWT_SECRET before continuing${NC}"
  else
    echo "Error: .env.example not found" >&2
    exit 1
  fi
fi

# Install dependencies if needed
if [[ ! -d node_modules ]]; then
  echo -e "${GREEN}Installing root dependencies...${NC}"
  npm install
fi

if [[ ! -d backend/node_modules ]]; then
  echo -e "${GREEN}Installing backend dependencies...${NC}"
  npm install --workspace=backend
fi

if [[ ! -d frontend/node_modules ]]; then
  echo -e "${GREEN}Installing frontend dependencies...${NC}"
  npm install --workspace=frontend
fi

# Start both servers
echo -e "${GREEN}Starting backend (port 3001) and frontend (port 5173)...${NC}"
npm run dev