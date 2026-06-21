#!/bin/sh
trap 'kill 0' EXIT
cd backend && node server.js &
cd frontend && npm run dev &
wait
