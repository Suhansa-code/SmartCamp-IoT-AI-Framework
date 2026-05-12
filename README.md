# Smart Disaster Relief Camp Box (SDRC-Box)

# 📌 Project Vision

# The SDRC-Box is an integrated hardware and software solution designed for rapid deployment in disaster-stricken areas. It serves as a localized intelligence hub, balancing environmental safety, efficient resource logistics, and the mental well-being of displaced individuals.

# 

# 🏗 The Three Core Pillars

# 1\. Smart Environmental Risk Monitoring \& Flood Prediction

# Purpose: Real-time safety auditing of the camp's physical location.

# 

# Tech: ESP32 sensors (water level, rain), Raspberry Pi Gateway, and Location-Aware AI (LSTM/TFLite) to predict flood risks before they occur.

# 

# 2\. Camp Resource Management

# Purpose: Digital inventory and distribution tracking for food, medicine, and water.

# 

# Tech: Centralized Admin Dashboard (Next.js) with real-time stock alerts and QR-based tracking to prevent resource wastage or hoarding.

# 
# SAAMP — Semantic-Aware Adaptive Message Prioritization
# The core research novelty. Addresses the gap confirmed by Zhang et al. (2022) that joint optimisation of delay and packet loss under uncertain network conditions remains unsolved. Three combined    elements:

# Semantic Classification —> auto-assigns CRITICAL/HIGH/MEDIUM/LOW priority from message source and action; no manual configuration
# Predictive QoS —> Random Forest model forecasts network degradation 60 seconds ahead using passive MQTT monitoring (no ping packets); <5ms inference on Pi 5
# Priority-Ordered Recovery —> offline SQLite buffer flushes CRITICAL → HIGH → MEDIUM → LOW on reconnection

# 3\. Educational \& Psychology Module

# Purpose: Providing offline access to educational content and psychological support tools.

# 

# Tech: A "Captive Portal" or local web server hosted on the Raspberry Pi, offering interactive learning and guided trauma-relief exercises without needing an active internet connection.

# 

# 📁 Integrated Repository Structure

SmartCamp-IoT-AI-Framework/
├── cloud-platform/
│   ├── backend/
│   │   ├── pages-backend/
│   │   ├── pages-flask/
│   │   └── src/
│   ├── frontend/
│   │   ├── public/
│   │   └── src/
│   └── prediction-models/
│       ├── data/
│       ├── models/
│       ├── notebooks/
│       ├── scripts/
│       └── src/
├── edge-gateway/
│   ├── prediction-models/
│   ├── scripts/
│   │   ├── Altitude and GPS Details Request Model/
│   │   ├── gps_module/
│   │   └── OpenStreet API/
│   └── src/
├── raspberry-platform/
│   ├── backend/
│   │   └── res-mng_backend/
│   └── frontend/
│       └── src/
├── sensor-node/
├── .github/workflows/
├── Credentials.md
├── network_simulation_log.csv
└── README.md

# 🛠 Strategic Architecture Guidelines

# Offline-First Strategy: Since Pillar 3 (Psychology/Education) must work during disasters, the Raspberry Pi should act as a Local Wi-Fi Hotspot. Users connect their phones to the "SDRC-BOX" Wi-Fi to access the educational module without internet.

# 

# Unified Data Schema: Ensure your database (PostgreSQL/MongoDB) links "Environmental Risk" levels to "Resource Management." (e.g., If a flood is predicted, the system automatically alerts managers to move food resources to higher ground).

# 

# Modular Deployment: Each of the 3 components should be able to run independently. If the sensors fail, the Resource Management and Psychology modules must remain functional.

# 

# 📊 Technical Standards

# UI/UX: High-end, luxury aesthetic for the Admin Dashboard to ensure clarity during high-stress disaster scenarios.

# 

# Communication: MQTT for sensor-to-Pi, REST/WebSockets for Pi-to-Cloud.

# 

# AI: Use TensorFlow Lite for edge prediction to minimize latency.

