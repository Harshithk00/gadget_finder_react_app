import React, { useState, useEffect, useRef } from 'react';
import Paho from 'paho-mqtt';

// --- CONSTANTS ---
const API_URL = "/api";
const MQTT_CONFIG = {
  host: "80cf954715bf4d949f4ee68bf3d621b3.s1.eu.hivemq.cloud",
  port: 8884, // WSS Port for HiveMQ Cloud
  username: "axionx",
  password: "Harshit1",
  path: "/mqtt",
  useSSL: true
};

const DEVICE_ICONS = {
  tag: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.535 20.9a1 1 0 01-1.32.083l-.083-.083a1 1 0 01.083-1.32l2.676-2.676a6.002 6.002 0 01-2.29-6.907c1.35-4.053 5.48-6.426 9.401-4.998z",
  phone: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
  card: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  headphone: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4c0-2.79 3-4 3-8a9 9 0 10-18 0c0 4 3 5.21 3 8v4M10 11a2 2 0 11-4 0 2 2 0 014 0z"
};

// --- INITIAL DATA ---
const INITIAL_DEVICES = Array.from({ length: 6 }, (_, i) => {
  const num = i + 1;
  const hwId = `BUZZER-DEV0${num}`;
  return {
    id: i + 1,
    hardwareId: hwId,
    name: `BZR-DEV0${num}`,
    type: "tag", // Default type
    battery: Math.floor(Math.random() * 100),
    status: "Connected",
    lastSeen: "Just now",
    coordinates: "Waiting for GPS...",
    lat: 0,
    lng: 0,
    color: "text-yellow-600",
    bg: "bg-yellow-100",
    iconPath: DEVICE_ICONS.tag
  };
});

function App() {
  // --- STATE ---
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'profile'
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register'
  
  const [devices, setDevices] = useState(INITIAL_DEVICES);
  const [activeDeviceId, setActiveDeviceId] = useState(null);
  const [ringingDeviceId, setRingingDeviceId] = useState(null);
  
  const [mqttConnected, setMqttConnected] = useState(false);
  const [mqttClient, setMqttClient] = useState(null);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // For login/register loading

  const ringingTimeoutRef = useRef(null);

  // --- REFS ---
  // To keep track of latest devices state inside MQTT callbacks if needed
  const devicesRef = useRef(devices);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  // --- EFFECTS ---

  // Check for stored credentials on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('gadget_finder_user');
    const storedToken = localStorage.getItem('gadget_finder_token');
    
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
      showToast('Welcome back!', 'success');
    }
  }, []);

  // Initialize MQTT when logged in
  useEffect(() => {
    if (user && !mqttClient) {
      initMQTT();
    }
    
    // Fetch locations for all devices on load
    if (user && token) {
       console.log("Fetching initial locations for all devices...");
       devices.forEach(device => {
          fetchDeviceLocation(device);
       });
    }

    // Cleanup on unmount or user logout
    return () => {
      if (mqttClient && mqttClient.isConnected()) {
        try { mqttClient.disconnect(); } catch (e) { console.error(e); }
      }
    };
  }, [user, token]);

  // --- AUTH FUNCTIONS ---

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.elements['login-email'].value;
    const password = e.target.elements['login-password'].value;
    
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data = await res.json();
        finishAuth(data.token, data.user);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "Login Failed");
      }
    } catch (error) {
      console.warn("API Login failed:", error);
      // Fallback Mock Login
      if (email === "user@example.com") {
        showToast("Using Mock Login (Server Offline)", "info");
        finishAuth("mock-token", { name: "Demo User", email: email });
      } else {
        showToast("Login Failed: " + error.message, "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const name = e.target.elements['reg-name'].value;
    const email = e.target.elements['reg-email'].value;
    const password = e.target.elements['reg-password'].value;

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });

      if (res.ok) {
        const data = await res.json();
        showToast("Account Created! Logging in...", "success");
        finishAuth(data.token, data.user);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "Registration Failed");
      }
    } catch (error) {
      showToast("Error: " + error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const finishAuth = (token, user) => {
    // Save to localStorage
    localStorage.setItem('gadget_finder_user', JSON.stringify(user));
    localStorage.setItem('gadget_finder_token', token);

    setToken(token);
    setUser(user);
    setView('dashboard');
  };

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem('gadget_finder_user');
    localStorage.removeItem('gadget_finder_token');
    
    setUser(null);
    setToken(null);
    if (mqttClient) {
      try { mqttClient.disconnect(); } catch (e) {}
      setMqttClient(null);
      setMqttConnected(false);
    }
    setView('dashboard'); // Reset view for next login
    setAuthMode('login');
  };

  // --- MQTT FUNCTIONS ---

  const initMQTT = () => {
    const clientId = "web_client_" + Math.random().toString(16).substr(2, 8);
    // Note: Paho is imported as default export from paho-mqtt
    // Some versions export { Client }
    const Client = Paho.Client || Paho.MQTT.Client; 

    // Adjust depending on how paho-mqtt packages itself. 
    // Usually via CDN it's Paho.MQTT.Client. via npm it might differ.
    // Let's assume standard Paho structure.
    
    let client;
    try {
        client = new Paho.Client(
            MQTT_CONFIG.host,
            Number(MQTT_CONFIG.port),
            clientId
        );
    } catch (e) {
        // Fallback for some npm package structures
        client = new Paho.MQTT.Client(
            MQTT_CONFIG.host,
            Number(MQTT_CONFIG.port),
            clientId
        );
    }

    client.onConnectionLost = (responseObject) => {
      console.log("MQTT Connection Lost:", responseObject.errorMessage);
      setMqttConnected(false);
    };

    const connectOptions = {
        useSSL: MQTT_CONFIG.useSSL,
        userName: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        onSuccess: () => {
            console.log("MQTT Connected");
            setMqttConnected(true);
            setMqttClient(client);
            
            devicesRef.current.forEach(device => {
                 if(device.hardwareId) {
                     client.subscribe(`buzzer/${device.hardwareId}/status`);
                 }
            });
        },
        onFailure: (err) => {
            console.error("MQTT Failed", err);
            setMqttConnected(false);
        }
    };

    try {
        client.connect(connectOptions);
    } catch (e) {
        console.error("MQTT Connect Error:", e);
    }
  };

  const publishBuzzerCommand = (deviceUID, command) => {
    if (!mqttConnected || !mqttClient) {
        showToast("MQTT not connected.", "info");
        return;
    }
    const topic = `buzzer/${deviceUID}/control`;
    const message = new Paho.Message(command);
    message.destinationName = topic;
    mqttClient.send(message);
  };

  // --- DEVICE ACTIONS ---

  const handleStartRing = (id, e) => {
    if (e) e.stopPropagation();
    stopAllRinging();

    const device = devices.find(d => d.id === id);
    if (!device) return;

    setRingingDeviceId(id);
    
    if (activeDeviceId !== id) {
        setActiveDeviceId(id);
        fetchDeviceLocation(device);
    }

    if (device.hardwareId) {
        publishBuzzerCommand(device.hardwareId, "ON");
        showToast(`Sending MQTT ON to ${device.name}...`, 'success');
    } else {
        showToast(`Simulating sound on ${device.name}...`, 'success');
    }

    playSystemBeep();

    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    ringingTimeoutRef.current = setTimeout(() => {
        handleStopRing(id);
    }, 5000);
  };

  const handleStopRing = (id, e) => {
    if(e) e.stopPropagation();
    
    const device = devices.find(d => d.id === id);
    
    if (device && device.hardwareId) {
        publishBuzzerCommand(device.hardwareId, "OFF");
    }

    stopAllRinging(); 
    showToast(`${device ? device.name : 'Device'} sound stopped.`, 'info');
  };

  const stopAllRinging = () => {
    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    setRingingDeviceId(null);
  };

  const removeDevice = (id, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to remove this device?")) {
        if (ringingDeviceId === id) handleStopRing(id);
        const newDevices = devices.filter(d => d.id !== id);
        setDevices(newDevices);
        if (activeDeviceId === id) setActiveDeviceId(null);
        showToast("Device removed.", 'info');
    }
  };

  const handleAddNewDevice = (e) => {
    e.preventDefault();
    const name = e.target.elements['add-dev-name'].value;
    const hwId = e.target.elements['add-dev-id'].value;
    const type = e.target.elements['add-dev-type'].value;

    let color = "text-gray-600";
    let bg = "bg-gray-200";
    if (type === 'tag') { color = "text-yellow-600"; bg = "bg-yellow-100"; }
    else if (type === 'phone') { color = "text-blue-500"; bg = "bg-blue-100"; }
    else if (type === 'card') { color = "text-amber-700"; bg = "bg-amber-100"; }

    const newDevice = {
        id: Date.now(), 
        hardwareId: hwId,
        name: name,
        type: type,
        battery: 100, 
        status: "Online",
        lastSeen: "Just now",
        coordinates: "Waiting for GPS...",
        lat: 0, lng: 0,
        color: color,
        bg: bg,
        iconPath: DEVICE_ICONS[type] || DEVICE_ICONS.tag
    };

    setDevices([...devices, newDevice]);
    
    if (mqttConnected && mqttClient) {
        mqttClient.subscribe(`buzzer/${hwId}/status`);
    }

    fetchDeviceLocation(newDevice);
    setIsAddDeviceModalOpen(false);
    showToast(`Device "${name}" added successfully!`, 'success');
  };

  // --- LOCATION LOGIC ---

  const fetchDeviceLocation = async (device) => {
    if (!device || !device.hardwareId) return;

    try {
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const url = `${API_URL}/locations?device=${device.hardwareId}&limit=300`;
        console.log(`fetching loc: ${url}`);

        const res = await fetch(url, {
            headers: headers
        });

        if (res.ok) {
            const data = await res.json();
            console.log(`Data for ${device.hardwareId}:`, data.length);
            if (data && data.length > 0) {
                // Find latest by timestamp
                const sorted = data.sort((a, b) => new Date(b.ts) - new Date(a.ts));
                const loc = sorted[0];

                const updatedDevice = {
                  ...device,
                  lat: parseFloat(loc.lat),
                  lng: parseFloat(loc.lon),
                  coordinates: `${parseFloat(loc.lat).toFixed(4)}° N, ${parseFloat(loc.lon).toFixed(4)}° W`,
                  lastSeen: new Date(loc.ts).toLocaleTimeString()
                };
                
                // Update specific device in state
                setDevices(prev => prev.map(d => d.id === device.id ? updatedDevice : d));
                
                showToast("Location updated from server", "success");
            } else {
              console.log(`No location data for ${device.hardwareId}`);
            }
        } else {
            console.error("Location fetch error:", res.status, res.statusText);
            // Optionally show toast for errors if needed
            // showToast(`Error fetching ${device.name}: ${res.status}`, "error"); 
        }
    } catch (e) {
        console.error("Location fetch failed:", e);
        // showToast("Location fetch failed", "error");
    }
  };

  const refreshCurrentLocation = () => {
    if (!activeDeviceId) {
        showToast("Select a device first", "info");
        return;
    }
    const device = devices.find(d => d.id === activeDeviceId);
    showToast("Fetching location from server...", "info");
    fetchDeviceLocation(device);
  };

  // --- UTILS ---

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const playSystemBeep = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) { console.log("Audio play failed"); }
  };

  // --- RENDER HELPERS ---

  if (!user) {
    // === AUTH VIEW ===
    return (
      <div className="w-full h-screen bg-slate-900 flex items-center justify-center font-sans text-gray-800">
        <Toast toast={toast} />
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md space-y-6 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-100 rounded-full opacity-50"></div>
          
          <div className="text-center relative z-10">
            <div className="bg-indigo-600 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">GadgetFinder</h1>
            <p className="text-gray-500 mt-2">Track and locate your devices</p>
          </div>

          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 text-sm font-medium focus:outline-none ${authMode === 'login' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
            >
              Login
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 text-sm font-medium focus:outline-none ${authMode === 'register' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
            >
              Register
            </button>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" name="login-email" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" name="login-password" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>
              <button disabled={isLoading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors flex justify-center items-center">
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" name="reg-name" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" name="reg-email" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" name="reg-password" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>
              <button disabled={isLoading} type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors flex justify-center items-center">
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="text-center text-xs text-gray-400 mt-2">
            
          </div>
        </div>
      </div>
    );
  }

  // === MAIN APP ===
  const activeDevice = devices.find(d => d.id === activeDeviceId);

  return (
    <div className="h-screen flex flex-col font-sans text-gray-800 overflow-hidden bg-gray-100">
      <Toast toast={toast} />

      {/* NAVBAR */}
      <nav className="bg-white shadow-sm z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setView('dashboard')}>
              <svg className="h-8 w-8 text-indigo-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span className="font-bold text-xl tracking-tight text-gray-900">GadgetFinder</span>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => setView('dashboard')} className={`font-medium transition-colors ${view === 'dashboard' ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}>Dashboard</button>
              <button onClick={() => setView('profile')} className={`font-medium transition-colors ${view === 'profile' ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}>Profile</button>
              <div className="h-6 w-px bg-gray-300 mx-2"></div>
              <button onClick={handleLogout} className="text-red-500 hover:text-red-700 font-medium text-sm">Logout</button>
              <img src={`https://ui-avatars.com/api/?name=${user.name || 'User'}&background=indigo&color=fff`} className="w-8 h-8 rounded-full border border-gray-200 shadow-sm ml-2" alt="Avatar"/>
            </div>
          </div>
        </div>
      </nav>

      {/* DASHBOARD */}
      {view === 'dashboard' && (
        <div className="flex-col lg:flex-row flex-1 overflow-hidden relative flex">
          {/* Left Panel: Device List */}
          <div className="w-full lg:w-1/3 bg-white border-r border-gray-200 overflow-y-auto z-10 flex flex-col h-full">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                My Devices
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{devices.length} Active</span>
              </h2>

              {/* MQTT Status */}
              <div className={`mb-4 px-3 py-2 rounded-lg text-xs flex items-center ${mqttConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${mqttConnected ? 'bg-green-500' : 'bg-red-500'}`}></span> 
                {mqttConnected ? "MQTT Connected" : "MQTT Disconnected"}
              </div>

              <div className="space-y-4 pb-20">
                {devices.map(device => {
                  const isActive = activeDeviceId === device.id;
                  const isRinging = ringingDeviceId === device.id;
                  const isIOT = device.hardwareId && device.hardwareId.startsWith("BUZZER");

                  return (
                    <div 
                      key={device.id}
                      onClick={(e) => {
                        // avoid triggering when clicking internal buttons
                        if(!e.target.closest('button')) {
                            setActiveDeviceId(device.id);
                            fetchDeviceLocation(device);
                        }
                      }}
                      className={`device-card relative p-4 rounded-xl border cursor-pointer group hover:shadow-md ${isActive ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-200 bg-white hover:border-indigo-300'}`}
                    >
                      <button onClick={(e) => removeDevice(device.id, e)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors z-10" title="Remove Device">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>

                      <div className="flex items-start justify-between">
                        <div className="flex items-center w-full">
                          <div className={`p-3 rounded-lg ${device.bg} ${device.color} mr-4 flex-shrink-0`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={device.iconPath}></path></svg>
                          </div>
                          <div className="w-full pr-4">
                            <h3 className="font-bold text-gray-900 flex items-center pr-6">
                                {device.name} 
                                {isIOT && <span className="ml-2 text-[10px] bg-gray-800 text-white px-1.5 py-0.5 rounded">IOT</span>}
                            </h3>
                            <div className="flex items-center justify-between mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-blue-600 bg-blue-50 border border-opacity-20 border-gray-300">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                GPS Only
                              </span>
                              <p className="text-xs text-gray-500 flex items-center ml-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${device.status === 'Online' || device.status === 'Connected' ? 'bg-green-500' : 'bg-orange-400'} mr-1`}></span>
                                {device.status}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                           <div className={`text-xs font-semibold ${device.battery < 20 ? 'text-red-500' : 'text-green-500'} flex items-center mb-3 mt-1`}>
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                              {device.battery}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                         <div className="text-xs text-gray-400 font-medium truncate max-w-[140px]">
                            <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                            {device.coordinates}
                         </div>
                         <button 
                            onClick={isRinging ? (e) => handleStopRing(device.id, e) : (e) => handleStartRing(device.id, e)}
                            className={`ring-btn text-sm font-semibold px-4 py-1.5 rounded-full border transition-all flex items-center 
                                ${isRinging 
                                    ? 'bg-red-600 text-white border-red-600 hover:bg-red-700 shadow-sm animate-pulse' 
                                    : (isActive ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50')}`}
                         >
                            {isRinging ? <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path></svg> : null}
                            {isRinging ? "Stop" : "Find"}
                         </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="p-4 mt-auto border-t border-gray-100 bg-gray-50 sticky bottom-0">
                <button onClick={() => setIsAddDeviceModalOpen(true)} className="w-full border-2 border-dashed border-gray-300 text-gray-500 rounded-xl p-3 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center font-medium">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                  Add New Device
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Map */}
          <div className="flex-1 relative bg-gray-50 overflow-hidden flex flex-col h-full">
            <div className="absolute top-0 left-0 right-0 p-4 z-20 bg-gradient-to-b from-white/80 to-transparent pointer-events-none">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-sm p-4 inline-flex items-center justify-between border border-gray-200 pointer-events-auto min-w-[300px] w-full max-w-lg mx-auto">
                <div className="flex items-center">
                  <div className="mr-3 p-2 bg-blue-50 rounded-full text-blue-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <div className="flex flex-col">
                    {activeDevice && activeDevice.lat && activeDevice.lng ? (
                         <>
                            <span className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-0.5">Last Known Location</span>
                            <span className="font-mono text-gray-900 font-bold text-lg">{activeDevice.coordinates}</span>
                         </>
                    ) : (
                         <>
                            <span className="font-bold text-gray-900 text-sm">Select a device</span>
                            <span className="text-xs text-gray-500">to view location details</span>
                         </>
                    )}
                  </div>
                </div>
                <button onClick={refreshCurrentLocation} className="ml-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-600 transition-colors" title="Fetch latest from Server">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </button>
              </div>
            </div>

            <div className="absolute inset-0 z-10 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                {activeDevice && activeDevice.lat && activeDevice.lng ? (
                    <iframe width="100%" height="100%" frameBorder="0" style={{border:0}} allowFullScreen src={`https://maps.google.com/maps?q=${activeDevice.lat},${activeDevice.lng}&z=15&output=embed`}></iframe>
                ) : (
                    <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        <p>No location data available for this device.</p>
                        <p className="text-xs text-gray-400 mt-1">Try refreshing if data exists on server.</p>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* PROFILE */}
      {view === 'profile' && (
        <div className="flex-col flex-1 bg-gray-50 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full py-10 px-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">User Profile</h2>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex items-center space-x-6">
              <img src={`https://ui-avatars.com/api/?name=${user.name || 'User'}&background=indigo&color=fff&size=128`} className="w-24 h-24 rounded-full border-4 border-indigo-50" alt="Profile" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">{user.name}</h3>
                <p className="text-gray-500">{user.email}</p>
                <div className="flex mt-3 space-x-3">
                  <button className="text-sm border border-gray-300 px-3 py-1 rounded-md hover:bg-gray-50 text-gray-700">Edit Profile</button>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
              <p><strong>Note:</strong> Location tracking relies on GPS coordinates stored in the server database.</p>
            </div>
          </div>
        </div>
      )}

      {/* ADD DEVICE MODAL */}
      {isAddDeviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Device</h3>
            <form onSubmit={handleAddNewDevice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Friendly Name</label>
                <input type="text" name="add-dev-name" placeholder="e.g. Office Keys" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hardware ID</label>
                <input type="text" name="add-dev-id" placeholder="e.g. BUZZER-DEV01" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
                <p className="text-xs text-gray-500 mt-1">Unique ID found on the back of your tag (Default: BUZZER-DEV01).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
                <select name="add-dev-type" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white">
                    <option value="tag">Tag / Keys</option>
                    <option value="phone">Phone</option>
                    <option value="card">Wallet Card</option>
                    <option value="headphone">Headphones</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setIsAddDeviceModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 font-medium">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-medium">Add Device</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple Toast Component
function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className="fixed bottom-4 left-0 right-0 p-4 flex justify-center pointer-events-none z-50 overflow-hidden">
        <div className={`toast show bg-gray-900 text-white px-6 py-3 rounded-lg shadow-xl flex items-center space-x-3`}>
            {/* Simple icon based on type could go here */}
            <p className="font-medium">{toast.message}</p>
        </div>
    </div>
  );
}

export default App;
