const CACHE_NAME = 'brainbrawler-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/lobby.html', 
  '/game.html',
  '/account-setup.html',
  '/verify-email.html',
  '/create-room.html',
  '/manage-questions.html',
  '/advanced-stats.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install service worker and cache resources
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('❌ Service Worker: Failed to cache resources', error);
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API calls for real-time data
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          console.log('📱 Service Worker: Serving from cache:', event.request.url);
          return response;
        }

        console.log('🌐 Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone response for cache
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
          });
      })
  );
});

// Activate service worker and clean old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activating...');
  
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Background sync triggered');
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('📢 Service Worker: Push notification received');
  
  if (!event.data) {
    return;
  }

  const options = {
    body: event.data.text(),
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: 'Open BrainBrawler',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close notification',
        icon: '/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('BrainBrawler', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Service Worker: Notification clicked');
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/lobby.html')
    );
  }
});

// Background sync function
async function doBackgroundSync() {
  try {
    // Sync any pending game data
    const pendingData = await getStoredPendingData();
    
    if (pendingData.length > 0) {
      console.log('📤 Service Worker: Syncing pending data');
      
      for (const data of pendingData) {
        try {
          await fetch('/api/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          });
          
          // Remove synced data from storage
          await removePendingData(data.id);
        } catch (error) {
          console.error('❌ Service Worker: Failed to sync data:', error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Service Worker: Background sync failed:', error);
  }
}

// Helper functions for offline data management
async function getStoredPendingData() {
  // Implementation would retrieve pending data from IndexedDB
  return [];
}

async function removePendingData(id) {
  // Implementation would remove synced data from IndexedDB
  console.log('🗑️ Service Worker: Removed pending data:', id);
}

// Send message to clients
function sendMessageToClients(message) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage(message);
    });
  });
}

console.log('🚀 Service Worker: Loaded successfully'); 