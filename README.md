<div align="center">

# GridGuard Mini

### IoT-Based Intelligent Power Management & Load Shedding System

A web-orchestrated microgrid platform that monitors power availability, prioritizes connected loads, and coordinates intelligent load shedding through an ESP32-based IoT device.

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [How It Works](#how-it-works)
- [Team Members](#team-members)


---

## Overview

GridGuard Mini is an **IoT-based intelligent power management system** designed to monitor power availability and manage connected electrical loads according to their importance.

In a microgrid or limited-capacity power network, the total demand can sometimes exceed the available supply. Disconnecting loads without considering their importance can interrupt essential services. GridGuard Mini addresses this problem through a priority-based load-shedding mechanism.

The platform continuously monitors system capacity and load demand. When a shortage occurs, its backend decision engine identifies lower-priority loads and disconnects them in a controlled sequence while protecting critical loads. When sufficient capacity becomes available again, disconnected loads are restored gradually.

The system combines an interactive web dashboard, a Node.js backend, MongoDB, MQTT communication, and ESP32-based hardware to provide both software simulation and physical hardware demonstration modes.

## Key Features

### 1. Real-Time Power Monitoring
- Monitor available power capacity, total demand, reserve, and power deficit.
- Display live power information through the dashboard.
- Track connected loads and their operating states.
- Receive live state updates through Socket.IO.

### 2. Intelligent Automatic Load Shedding
- Compare total load demand against usable source capacity.
- Disconnect lower-priority loads when a shortage is detected.
- Protect critical loads from automatic disconnection.
- Display the load-shedding sequence and the reason behind each decision.
- Restore disconnected loads gradually when sufficient capacity returns.

### 3. Load and Priority Management
- Add, edit, and manage connected loads.
- Configure rated power, categories, and priority levels.
- Organize loads using five priority levels, P1 to P5.
- Create, edit, activate, and compare load-management policies.
- Configure automatic shedding and manual override behavior.

### 4. Live Grid Visualization
- View a graphical representation of the power network.
- Monitor individual load states.
- Inspect load details and power information.
- Manually force eligible loads ON or OFF, or return them to automatic control.

### 5. Power Simulation
- Adjust available source capacity.
- Modify the demand factor.
- Run predefined power-shortage scenarios.
- Simulate complete source failure and sensor faults.
- Observe the resulting decisions and event timeline.

### 6. IoT Device Integration
- Connect ESP32 devices through MQTT.
- Receive voltage, current, relay-state, and device telemetry.
- Monitor device connectivity and last communication time.
- Verify switching commands through acknowledgements.
- View device logs and communication information.
- Request device status, configuration updates, and restarts.

### 7. Analytics and Reporting
- Calculate energy consumption using recorded power readings.
- View average power, peak demand, and minimum demand.
- Analyze energy consumption by individual load and category.
- Track overloads, shedding events, and disconnected-load duration.
- Export event records and analytics reports as CSV files.

### 8. Alerts and Event History
- Generate alerts for overloads, shortages, hardware faults, and communication issues.
- Track alert severity and status.
- Search and filter historical events.
- Export event history for further analysis.

### 9. Role-Based Access Control
- Separate administrator, operator, and viewer permissions.
- Restrict sensitive configuration and device operations according to user roles.
- Protect API routes using JWT authentication.

---

## System Architecture

GridGuard Mini follows a web-based, backend-controlled IoT architecture.

```text
                 ┌─────────────────────────────┐
                 │       React Dashboard       │
                 │ Monitoring · Analytics     │
                 │ Loads · Alerts · Simulator  │
                 └──────────────┬──────────────┘
                                │
                         REST API / JWT
                         Socket.IO Updates
                                │
                 ┌──────────────▼──────────────┐
                 │       Node.js Backend      │
                 │                            │
                 │  Load-Shedding Engine      │
                 │  System Control Loop       │
                 │  Authentication & API      │
                 │  Alerts & Analytics        │
                 └───────┬───────────┬────────┘
                         │           │
                    MongoDB         MQTT
                         │           │
                    ┌────▼───┐  ┌────▼────────────┐
                    │ Stored │  │   ESP32 Device  │
                    │ Data   │  │                 │
                    └────────┘  │ INA219 Sensors  │
                                │ Relay Channels  │
                                └─────────────────┘
```

### Architecture Components

| Component | Responsibility |
|---|---|
| React frontend | User interface, monitoring, controls, and visualizations |
| Express backend | REST API, authentication, system coordination, and control logic |
| Load-shedding engine | Calculates which loads should remain connected or be disconnected |
| MongoDB | Stores users, loads, policies, readings, alerts, events, devices, and settings |
| MQTT broker | Transfers telemetry and commands between the backend and ESP32 |
| ESP32 | Reads sensor information, publishes telemetry, and operates relay channels |
| Socket.IO | Pushes real-time system updates to connected dashboard clients |

**Important:** The backend is responsible for priority decisions. The ESP32 acts as the hardware interface by reporting telemetry and executing commands received from the backend.

---

## How It Works

The system operates through the following sequence:

1. **Power and load monitoring:** The system receives available capacity and connected-load information. In hardware mode, the ESP32 sends sensor readings and relay states through MQTT. In software mode, the backend uses simulated values.
2. **Demand calculation:** The backend calculates the demand of enabled loads using their configured rated power and demand factor, subject to configured minimum and maximum power limits.
3. **Capacity evaluation:** The backend calculates usable capacity using the shortage threshold and minimum reserve settings.
4. **Priority evaluation:** The load-shedding engine evaluates the priority and protection settings of each load.
5. **Load shedding:** If demand exceeds usable capacity, eligible lower-priority loads are selected for disconnection.
6. **Command execution:** In hardware mode, the backend sends switching commands to the ESP32 through MQTT and tracks the acknowledgements. In software mode, the simulated system state is updated without controlling physical hardware.
7. **Gradual restoration:** When sufficient capacity returns, disconnected loads are restored one at a time, subject to their restoration delays and the configured restoration threshold.
8. **Monitoring and reporting:** Updated system information, alerts, and events are made available through the dashboard and stored for analytics.

---


### Priority Levels

| Priority | Classification | Behavior |
|---|---|---|
| P1 | Critical | Highest protection |
| P2 | High | High importance |
| P3 | Medium | Moderate importance |
| P4 | Low | Lower importance |
| P5 | Lowest | First eligible loads considered for shedding |

A higher P-number indicates a lower priority and makes a load a candidate for earlier disconnection.

### Gradual Restoration

When capacity becomes available:
- Restoration waits for the applicable load-specific or system restoration delay.
- Only one disconnected load is restored per control step.
- The load must fit within the configured restoration threshold.
- Higher-priority loads are considered before lower-priority loads.

### Example

Consider the following demonstration configuration:

| Load | Rated Demand | Priority |
|---|---:|---|
| Hospital | 35 W | P1 |
| Data Center | 25 W | P2 |
| Home | 20 W | P3 |
| Street Light | 10 W | P4 |
| **Total** | **90 W** | |

If the available capacity is 60 W and the usable capacity is also 60 W:

| Load | Result |
|---|---|
| Hospital | ON |
| Data Center | ON |
| Home | OFF |
| Street Light | OFF |

The system disconnects lower-priority loads until the remaining demand fits the available capacity.

---


<div align="center">

**GridGuard Mini — Smarter Power Distribution Through IoT and Intelligent Load Management.**

</div>


# GridGuard Mini (Full MERN + IoT)

Web-orchestrated tabletop microgrid dashboard with priority-based load shedding.

## Stack
- Client: React + Vite + React Router + Recharts + Socket.IO client
- Server: Node.js + Express + Socket.IO + Mongoose + MQTT + JWT auth
- IoT: ESP32 telemetry/command contract over MQTT (simulator included)

## Run
```powershell
cd "E:\PPS\React Js\GridGuard-Mini"
Copy-Item server\.env.example server\.env
npm run setup
npm run dev
```
- Web: http://localhost:5173
- API: http://localhost:5000
- Default admin: `admin@gridguard.local` / `admin123`

With no `MQTT_URL`, the server runs simulated ESP32 nodes so the full dashboard works immediately. Set `MQTT_URL` for real hardware.

## Implemented areas
Dashboard, Live Monitoring, Analytics, Logs/Events, Alerts, Load Management, Priority Management, Power Failure Simulator, IoT Devices, Settings/User roles, Profile/Auth, Socket.IO realtime updates, REST API, MongoDB/memory store fallback, ESP32 firmware reference.
