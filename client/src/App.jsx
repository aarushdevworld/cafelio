import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const apiHost = window.location.hostname || 'localhost'
const BASE_URL = import.meta.env.VITE_API_URL || `http://${apiHost}:5000`
const API_URL = `${BASE_URL}/api`
const API_HEALTH_URL = `${API_URL.replace(/\/api$/, '')}/api/health`
const AUTH_STORAGE_KEY = 'cafelio-auth'
const THEME_STORAGE_KEY = 'cafelio-theme'
const GUEST_STORAGE_KEY = 'cafelio-guest-id'

const sampleCenter = {
  lat: 30.733442,
  lng: 76.779714,
  label: 'Chandigarh, India'
}

const defaultCity = {
  id: 'default-chandigarh',
  title: 'Chandigarh',
  subtitle: 'India',
  label: sampleCenter.label,
  lat: sampleCenter.lat,
  lng: sampleCenter.lng,
  type: 'city'
}

const cafeImages = [
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=560&q=80',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=560&q=80',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=560&q=80',
  'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=560&q=80',
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=560&q=80'
]

const getGuestId = () => {
  let guestId = localStorage.getItem(GUEST_STORAGE_KEY)

  if (!guestId) {
    guestId = `guest-${crypto.randomUUID()}`
    localStorage.setItem(GUEST_STORAGE_KEY, guestId)
  }

  return guestId
}

const storedAuth = () => {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)) || { token: '', user: null }
  } catch {
    return { token: '', user: null }
  }
}

const photoForCafe = (cafe, offset = 0) => {
  const source = cafe?.id || cafe?.cafeId || cafe?.name || 'cafe'
  const total = [...source].reduce((sum, letter) => sum + letter.charCodeAt(0), offset)
  return cafeImages[total % cafeImages.length]
}

const distanceLabel = (meters) => {
  if (meters === null || meters === undefined) return 'Distance unknown'
  if (meters < 1000) return `${meters} m`
  return `${(meters / 1000).toFixed(1)} km`
}

const mapsUrl = (cafe) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cafe.lat},${cafe.lng}`)}`

const googleEmbedUrl = (place) => {
  const query = place?.name
    ? `${place.name} ${place.lat},${place.lng}`
    : `${place.label || 'Cafe area'} ${place.lat},${place.lng}`

  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`
}

function App() {
  const initialAuth = storedAuth()
  const [guestId] = useState(getGuestId)
  const [center, setCenter] = useState(sampleCenter)
  const [radius, setRadius] = useState(1500)
  const [cafes, setCafes] = useState([])
  const [favorites, setFavorites] = useState([])
  const [history, setHistory] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [manualLat, setManualLat] = useState(sampleCenter.lat)
  const [manualLng, setManualLng] = useState(sampleCenter.lng)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('Ready near Chandigarh.')
  const [navOpen, setNavOpen] = useState(false)
  const [cityQuery, setCityQuery] = useState(sampleCenter.label)
  const [citySuggestions, setCitySuggestions] = useState([])
  const [cityLoading, setCityLoading] = useState(false)
  const [cityMenuOpen, setCityMenuOpen] = useState(false)
  const [selectedCity, setSelectedCity] = useState(defaultCity)
  const [token, setToken] = useState(initialAuth.token || '')
  const [user, setUser] = useState(initialAuth.user || null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authMessage, setAuthMessage] = useState('')
  const [darkMode, setDarkMode] = useState(localStorage.getItem(THEME_STORAGE_KEY) === 'dark')
  const [modalCafe, setModalCafe] = useState(null)
  const [reviewDraft, setReviewDraft] = useState({ rating: 0, review: '' })
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [pendingCafe, setPendingCafe] = useState(null)

  const selectedCafe = useMemo(
    () => cafes.find((cafe) => cafe.id === selectedId) || cafes[0],
    [cafes, selectedId],
  )

  const favoriteIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.cafeId)),
    [favorites],
  )

  const requestHeaders = useCallback((extra = {}, overrideToken = token) => ({
    ...extra,
    'X-Guest-Id': guestId,
    ...(overrideToken ? { Authorization: `Bearer ${overrideToken}` } : {})
  }), [guestId, token])

  const favoriteForCafe = (cafe) =>
    favorites.find((favorite) => favorite.cafeId === (cafe?.id || cafe?.cafeId))

  const upsertFavorite = (favorite) => {
    setFavorites((current) => {
      const exists = current.some((item) => item.cafeId === favorite.cafeId)
      if (exists) {
        return current.map((item) => (item.cafeId === favorite.cafeId ? favorite : item))
      }
      return [favorite, ...current]
    })
  }

  const openGoogleMaps = (cafe) => {
    window.location.href = mapsUrl(cafe)
  }

  const promptAuth = (cafe = null) => {
    setPendingCafe(cafe)
    setAuthModalOpen(true)
    setAuthMessage('Login or create an account to save cafes.')
  }

  const loadFavorites = useCallback(async (overrideToken = token) => {
    if (!overrideToken) {
      setFavorites([])
      return
    }

    const response = await fetch(`${API_URL}/cafes/favorites`, {
      headers: requestHeaders({}, overrideToken)
    })
    const payload = await response.json()
    setFavorites(payload.favorites || [])
  }, [requestHeaders, token])

  const loadHistory = async () => {
    const response = await fetch(`${API_URL}/cafes/history`)
    const payload = await response.json()
    setHistory(payload.searches || [])
  }

  const searchNearby = async (nextCenter = center) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        lat: nextCenter.lat,
        lng: nextCenter.lng,
        radius
      })
      const response = await fetch(`${API_URL}/cafes/nearby?${params}`)
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Cafe search failed.')
      }

      setCenter({ ...nextCenter, label: nextCenter.label || 'Selected point' })
      setManualLat(Number(nextCenter.lat.toFixed(6)))
      setManualLng(Number(nextCenter.lng.toFixed(6)))
      setCafes(payload.cafes || [])
      setSelectedId(payload.cafes?.[0]?.id || '')
      setNotice(
        payload.cafes?.length
          ? `${payload.cafes.length} cafes found within ${distanceLabel(payload.radius)}.`
          : 'No cafes found here. Try a wider radius.'
      )
      loadHistory()
    } catch (searchError) {
      setError(searchError.message)
      setNotice('Search paused.')
    } finally {
      setLoading(false)
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.')
      return
    }

    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: 'Your location'
        }
        setLocating(false)
        searchNearby(nextCenter)
      },
      () => {
        setLocating(false)
        setError('Location permission was not granted.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const searchManualPoint = () => {
    const lat = Number(manualLat)
    const lng = Number(manualLng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError('Enter valid latitude and longitude values.')
      return
    }

    searchNearby({ lat, lng, label: 'Selected point' })
  }

  const selectCity = (city) => {
    setSelectedCity(city)
    setCityQuery(city.label)
    setCitySuggestions([])
    setCityMenuOpen(false)
    searchNearby({ lat: city.lat, lng: city.lng, label: city.label })
  }

  const searchCity = async () => {
    if (selectedCity) {
      selectCity(selectedCity)
      return
    }

    const query = cityQuery.trim()

    if (query.length < 2) {
      setError('Type a city name to search.')
      return
    }

    setCityLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/places/suggest?q=${encodeURIComponent(query)}&limit=1`)
      const payload = await response.json()
      const city = payload.suggestions?.[0]

      if (!response.ok || !city) {
        throw new Error(payload.message || 'No city found for that search.')
      }

      selectCity(city)
    } catch (searchError) {
      setError(searchError.message)
    } finally {
      setCityLoading(false)
    }
  }

  const toggleFavorite = async (cafe) => {
    const cafeId = cafe.id || cafe.cafeId
    const saved = favoriteIds.has(cafeId)

    if (!user && !saved) {
      promptAuth(cafe)
      return
    }

    if (saved) {
      await fetch(`${API_URL}/cafes/favorites/${cafeId}`, {
        method: 'DELETE',
        headers: requestHeaders()
      })
      setFavorites((current) => current.filter((favorite) => favorite.cafeId !== cafeId))
      return
    }

    await saveCafe(cafe)
  }

  const saveCafe = async (cafe, extra = {}, overrideToken = token) => {
    if (!overrideToken && !user) {
      promptAuth(cafe)
      throw new Error('Login or create an account to save cafes.')
    }

    const response = await fetch(`${API_URL}/cafes/favorites`, {
      method: 'POST',
      headers: requestHeaders({ 'Content-Type': 'application/json' }, overrideToken),
      body: JSON.stringify({ ...cafe, ...extra })
    })
    const payload = await response.json()

    if (!response.ok) {
      throw new Error(payload.message || 'Could not save this cafe.')
    }

    upsertFavorite(payload.favorite)
    return payload.favorite
  }

  const openCafeDetails = (cafe) => {
    const favorite = favoriteForCafe(cafe)
    setSelectedId(cafe.id)
    setModalCafe(cafe)
    setReviewDraft({
      rating: favorite?.rating || 0,
      review: favorite?.review || ''
    })
  }

  const submitReview = async (event) => {
    event.preventDefault()

    if (!modalCafe) return
    if (!user) {
      promptAuth(modalCafe)
      return
    }

    try {
      const favorite = favoriteForCafe(modalCafe)
      let payload

      if (!favorite) {
        payload = { favorite: await saveCafe(modalCafe, reviewDraft) }
      } else {
        const response = await fetch(`${API_URL}/cafes/favorites/${modalCafe.id}/review`, {
          method: 'PATCH',
          headers: requestHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(reviewDraft)
        })
        payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.message || 'Could not save your review.')
        }

        upsertFavorite(payload.favorite)
      }

      setAuthMessage(`Saved your note for ${payload.favorite.name}.`)
    } catch (reviewError) {
      setAuthMessage(reviewError.message)
    }
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthMessage('')

    try {
      const response = await fetch(`${API_URL}/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Authentication failed.')
      }

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
      setToken(payload.token)
      setUser(payload.user)
      setAuthForm({ name: '', email: '', password: '' })
      setAuthMessage(`Signed in as ${payload.user.name}.`)
      await loadFavorites(payload.token)
      if (pendingCafe) {
        await saveCafe(pendingCafe, {}, payload.token)
        setPendingCafe(null)
      }
      setAuthModalOpen(false)
    } catch (authError) {
      setAuthMessage(authError.message)
    }
  }

  const logout = async () => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setToken('')
    setUser(null)
    setFavorites([])
    setAuthMessage('Signed out. Login again to save cafes.')
  }

  const closeNav = () => setNavOpen(false)

  const updateCityQuery = (value) => {
    setCityQuery(value)
    setSelectedCity(null)
    setCityMenuOpen(value.trim().length >= 2)

    if (value.trim().length < 2) {
      setCitySuggestions([])
    }
  }
  useEffect(() => {
  if (!center) return;

  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  // prevent duplicate maps
  if (mapContainer._leaflet_id) {
    mapContainer._leaflet_id = null;
  }

  const map = L.map("map").setView([center.lat, center.lng], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // center marker
  L.marker([center.lat, center.lng])
    .addTo(map)
    .bindPopup(center.label || "Selected location");

  // cafes
  cafes.forEach((cafe) => {
    if (cafe.lat && cafe.lng) {
      L.marker([cafe.lat, cafe.lng])
        .addTo(map)
        .bindPopup(`<b>${cafe.name}</b>`);
    }
  });

  return () => {
    map.remove();
  };
}, [center, cafes]);
  useEffect(() => {
    let ignore = false

    const hydrate = async () => {
      try {
        const [favoritesPayload, historyResponse] = await Promise.all([
          token ? fetch(`${API_URL}/cafes/favorites`, { headers: requestHeaders() }).then((response) => response.json()) : { favorites: [] },
          fetch(`${API_URL}/cafes/history`)
        ])
        const historyPayload = await historyResponse.json()

        if (!ignore) {
          setFavorites(favoritesPayload.favorites || [])
          setHistory(historyPayload.searches || [])
        }
      } catch {
        if (!ignore) {
          setFavorites([])
          setHistory([])
        }
      }
    }

    hydrate()

    return () => {
      ignore = true
    }
  }, [requestHeaders, token])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const query = cityQuery.trim()

    if (query.length < 2 || selectedCity?.label === query) {
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setCityLoading(true)

      try {
        const response = await fetch(
          `${API_URL}/places/suggest?q=${encodeURIComponent(query)}&limit=6`,
          { signal: controller.signal }
        )
        const payload = await response.json()

        if (!controller.signal.aborted) {
          setCitySuggestions(payload.suggestions || [])
          setCityMenuOpen(true)
        }
      } catch (suggestionError) {
        if (suggestionError.name !== 'AbortError') {
          setCitySuggestions([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setCityLoading(false)
        }
      }
    }, 320)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [cityQuery, selectedCity])

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#locator" aria-label="Cafelio home" onClick={closeNav}>
          <span className="brand-mark">C</span>
          <span>Cafelio</span>
        </a>

        <button
          className={`menu-toggle ${navOpen ? 'open' : ''}`}
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
          aria-controls="primary-nav"
          onClick={() => setNavOpen((current) => !current)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <nav id="primary-nav" className={navOpen ? 'open' : ''} aria-label="Primary">
          <a href="#results" onClick={closeNav}>Results</a>
          <a href="#saved" onClick={closeNav}>Saved</a>
          <a href="#about" onClick={closeNav}>About</a>
          <a href="#contact" onClick={closeNav}>Contact</a>
        </nav>
     <button
  className="theme-toggle"
  onClick={() => setDarkMode(v => !v)}
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 32 32"
    className="theme-toggle__classic"
  >
    <defs>
      <clipPath id="theme-toggle__classic__cutout">
        <path d="M0-5h30a1 1 0 0 0 9 13v24H0Z" />
      </clipPath>
    </defs>

    <g clipPath="url(#theme-toggle__classic__cutout)">
      <circle cx="16" cy="16" r="9.34" />

      <g stroke="currentColor" strokeWidth="1.5">
        <path d="M16 5.5v-4" />
        <path d="M16 30.5v-4" />
        <path d="M1.5 16h4" />
        <path d="M26.5 16h4" />
        <path d="m23.4 8.6 2.8-2.8" />
        <path d="m5.7 26.3 2.9-2.9" />
        <path d="m5.8 5.8 2.8 2.8" />
        <path d="m23.4 23.4 2.9 2.9" />
      </g>
    </g>
  </svg>
</button>
      </header>

      <section className="auth-section" id="account">
        <div>
          <p className="eyebrow">Your cafe shelf</p>
          <h2>{user ? `Welcome, ${user.name}` : 'Sign in to keep your cafes.'}</h2>
          <p className="lead">
            Saved cafes, ratings, and reviews stay separate for each account.
          </p>
        </div>

        {user ? (
          <div className="account-card">
            <p>{user.email}</p>
            <button type="button" onClick={logout}>Sign out</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={authMode === 'signup' ? 'active' : ''}
                onClick={() => setAuthMode('signup')}
              >
                Signup
              </button>
            </div>
            {authMode === 'signup' && (
              <label>
                Name
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm((form) => ({ ...form, name: event.target.value }))}
                  placeholder="Your name"
                />
              </label>
            )}
            <label>
              Email
              <input
                value={authForm.email}
                onChange={(event) => setAuthForm((form) => ({ ...form, email: event.target.value }))}
                placeholder="you@example.com"
                type="email"
              />
            </label>
            <label>
              Password
              <input
                value={authForm.password}
                onChange={(event) => setAuthForm((form) => ({ ...form, password: event.target.value }))}
                placeholder="At least 6 characters"
                type="password"
              />
            </label>
            <button className="primary" type="submit">
              {authMode === 'signup' ? 'Create account' : 'Login'}
            </button>
          </form>
        )}
        {authMessage && <p className="auth-message">{authMessage}</p>}
      </section>

      <section className="locator" id="locator">
        <div className="control-panel">
          <p className="eyebrow">Nearby cafe finder</p>
          <h1>Find a cafe close to where you are.</h1>
          <p className="lead">
            Search with your current location, tune the walking radius, and open the cafe in maps.
          </p>

          <div className="city-search">
            <label htmlFor="city-search">
              Search city
              <span className="search-box">
                <input
                  id="city-search"
                  value={cityQuery}
                  onChange={(event) => updateCityQuery(event.target.value)}
                  onFocus={() => setCityMenuOpen(cityQuery.trim().length >= 2)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      searchCity()
                    }
                    if (event.key === 'Escape') {
                      setCityMenuOpen(false)
                    }
                  }}
                  placeholder="Type Chandigarh, Delhi, Mumbai..."
                  autoComplete="off"
                />
                <button type="button" onClick={searchCity} disabled={cityLoading || loading}>
                  {cityLoading ? 'Searching' : 'Search'}
                </button>
              </span>
            </label>

            {cityMenuOpen && (
              <div className="suggestions" role="listbox" aria-label="City suggestions">
                {cityLoading && <p>Finding cities...</p>}
                {!cityLoading && citySuggestions.length === 0 && (
                  <p>No city suggestions yet.</p>
                )}
                {citySuggestions.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    role="option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCity(city)}
                  >
                    <strong>{city.title}</strong>
                    <span>{city.subtitle || city.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="actions">
            <button className="primary" onClick={useMyLocation} disabled={locating || loading}>
              {locating ? 'Getting location...' : 'Use my location'}
            </button>
            <button onClick={() => searchNearby(sampleCenter)} disabled={loading}>
              Try Chandigarh
            </button>
          </div>

          <label className="range-label" htmlFor="radius">
            Radius <strong>{distanceLabel(radius)}</strong>
          </label>
          <input
            id="radius"
            className="radius"
            min="250"
            max="5000"
            step="250"
            type="range"
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
          />

          <div className="manual-grid">
            <label>
              Latitude
              <input
                value={manualLat}
                onChange={(event) => setManualLat(event.target.value)}
                inputMode="decimal"
              />
            </label>
            <label>
              Longitude
              <input
                value={manualLng}
                onChange={(event) => setManualLng(event.target.value)}
                inputMode="decimal"
              />
            </label>
          </div>

          <button className="wide" onClick={searchManualPoint} disabled={loading}>
            Search this point
          </button>

          <div className="status" role="status">
            {loading ? 'Looking for nearby cafes...' : notice}
          </div>
          {error && <p className="error">{error}</p>}

          <div className="image-carousel" aria-label="Cafe moments">
            <div className="carousel-track">
              {[...cafeImages, ...cafeImages].map((image, index) => (
                <img
                  key={`${image}-${index}`}
                  src={image}
                  alt={`Cafe moment ${(index % cafeImages.length) + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="map-area" style={{ height: "400px" }}>
  <div id="map" style={{ height: "100%", width: "100%", borderRadius: "12px" }}></div>

  <div className="map-overlay">
    <p className="eyebrow">OpenStreetMap</p>
    <h2>{selectedCafe?.name || center.label}</h2>
    <button
      className="primary"
      onClick={() =>
        window.open(
          `https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}`,
          "_blank"
        )
      }
    >
      Open in Maps
    </button>
  </div>
</div>
      </section>

      <section className="results-section" id="results">
        <div className="section-heading">
          <p className="eyebrow">Closest matches</p>
          <h2>{cafes.length ? `${cafes.length} cafes nearby` : 'Start with a location'}</h2>
        </div>

        <div className="results-grid">
          <div className="result-list">
            {loading && Array.from({ length: 4 }).map((_, index) => (
              <article className="skeleton-card" key={`skeleton-${index}`}>
                <span></span>
                <strong></strong>
                <p></p>
              </article>
            ))}

            {!loading && cafes.length === 0 && (
              <article className="empty-state">
                <h3>No cafes loaded yet</h3>
                <p>Use your location or search a point to fill this list.</p>
              </article>
            )}

            {!loading && cafes.map((cafe) => (
              <article
                className={`cafe-card ${selectedCafe?.id === cafe.id ? 'active' : ''}`}
                key={cafe.id}
                onClick={() => openCafeDetails(cafe)}
              >
                <div>
                  <p className="distance">{distanceLabel(cafe.distance)}</p>
                  <h3>{cafe.name}</h3>
                  <p>{cafe.address || 'Address not listed in map data.'}</p>
                  {favoriteForCafe(cafe)?.rating > 0 && (
                    <p className="rating-line">{favoriteForCafe(cafe).rating}/5 saved rating</p>
                  )}
                </div>
                <div className="card-actions">
                  <button onClick={(event) => {
                    event.stopPropagation()
                    toggleFavorite(cafe)
                  }}>
                    {favoriteIds.has(cafe.id) ? 'Saved' : 'Save'}
                  </button>
                  <button type="button" onClick={(event) => {
                    event.stopPropagation()
                    openGoogleMaps(cafe)
                  }}>
                    Google Maps
                  </button>
                  <button type="button" onClick={(event) => {
                    event.stopPropagation()
                    openCafeDetails(cafe)
                  }}>
                    Details
                  </button>
                </div>
              </article>
            ))}
          </div>

          <aside className="detail-panel">
            {selectedCafe ? (
              <>
                <p className="eyebrow">Selected cafe</p>
                <h2>{selectedCafe.name}</h2>
                <dl>
                  <div>
                    <dt>Distance</dt>
                    <dd>{distanceLabel(selectedCafe.distance)}</dd>
                  </div>
                  <div>
                    <dt>Address</dt>
                    <dd>{selectedCafe.address || 'Not listed'}</dd>
                  </div>
                  <div>
                    <dt>Hours</dt>
                    <dd>{selectedCafe.openingHours || 'Not listed'}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{selectedCafe.phone || 'Not listed'}</dd>
                  </div>
                </dl>
                <div className="actions">
                  <button onClick={() => toggleFavorite(selectedCafe)}>
                    {favoriteIds.has(selectedCafe.id) ? 'Remove saved' : 'Save cafe'}
                  </button>
                  <button type="button" onClick={() => openGoogleMaps(selectedCafe)}>
                    Open in Google Maps
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">Selected cafe</p>
                <h2>Pick a result</h2>
                <p>Details will appear here after the first search.</p>
              </>
            )}
          </aside>
        </div>
      </section>

      <section className="saved-section" id="saved">
        <div className="section-heading">
          <p className="eyebrow">Saved spots</p>
          <h2>{favorites.length ? `${favorites.length} cafes saved` : 'No saved cafes yet'}</h2>
        </div>

        <div className="saved-grid">
          {favorites.map((favorite) => (
              <article className="saved-card" key={favorite.cafeId}>
                <h3>{favorite.name}</h3>
                <p>{favorite.address || `${favorite.lat.toFixed(4)}, ${favorite.lng.toFixed(4)}`}</p>
                {favorite.rating > 0 && <p className="rating-line">{favorite.rating}/5 rating</p>}
                {favorite.review && <p>{favorite.review}</p>}
                <div className="card-actions">
                  <button type="button" onClick={() => openGoogleMaps({ ...favorite, id: favorite.cafeId })}>
                    Open in Google Maps
                  </button>
                  <button type="button" onClick={() => toggleFavorite({ ...favorite, id: favorite.cafeId })}>
                    Remove saved cafe
                  </button>
                </div>
            </article>
          ))}
        </div>

        <div className="history">
          <h2>Recent searches</h2>
          <div className="history-list">
            {history.map((item) => (
              <button
                key={item._id || item.createdAt}
                onClick={() => searchNearby({ lat: item.lat, lng: item.lng, label: 'Recent search' })}
              >
                {item.resultCount} cafes near {Number(item.lat).toFixed(3)}, {Number(item.lng).toFixed(3)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="info-section" id="about">
        <div className="section-heading">
          <p className="eyebrow">How it works</p>
          <h2>Fresh cafe picks without extra setup.</h2>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <span>01</span>
            <h3>Choose a location</h3>
            <p>Use your device location or enter coordinates for any part of the city.</p>
          </article>
          <article className="feature-card">
            <span>02</span>
            <h3>Scan nearby cafes</h3>
            <p>Results come from public cafe map data and are sorted by distance.</p>
          </article>
          <article className="feature-card">
            <span>03</span>
            <h3>Save the good ones</h3>
            <p>Keep favorite cafes and recent searches in MongoDB when the database is connected.</p>
          </article>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div>
          <p className="eyebrow">Cafe run ready</p>
          <h2>Pick a place, open maps, and go.</h2>
          <p className="lead">
            Cafelio keeps the flow simple for quick meetups, study sessions, and coffee breaks.
          </p>
        </div>

        <div className="contact-actions">
          <a className="button-link primary-link" href="#locator">
            Search cafes
          </a>
          <a className="button-link" href="mailto:hello@cafelio.local">
            Contact
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <a className="brand" href="#locator" aria-label="Cafelio home">
            <span className="brand-mark">C</span>
            <span>Cafelio</span>
          </a>
          <p>Nearby cafes, saved spots, and quick directions in one place.</p>
        </div>

        <div className="footer-links" aria-label="Footer">
          <div>
            <h3>Explore</h3>
            <a href="#locator">Locator</a>
            <a href="#results">Results</a>
            <a href="#saved">Saved cafes</a>
          </div>
          <div>
            <h3>Project</h3>
            <a href="#about">How it works</a>
            <a href={API_HEALTH_URL} target="_blank" rel="noreferrer">
              API status
            </a>
            <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">
              Google Maps
            </a>
          </div>
          <div>
            <h3>Stack</h3>
            <p>MongoDB</p>
            <p>Express</p>
            <p>React</p>
            <p>Node</p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Cafelio. All rights reserved.</p>
        </div>
      </footer>

      {authModalOpen && !user && (
        <div className="modal-backdrop auth-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <article className="auth-modal">
            <button className="modal-close" type="button" onClick={() => setAuthModalOpen(false)}>
              Close
            </button>
            <p className="eyebrow">Account required</p>
            <h2 id="auth-modal-title">Login to save cafes.</h2>
            <p className="lead">Your saved cafes, ratings, and reviews stay attached to your account.</p>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  className={authMode === 'login' ? 'active' : ''}
                  onClick={() => setAuthMode('login')}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={authMode === 'signup' ? 'active' : ''}
                  onClick={() => setAuthMode('signup')}
                >
                  Signup
                </button>
              </div>
              {authMode === 'signup' && (
                <label>
                  Name
                  <input
                    value={authForm.name}
                    onChange={(event) => setAuthForm((form) => ({ ...form, name: event.target.value }))}
                    placeholder="Your name"
                  />
                </label>
              )}
              <label>
                Email
                <input
                  value={authForm.email}
                  onChange={(event) => setAuthForm((form) => ({ ...form, email: event.target.value }))}
                  placeholder="you@example.com"
                  type="email"
                />
              </label>
              <label>
                Password
                <input
                  value={authForm.password}
                  onChange={(event) => setAuthForm((form) => ({ ...form, password: event.target.value }))}
                  placeholder="At least 6 characters"
                  type="password"
                />
              </label>
              <button className="primary" type="submit">
                {authMode === 'signup' ? 'Create account and save' : 'Login and save'}
              </button>
            </form>
            {authMessage && <p className="auth-message">{authMessage}</p>}
          </article>
        </div>
      )}

      {modalCafe && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cafe-modal-title">
          <article className="cafe-modal">
            <button className="modal-close" type="button" onClick={() => setModalCafe(null)}>
              Close
            </button>
            <div className="modal-photos">
              {[0, 11, 29].map((offset) => (
                <img key={offset} src={photoForCafe(modalCafe, offset)} alt={`${modalCafe.name} cafe view`} />
              ))}
            </div>
            <div className="modal-content">
              <p className="eyebrow">Cafe details</p>
              <h2 id="cafe-modal-title">{modalCafe.name}</h2>
              <p>{modalCafe.address || 'Address not listed in map data.'}</p>
              <dl>
                <div>
                  <dt>Distance</dt>
                  <dd>{distanceLabel(modalCafe.distance)}</dd>
                </div>
                <div>
                  <dt>Hours</dt>
                  <dd>{modalCafe.openingHours || 'Not listed'}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{modalCafe.phone || 'Not listed'}</dd>
                </div>
                <div>
                  <dt>Website</dt>
                  <dd>
                    {modalCafe.website ? (
                      <a href={modalCafe.website} target="_blank" rel="noreferrer">Visit website</a>
                    ) : (
                      'Not listed'
                    )}
                  </dd>
                </div>
              </dl>

              <form className="review-form" onSubmit={submitReview}>
                <label>
                  Rating
                  <select
                    value={reviewDraft.rating}
                    onChange={(event) => setReviewDraft((draft) => ({ ...draft, rating: Number(event.target.value) }))}
                  >
                    <option value="0">No rating</option>
                    <option value="1">1 star</option>
                    <option value="2">2 stars</option>
                    <option value="3">3 stars</option>
                    <option value="4">4 stars</option>
                    <option value="5">5 stars</option>
                  </select>
                </label>
                <label>
                  Review
                  <textarea
                    value={reviewDraft.review}
                    onChange={(event) => setReviewDraft((draft) => ({ ...draft, review: event.target.value }))}
                    placeholder="What should you remember about this cafe?"
                    rows="4"
                  ></textarea>
                </label>
                <div className="actions">
                  <button className="primary" type="submit">Save review</button>
                  <button type="button" onClick={() => toggleFavorite(modalCafe)}>
                    {favoriteIds.has(modalCafe.id) ? 'Remove saved' : 'Save cafe'}
                  </button>
                  <button type="button" onClick={() => openGoogleMaps(modalCafe)}>
                    Open in Google Maps
                  </button>
                </div>
              </form>
            </div>
          </article>
        </div>
      )}
    </main>
  )
}

export default App
