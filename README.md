# Cafelio

Cafelio is a MERN nearby-cafe finder. The React client uses browser geolocation and an interactive OpenStreetMap view. The Express API searches cafe points through OpenStreetMap Overpass, stores recent searches, and lets you save favorite cafes in MongoDB when `MONGO_URI` is configured.

## Stack

- MongoDB + Mongoose for search history and saved cafes
- Express + Node for the API
- React + Vite for the client
- Leaflet + OpenStreetMap tiles for maps
- Overpass API for nearby cafe data

## Setup

```bash
npm install
copy .env.example server\.env
npm run dev
```

Then open:

- Client: `http://127.0.0.1:5173`
- API health: `http://localhost:5000/api/health`

If MongoDB is not running or `MONGO_URI` is missing, the API still searches cafes and keeps favorites/history in memory for the current server session.

## Scripts

```bash
npm run dev      # run client and server
npm run client   # run Vite only
npm run server   # run Express only
npm run build    # build the React client
```
