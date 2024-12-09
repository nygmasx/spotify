import './style.css'

document.querySelector('#app').innerHTML = `
      <div class="max-w-4xl mx-auto p-6">
        <header class="mb-8">
          <h1 class="text-3xl font-bold text-green-500">Spotify Profile</h1>
        </header>

        <!-- Player Section -->
        <div id="playerContainer" class="bg-zinc-900 rounded-lg p-6 mb-6 hidden">
          <iframe
            id="spotifyPlayer"
            src=""
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy">
          </iframe>
        </div>

        <div class="bg-zinc-900 rounded-lg p-6 mb-6">
          <div class="flex items-center gap-6">
            <div id="avatar" class="w-32 h-32 rounded-full overflow-hidden bg-zinc-800"></div>

            <div>
              <h2 class="text-2xl font-bold mb-2">
                Welcome, <span id="displayName" class="text-green-500"></span>
              </h2>

              <div class="space-y-2 text-zinc-400">
                <p class="flex items-center gap-2">
                  <span class="font-medium">ID:</span>
                  <span id="id"></span>
                </p>
                <p class="flex items-center gap-2">
                  <span class="font-medium">Email:</span>
                  <span id="email"></span>
                </p>
                <p class="flex items-center gap-2">
                  <span class="font-medium">URI:</span>
                  <a id="uri" href="#" class="text-green-500 hover:underline"></a>
                </p>
                <p class="flex items-center gap-2">
                  <span class="font-medium">Profile:</span>
                  <a id="url" href="#" class="text-green-500 hover:underline"></a>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Search Section -->
        <div class="bg-zinc-900 rounded-lg p-6 mb-6">
          <h2 class="text-2xl font-bold mb-4">Search Tracks</h2>
          <div class="flex gap-4 mb-6">
            <input type="text" id="searchInput" 
                   class="flex-1 bg-zinc-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                   placeholder="Search for songs...">
            <button id="searchButton" 
                    class="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors">
              Search
            </button>
          </div>
          <div id="searchResults" class="space-y-4"></div>
        </div>

        <div class="bg-zinc-900 rounded-lg p-6">
          <h2 class="text-2xl font-bold mb-4">Followed Artists</h2>
          <div id="artists" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          </div>
        </div>
      </div>
`

const clientId = "6b95a7791cd74718854d9f671fc4c9dd";
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

function logout() {
    localStorage.removeItem("verifier");
    window.location.href = '/';
}

const logoutButton = document.createElement('button');
logoutButton.innerText = 'Logout';
logoutButton.onclick = logout;
logoutButton.className = 'bg-red-500 text-white px-4 py-2 rounded absolute top-6 right-6';
document.getElementById('app').appendChild(logoutButton);

async function init() {
    try {
        if (!code) {
            redirectToAuthCodeFlow(clientId);
        } else {
            const accessToken = await getAccessToken(clientId, code);
            const profile = await fetchProfile(accessToken);
            const artists = await fetchUserArtists(accessToken);
            populateUI(profile, artists);
            setupSearch(accessToken);
            // Clear the URL after successful login
            window.history.replaceState({}, document.title, '/');
        }
    } catch (error) {
        console.error('Auth error:', error);
        localStorage.removeItem("verifier");
        redirectToAuthCodeFlow(clientId);
    }
}

async function redirectToAuthCodeFlow(clientId) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", "http://localhost:5173/callback");
    params.append("scope", "user-read-private user-read-email user-follow-read");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function getAccessToken(clientId, code) {
    const verifier = localStorage.getItem("verifier");

    if (!verifier) {
        throw new Error("No verifier found in localStorage");
    }

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", "http://localhost:5173/callback");
    params.append("code_verifier", verifier);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const { access_token } = await result.json();

    // Clear the verifier after successful token exchange
    localStorage.removeItem("verifier");

    return access_token;
}

async function fetchProfile(token) {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

async function fetchUserArtists(token) {
    const result = await fetch("https://api.spotify.com/v1/me/following?type=artist", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

async function searchTracks(token, query, limit = 20) {
    const params = new URLSearchParams({
        q: query,
        type: 'track',
        limit: limit
    });

    const result = await fetch(`https://api.spotify.com/v1/search?${params}`, {
        method: "GET",
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return await result.json();
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function playTrack(trackId) {
    const playerContainer = document.getElementById('playerContainer');
    const spotifyPlayer = document.getElementById('spotifyPlayer');
    playerContainer.classList.remove('hidden');
    spotifyPlayer.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator`;
}

function setupSearch(token) {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const resultsContainer = document.getElementById('searchResults');

    async function handleSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        try {
            const results = await searchTracks(token, query);
            resultsContainer.innerHTML = '';

            results.tracks.items.forEach(track => {
                const trackElement = document.createElement('div');
                trackElement.className = 'bg-zinc-800 rounded-lg p-4 flex items-center gap-4 cursor-pointer hover:bg-zinc-700 transition-colors';
                trackElement.onclick = () => playTrack(track.id);

                const albumImage = track.album.images[0] ?
                    `<img src="${track.album.images[0].url}" alt="${track.album.name}" class="w-16 h-16 object-cover rounded">` :
                    `<div class="w-16 h-16 bg-zinc-700 flex items-center justify-center rounded">
                        <span class="text-2xl">🎵</span>
                     </div>`;

                trackElement.innerHTML = `
                    ${albumImage}
                    <div class="flex-1">
                        <h3 class="font-bold text-lg">${track.name}</h3>
                        <p class="text-zinc-400">${track.artists.map(artist => artist.name).join(', ')}</p>
                        <p class="text-zinc-500 text-sm">
                            ${track.album.name} • ${formatDuration(track.duration_ms)}
                        </p>
                    </div>
                    <button class="text-green-500 hover:text-green-400 transition-colors p-2 rounded-full hover:bg-zinc-600">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
                        </svg>
                    </button>
                `;

                resultsContainer.appendChild(trackElement);
            });
        } catch (error) {
            console.error('Search error:', error);
            resultsContainer.innerHTML = `
                <div class="text-red-500 p-4">
                    Error searching tracks. Please try again.
                </div>
            `;
        }
    }

    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
}

function populateUI(profile, artistsData) {
    document.getElementById("displayName").innerText = profile.display_name;
    if (profile.images[0]) {
        const profileImage = new Image(200, 200);
        profileImage.src = profile.images[0].url;
        document.getElementById("avatar").appendChild(profileImage);
    }
    document.getElementById("id").innerText = profile.id;
    document.getElementById("email").innerText = profile.email;
    document.getElementById("uri").innerText = profile.uri;
    document.getElementById("uri").setAttribute("href", profile.external_urls.spotify);
    document.getElementById("url").innerText = profile.href;
    document.getElementById("url").setAttribute("href", profile.href);

    const artistsContainer = document.getElementById("artists");
    artistsData.artists.items.forEach(artist => {
        const artistCard = document.createElement('div');
        artistCard.className = 'bg-zinc-800 rounded-lg p-4 flex items-center gap-4';

        const artistImage = artist.images[0] ?
            `<img src="${artist.images[0].url}" alt="${artist.name}" class="w-16 h-16 rounded-full object-cover">` :
            `<div class="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center">
                <span class="text-2xl">🎵</span>
             </div>`;

        artistCard.innerHTML = `
            ${artistImage}
            <div>
                <h3 class="font-bold text-lg">${artist.name}</h3>
                <p class="text-zinc-400">${artist.followers.total.toLocaleString()} followers</p>
                <a href="${artist.external_urls.spotify}" target="_blank" 
                   class="text-green-500 hover:underline text-sm">View on Spotify</a>
            </div>
        `;

        artistsContainer.appendChild(artistCard);
    });
}

// Start the app
init();