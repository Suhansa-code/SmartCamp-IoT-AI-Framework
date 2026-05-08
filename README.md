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

# 3\. Educational \& Psychology Module

# Purpose: Providing offline access to educational content and psychological support tools.

# 

# Tech: A "Captive Portal" or local web server hosted on the Raspberry Pi, offering interactive learning and guided trauma-relief exercises without needing an active internet connection.

# 

# 📁 Integrated Repository Structure

# Plaintext

# /sdrc-box-root

# ├── apps/

# │   ├── admin-dashboard/     # Next.js (Management of Pillars 1 \& 2)

# │   ├── web-portal/          # Localized Web Server for Pillar 3 (Pi-hosted)

# │   └── backend-api/         # Central Node.js API (MERN Stack)

# ├── firmware/

# │   ├── sensor-nodes/        # ESP32 code for Flood Monitoring

# │   └── disaster-box-pi/     # Raspberry Pi Gateway \& Local Services

# ├── ml-engine/

# │   ├── models/              # Prediction models (Flood \& Resource Trends)

# │   └── api/                 # FastAPI for serving model inferences

# ├── docs/                    # System Architecture \& Research Papers

# └── docker-compose.yml       # One-click deployment for the full stack

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





<!-- ❯ Can you go though my model and create what are the inputs do i need in my prediction frontend frontend path is  
  /home/suhansa-kashmira/Documents/SmartCamp-IoT-AI-Framework/raspberry-platform/frontend/src/components/resources    and backend is in           
  rassberrypie and need to create buffer for sync during the low network the registration data and other model need data need to be get from the  
  locl env (rassberry pie) and then it go to the brocker and then go to the cloud vm in there is my prediction dydtem is deployed inside the      
  container and predicted  result need to be showd in admin dashboard   -->