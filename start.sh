#!/bin/bash
cd "$(dirname "$0")"
git pull
npm install
pm2 restart macaco || (pm2 start src/index.js --name macaco --log-date-format "DD/MM/YYYY HH:mm:ss" && pm2 save)
