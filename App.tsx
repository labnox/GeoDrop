import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Message, Coordinates } from './types';
import { AppState } from './types';
import { MessagePlacer } from './components/MessagePlacer';
import { MessageFinder } from './components/MessageFinder';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  CompassIcon,
  MapPinIcon,
  PlusCircleIcon,
  SearchIcon,
  AlertTriangle,
  Ear,
  Sparkles,
  Globe,
  Smartphone,
  Navigation,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { getLang, setStoredLang, getTranslations, Language } from './lib/i18n';
import type { TranslationKey } from './lib/i18n';
import { unlockAudio, triggerHaptic } from './lib/audio';
import { DEFAULT_DEMO_COORDINATES, PRESET_CITIES, createSampleLandmarks } from './lib/landmarks';

export const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(getLang());
  const t = useMemo(() => getTranslations(lang), [lang]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.Finding);
  const [locationWatcher, setLocationWatcher] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState<boolean>(false);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(new Set());
  const [showLocationMenu, setShowLocationMenu] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Global touch unlock for Android Web Audio policy
  useEffect(() => {
    const handleFirstTouch = () => {
      unlockAudio();
    };
    window.addEventListener('click', handleFirstTouch, { once: true });
    window.addEventListener('touchstart', handleFirstTouch, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstTouch);
      window.removeEventListener('touchstart', handleFirstTouch);
    };
  }, []);

  // Initialize User Identity & Cached Storage
  useEffect(() => {
    let currentUserId = localStorage.getItem('geodrop-userId');
    if (!currentUserId) {
      currentUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('geodrop-userId', currentUserId);
    }
    setUserId(currentUserId);

    const storedHiddenIds = localStorage.getItem('geodrop-hidden-ids');
    if (storedHiddenIds) {
      try {
        setHiddenMessageIds(new Set(JSON.parse(storedHiddenIds)));
      } catch {
        // Ignore JSON error
      }
    }

    const storedMessages = localStorage.getItem('geodrop-messages');
    if (storedMessages) {
      try {
        const parsed = JSON.parse(storedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch {
        // Ignore
      }
    }

    // Try last known location as immediate placeholder while GPS locks
    const lastLoc = localStorage.getItem('geodrop-last-location');
    if (lastLoc) {
      try {
        setUserLocation(JSON.parse(lastLoc));
      } catch {
        // Ignore
      }
    }
  }, []);

  // Seed sample landmarks if none exist
  const seedDefaultLandmarks = useCallback(
    async (coords: Coordinates, uid: string) => {
      const samples = await createSampleLandmarks(coords, uid);
      setMessages((prev) => {
        if (prev.length > 0) return prev;
        localStorage.setItem('geodrop-messages', JSON.stringify(samples));
        return samples;
      });
    },
    []
  );

  // Watch position with Android-friendly fallback
  const startWatchingLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device/browser.');
      return;
    }

    // Attempt high accuracy first
    const watcherId = navigator.geolocation.watchPosition(
      (position) => {
        const coords: Coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        setIsDemoMode(false);
        setError(null);
        setIsPermissionError(false);
        localStorage.setItem('geodrop-last-location', JSON.stringify(coords));

        // Auto-seed if empty
        const uid = localStorage.getItem('geodrop-userId') || 'default_user';
        setMessages((current) => {
          if (current.length === 0) {
            seedDefaultLandmarks(coords, uid);
          }
          return current;
        });
      },
      (err) => {
        console.warn('Geolocation high-accuracy watch error:', err.message);

        // Fallback strategy: try low accuracy once
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords: Coordinates = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            };
            setUserLocation(coords);
            setIsDemoMode(false);
            setError(null);
            setIsPermissionError(false);
          },
          (fallbackErr) => {
            let errorKey: TranslationKey = 'Error.location_unknown';
            setIsPermissionError(false);

            if (fallbackErr.code === 1) {
              errorKey = 'Error.location_denied';
              setIsPermissionError(true);
            } else if (fallbackErr.code === 2) {
              errorKey = 'Error.location_unavailable';
            } else if (fallbackErr.code === 3) {
              errorKey = 'Error.location_timeout';
            }

            // If we already have a cached location or demo location, don't hard-error out
            setUserLocation((existing) => {
              if (!existing) {
                setError(t(errorKey));
              }
              return existing;
            });
          },
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );

    setLocationWatcher(watcherId);
  }, [t, seedDefaultLandmarks]);

  useEffect(() => {
    startWatchingLocation();
    return () => {
      if (locationWatcher !== null) {
        navigator.geolocation.clearWatch(locationWatcher);
      }
    };
  }, [startWatchingLocation]);

  const retryLocation = useCallback(() => {
    setError(null);
    setIsPermissionError(false);
    if (locationWatcher !== null) {
      navigator.geolocation.clearWatch(locationWatcher);
    }
    startWatchingLocation();
  }, [locationWatcher, startWatchingLocation]);

  const enableDemoCoordinates = useCallback(
    async (coords: Coordinates = DEFAULT_DEMO_COORDINATES) => {
      triggerHaptic(40);
      if (locationWatcher !== null) {
        navigator.geolocation.clearWatch(locationWatcher);
        setLocationWatcher(null);
      }
      setUserLocation(coords);
      setIsDemoMode(true);
      setError(null);
      setIsPermissionError(false);
      setShowLocationMenu(false);

      const uid = userId || 'demo_user';
      const sampleList = await createSampleLandmarks(coords, uid);
      setMessages(sampleList);
      localStorage.setItem('geodrop-messages', JSON.stringify(sampleList));
    },
    [locationWatcher, userId]
  );

  const saveMessages = (updatedMessages: Message[]) => {
    setMessages(updatedMessages);
    localStorage.setItem('geodrop-messages', JSON.stringify(updatedMessages));
  };

  const handleAddMessage = useCallback(
    async (
      details: { name: string; type: 'audio' | 'text'; audioUrl?: string; text?: string },
      visibility: 'public' | 'personal'
    ) => {
      if (!userLocation) {
        setError('Cannot add landmark without your current location.');
        return;
      }
      if (!userId) {
        setError('Cannot add landmark without a user identity.');
        return;
      }

      const newMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        authorId: userId,
        location: userLocation,
        visibility,
        type: details.type,
        name: details.name,
        audioUrl: details.audioUrl,
        text: details.text,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [newMessage, ...messages];
      saveMessages(updatedMessages);
      setAppState(AppState.Finding);
      triggerHaptic([60, 60, 100]);
    },
    [userLocation, messages, userId]
  );

  const toggleHiddenMessageId = useCallback((messageId: string) => {
    setHiddenMessageIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      localStorage.setItem('geodrop-hidden-ids', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  }, []);

  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages((prev) => {
      const updated = prev.filter((m) => m.id !== messageId);
      saveMessages(updated);
      return updated;
    });
    setHiddenMessageIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      localStorage.setItem('geodrop-hidden-ids', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
    triggerHaptic([60, 40, 100]);
  }, []);

  // Simulator step closer to test audio beacon proximity
  const handleStepCloser = useCallback(
    (target: Coordinates) => {
      if (!userLocation) return;
      triggerHaptic(40);
      const dLat = target.lat - userLocation.lat;
      const dLng = target.lng - userLocation.lng;
      // Step 25% closer to target
      const newLocation: Coordinates = {
        lat: userLocation.lat + dLat * 0.35,
        lng: userLocation.lng + dLng * 0.35,
      };
      setUserLocation(newLocation);
    },
    [userLocation]
  );

  const renderContent = () => {
    // If error and no location available at all, show recovery screen with instant Demo button
    if (error && !userLocation) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-6 bg-red-950/40 border border-red-800/80 rounded-3xl my-auto">
          <AlertTriangle className="w-14 h-14 text-red-400 mb-4 animate-bounce" />
          <h2 className="text-xl font-bold text-red-200">{t('Error.location_title')}</h2>
          <p className="text-red-300/90 text-sm mt-2 max-w-xs">{error}</p>

          {isPermissionError && (
            <div className="text-left text-xs text-slate-300 bg-slate-900/80 p-4 mt-4 rounded-xl border border-red-800/50 w-full space-y-2">
              <p className="font-bold text-red-300">{t('Error.permission_instructions_title')}</p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                <li dangerouslySetInnerHTML={{ __html: t('Error.permission_instructions_mobile') }} />
                <li dangerouslySetInnerHTML={{ __html: t('Error.permission_instructions_desktop') }} />
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={retryLocation}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold py-3 px-4 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span>{t('Error.try_again')}</span>
            </button>

            <button
              onClick={() => enableDemoCoordinates(DEFAULT_DEMO_COORDINATES)}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t('Error.use_demo_location')}</span>
            </button>
          </div>
        </div>
      );
    }

    if (!userLocation || !userId) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-6 my-auto">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center animate-pulse">
              <CompassIcon className="w-10 h-10 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-100">{t('State.finding_location')}</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-xs">{t('State.finding_location_subtitle')}</p>

          <button
            onClick={() => enableDemoCoordinates(DEFAULT_DEMO_COORDINATES)}
            className="mt-6 text-xs text-cyan-400 hover:text-cyan-300 underline font-semibold py-2 px-4"
          >
            {t('Error.use_demo_location')}
          </button>
        </div>
      );
    }

    switch (appState) {
      case AppState.Placing:
        return (
          <MessagePlacer
            onAddMessage={handleAddMessage}
            disabled={!userLocation}
            t={t}
            lang={lang}
          />
        );
      case AppState.Finding:
      default:
        return (
          <div className="flex flex-col space-y-4">
            {messages.length === 0 && (
              <button
                type="button"
                onClick={() => seedDefaultLandmarks(userLocation, userId)}
                className="w-full py-3 px-4 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-700/60 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>{t('Finder.seed_samples')}</span>
              </button>
            )}

            <MessageFinder
              userLocation={userLocation}
              messages={messages}
              currentUserId={userId}
              hiddenMessageIds={hiddenMessageIds}
              onToggleHidden={toggleHiddenMessageId}
              onDeleteMessage={handleDeleteMessage}
              onStepCloser={handleStepCloser}
              t={t}
              lang={lang}
            />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      <OfflineIndicator />

      {/* Main Responsive Mobile Container */}
      <div className="w-full max-w-lg mx-auto min-h-screen flex flex-col bg-slate-900 border-x border-slate-800 shadow-2xl relative">
        {/* Android Header with safe-top padding */}
        <header className="safe-top bg-slate-900/95 backdrop-blur-md px-4 py-3 border-b border-slate-800 sticky top-0 z-40 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center text-white shadow-md shadow-cyan-950/50">
              <Ear className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-base font-extrabold tracking-tight text-white leading-none">
                  {t('appName')}
                </h1>
                {isDemoMode && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Demo GPS
                  </span>
                )}
              </div>
              <p className="text-[11px] text-cyan-400/90 font-medium leading-tight">
                {t('tagline')}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Install PWA Button */}
            <PWAInstallButton compact />

            {/* Language Selector */}
            <div className="relative">
              <select
                value={lang}
                onChange={(e) => {
                  const newLang = e.target.value as Language;
                  triggerHaptic(20);
                  setLang(newLang);
                  setStoredLang(newLang);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer uppercase"
                aria-label="Selecteer taal"
              >
                <option value="nl">NL</option>
                <option value="en">EN</option>
                <option value="es">ES</option>
                <option value="fr">FR</option>
              </select>
            </div>

            {/* Location selector toggle */}
            <button
              onClick={() => {
                triggerHaptic(20);
                setShowLocationMenu((prev) => !prev);
              }}
              className={`p-2 rounded-lg border transition-colors ${
                showLocationMenu
                  ? 'bg-cyan-600 text-white border-cyan-500'
                  : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
              }`}
              title="Locatie-instellingen & steden"
              aria-label="Locatie-instellingen"
            >
              <Navigation className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Location Dropdown Modal */}
        {showLocationMenu && (
          <div className="bg-slate-850 p-4 border-b border-slate-700 space-y-3 z-30 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold uppercase tracking-wider text-slate-300">
                GPS & Locatiemodus
              </span>
              <button
                onClick={() => setShowLocationMenu(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={retryLocation}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <CompassIcon className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Live GPS</span>
              </button>

              <button
                type="button"
                onClick={() => enableDemoCoordinates(PRESET_CITIES.amsterdam.coords)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <MapPinIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>Amsterdam (Dam)</span>
              </button>

              <button
                type="button"
                onClick={() => enableDemoCoordinates(PRESET_CITIES.rotterdam.coords)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <MapPinIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rotterdam (Centraal)</span>
              </button>

              <button
                type="button"
                onClick={() => enableDemoCoordinates(PRESET_CITIES.utrecht.coords)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <MapPinIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>Utrecht (Domplein)</span>
              </button>
            </div>
          </div>
        )}

        {/* Location Status Bar */}
        <div className="bg-slate-950/60 px-4 py-1.5 text-[11px] text-slate-400 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center space-x-1.5 truncate">
            <CompassIcon
              className={`w-3.5 h-3.5 ${
                isDemoMode ? 'text-amber-400' : 'text-emerald-400 animate-pulse'
              }`}
            />
            <span className="truncate">
              {userLocation
                ? t('Header.location', {
                    lat: userLocation.lat.toFixed(4),
                    lng: userLocation.lng.toFixed(4),
                  })
                : t('Header.searching')}
            </span>
          </div>

          <span className="text-[10px] text-slate-500 font-mono">
            {messages.length} landmarks
          </span>
        </div>

        {/* Main Content Area */}
        <main className="flex-grow p-4 overflow-y-auto">{renderContent()}</main>

        {/* Android Native-Style Bottom Navigation Bar */}
        <footer className="safe-bottom bg-slate-900/95 backdrop-blur-md border-t border-slate-800 sticky bottom-0 z-40">
          <nav className="flex justify-around items-center px-4 py-2">
            <button
              onClick={() => {
                triggerHaptic(25);
                setAppState(AppState.Finding);
              }}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all ${
                appState === AppState.Finding
                  ? 'text-cyan-400 bg-cyan-950/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
              aria-label={t('Nav.find_aria')}
            >
              <SearchIcon className="w-6 h-6" />
              <span className="text-xs mt-1">{t('Nav.find')}</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic(25);
                setAppState(AppState.Placing);
              }}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all ${
                appState === AppState.Placing
                  ? 'text-cyan-400 bg-cyan-950/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
              aria-label={t('Nav.place_aria')}
            >
              <PlusCircleIcon className="w-6 h-6" />
              <span className="text-xs mt-1">{t('Nav.place')}</span>
            </button>
          </nav>
        </footer>
      </div>
    </div>
  );
};

export default App;
