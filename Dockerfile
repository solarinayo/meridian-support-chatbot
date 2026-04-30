FROM node:22-alpine
WORKDIR /app
COPY backend ./backend
COPY frontend/package.json frontend/package-lock.json* ./frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME=0.0.0.0
EXPOSE 7860
CMD ["npm", "run", "start", "--", "-p", "7860"]
