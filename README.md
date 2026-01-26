# Gadget Finder

A comprehensive IoT-based gadget tracking system that helps you locate your misplaced items using ESP32 hardware, mobile and web applications.

## 🚀 Project Overview

Gadget Finder is a monorepo containing four interconnected projects that work together to create a complete gadget tracking solution:

- **ESP32 Firmware** - IoT device firmware for Bluetooth-based tracking
- **Flutter Mobile App** - Cross-platform mobile application for device interaction
- **React Web Dashboard** - Web-based management and monitoring interface
- **Node.js Backend** - RESTful API server with database integration

## 📦 Repository Structure

```
gadget-finder/
├── esp32/                  # ESP32 firmware (Arduino/PlatformIO)
├── mobile-app/             # Flutter mobile application
├── web-dashboard/          # React web application
└── backend/                # Node.js Express API server
```

## 🏗️ Projects

### 1. ESP32 Firmware (`gadget_finder_esp32`)
The firmware that runs on ESP32 microcontrollers to enable device tracking functionality.

**Technologies:**
- ESP32 / Arduino
- Bluetooth Low Energy (BLE)
- WiFi connectivity

**Repository:** https://github.com/Harshithk00/gadget_finder_esp32

---

### 2. Flutter Mobile App (`gadget_finder_app`)
A cross-platform mobile application for iOS and Android that allows users to track and manage their gadgets.

**Technologies:**
- Flutter / Dart
- BLE integration
- Cross-platform (iOS, Android, Web, Desktop)

**Features:**
- Scan and connect to ESP32 devices
- Real-time device tracking
- User-friendly interface

**Repository:** https://github.com/Harshithk00/gadget_finder_app

---

### 3. React Web Dashboard (`gadget_finder_react_app`)
A modern web interface for managing gadgets and viewing tracking data.

**Technologies:**
- React
- Vite
- Tailwind CSS
- JavaScript

**Live Demo:** https://gadget-finder-react-app.vercel.app

**Repository:** https://github.com/Harshithk00/gadget_finder_react_app

---

### 4. Node.js Backend (`gadget_finder_backend`)
RESTful API server that handles data storage, user authentication, and device management.

**Technologies:**
- Node.js
- Express.js
- MongoDB/Database
- RESTful API

**Live API:** https://minibackend-six.vercel.app

**Repository:** https://github.com/Harshithk00/gadget_finder_backend

---

## 🛠️ Getting Started

### Prerequisites

- **ESP32**: Arduino IDE or PlatformIO
- **Mobile App**: Flutter SDK (3.0+), Dart
- **Web Dashboard**: Node.js (16+), npm/yarn
- **Backend**: Node.js (16+), npm/yarn, MongoDB

### Installation

#### 1. Clone the Repositories

```bash
# Create main directory
mkdir gadget-finder && cd gadget-finder

# Clone all repositories
git clone https://github.com/Harshithk00/gadget_finder_esp32.git esp32
git clone https://github.com/Harshithk00/gadget_finder_app.git mobile-app
git clone https://github.com/Harshithk00/gadget_finder_react_app.git web-dashboard
git clone https://github.com/Harshithk00/gadget_finder_backend.git backend
```

#### 2. Backend Setup

```bash
cd backend
npm install
# Configure environment variables (create .env file)
npm start
```

#### 3. Web Dashboard Setup

```bash
cd web-dashboard
npm install
npm run dev
```

#### 4. Mobile App Setup

```bash
cd mobile-app
flutter pub get
flutter run
```

#### 5. ESP32 Setup

```bash
cd esp32
# Open in Arduino IDE or PlatformIO
# Configure WiFi credentials
# Upload to ESP32 device
```

## 🔧 Configuration

### Backend Environment Variables
Create a `.env` file in the backend directory:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

### Web Dashboard Configuration
Update API endpoint in the web dashboard:

```javascript
// src/config.js or similar
const API_URL = 'https://minibackend-six.vercel.app';
```

### ESP32 Configuration
Update WiFi and server details in the ESP32 code:

```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "https://minibackend-six.vercel.app";
```

## 📱 Features

- **Real-time Tracking**: Locate your gadgets using BLE technology
- **Multi-platform Support**: iOS, Android, and Web interfaces
- **User Management**: Secure authentication and user profiles
- **Device Management**: Add, remove, and monitor multiple devices
- **Cloud Sync**: Data synchronization across all platforms
- **Responsive Design**: Works seamlessly on all screen sizes

## 🏛️ Architecture

```
┌─────────────┐
│   ESP32     │◄──── BLE ────► ┌──────────────┐
│  Hardware   │                │ Mobile App   │
└─────────────┘                │  (Flutter)   │
       │                       └──────────────┘
       │                              │
       │ WiFi/HTTP                    │ HTTP/REST
       │                              │
       ▼                              ▼
┌─────────────────────────────────────────┐
│         Backend API (Node.js)           │
│         Database (MongoDB)              │
└─────────────────────────────────────────┘
                    ▲
                    │ HTTP/REST
                    │
           ┌────────────────┐
           │ Web Dashboard  │
           │    (React)     │
           └────────────────┘
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request to any of the individual repositories.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**Harshithk00**
- GitHub: [@Harshithk00](https://github.com/Harshithk00)

## 🐛 Issues & Support

For bugs and feature requests:
- ESP32 Issues: https://github.com/Harshithk00/gadget_finder_esp32/issues
- Mobile App Issues: https://github.com/Harshithk00/gadget_finder_app/issues
- Web Dashboard Issues: https://github.com/Harshithk00/gadget_finder_react_app/issues
- Backend Issues: https://github.com/Harshithk00/gadget_finder_backend/issues

## 📝 Development Roadmap

- [ ] Add GPS tracking support
- [ ] Implement geofencing alerts
- [ ] Add battery level monitoring
- [ ] Create admin dashboard
- [ ] Implement push notifications
- [ ] Add historical tracking data
- [ ] Multi-language support

---

**Note:** This is a monorepo README that provides an overview of all four interconnected projects. Please refer to individual repository READMEs for project-specific documentation.
