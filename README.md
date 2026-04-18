
---

# Cafelio

Cafelio is a **MERN stack nearby-cafe finder**.

* The **React client** uses browser geolocation and an interactive OpenStreetMap view.
* The **Express API** queries cafe points via the Overpass API, stores recent searches, and lets you save favorite cafes in MongoDB when `MONGO_URI` is configured.

---

## 🚀 Tech Stack

* **MongoDB + Mongoose** → search history & saved cafes
* **Express + Node.js** → backend API
* **React + Vite** → frontend client
* **Leaflet + OpenStreetMap tiles** → maps
* **Overpass API** → nearby cafe data

---

## ⚙️ Local Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/aarushdevworld/cafelio.git
   cd cafelio
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   * Copy the example file:

     ```bash
     cp .env.example server/.env
     ```
   * Add your MongoDB URI in `server/.env`:

     ```
     MONGO_URI=mongodb://localhost:27017/cafelio
     ```

4. **Run the project**

   ```bash
   npm run dev
   ```

   This starts both client and server.

5. **Access locally**

   * Client: [http://127.0.0.1:5173](http://127.0.0.1:5173)
   * API health: [http://localhost:5000/api/health](http://localhost:5000/api/health)

👉 If MongoDB is not running or `MONGO_URI` is missing, the API still works but favorites/history are stored **in memory only** for the current session.

---

## 📜 Scripts

```bash
npm run dev      # run client and server together
npm run client   # run Vite frontend only
npm run server   # run Express backend only
npm run build    # build the React client for production
```

---

## 🌍 Deployment Guide

### Option 1: Deploy Client (Frontend)

* Build the React app:

  ```bash
  npm run build
  ```
* Deploy the `dist/` folder to **Vercel**, **Netlify**, or any static hosting.

### Option 2: Deploy Server (Backend)

* Host the Express API on **Render**, **Railway**, or **Heroku**.
* Ensure `MONGO_URI` points to a cloud MongoDB (e.g., **MongoDB Atlas**).

### Option 3: Full MERN Deployment

* Use **Docker Compose** to run client + server + MongoDB together.
* Or deploy client on Netlify/Vercel and server on Render/Heroku, connected to MongoDB Atlas.

---

## ✨ Features

* 🔍 Find nearby cafes using geolocation
* 🗺️ Interactive map view with Leaflet + OSM
* ❤️ Save favorite cafes (persistent with MongoDB)
* 📜 View recent search history
* 🌗 Light/Dark mode landing page

---

## 📸 Screenshots

### Landing Page (Light Mode)

[https://github.com/aarushdevworld/cafelio/blob/main/landing-light.png](https://github.com/aarushdevworld/cafelio/blob/main/landing-light.png)

### Landing Page (Dark Mode)

[https://github.com/aarushdevworld/cafelio/blob/main/landing-dark.png](https://github.com/aarushdevworld/cafelio/blob/main/landing-dark.png)

### Cafe Search Results

[https://github.com/aarushdevworld/cafelio/blob/main/1.png](https://github.com/aarushdevworld/cafelio/blob/main/1.png)

### Map View

[https://github.com/aarushdevworld/cafelio/blob/main/2.png](https://github.com/aarushdevworld/cafelio/blob/main/2.png)

### Save Favorites

[https://github.com/aarushdevworld/cafelio/blob/main/3.png](https://github.com/aarushdevworld/cafelio/blob/main/3.png)

### Search History

[https://github.com/aarushdevworld/cafelio/blob/main/4.png](https://github.com/aarushdevworld/cafelio/blob/main/4.png)

### API Health Check

[https://github.com/aarushdevworld/cafelio/blob/main/5.png](https://github.com/aarushdevworld/cafelio/blob/main/5.png)

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a new branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Commit your changes:

   ```bash
   git commit -m "Add your message"
   ```
5. Push to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```
6. Open a Pull Request

---

## 📄 License

This project is open-source and available under the MIT License.
