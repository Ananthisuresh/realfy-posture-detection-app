# Posture Detection Web Application

This project is a full-stack web application designed to detect bad posture during squats or desk sitting using rule-based logic. Users can upload a video or use their webcam for real-time posture analysis.

## Table of Contents

* [Features](#features)
* [Tech Stack](#tech-stack)
* [Project Structure](#project-structure)
* [Setup Instructions](#setup-instructions)
    * [Backend Setup](#backend-setup)
    * [Frontend Setup](#frontend-setup)
* [Usage](#usage)
* [Rule-Based Logic](#rule-based-logic)
* [Deployment](#deployment)
* [Demo Video](#demo-video)


## Features

* **Video Upload**: Users can upload a video file for posture analysis.
* **Webcam Integration**: Real-time posture detection using the user's webcam.
* **Real-time Feedback**: Visual feedback on the video stream, highlighting keypoints and displaying "Bad Posture Detected" messages.
* **Rule-Based Logic**: Detects common bad postures for squats (knee over toe, hunched back) and desk sitting (neck bend, back not straight).

## Tech Stack

* **Frontend**: React.js (with Vite)
    * `react-webcam`: For webcam access.
    * `socket.io-client`: For real-time communication with the backend.
    * Tailwind CSS: For styling.
* **Backend**: Flask
    * `Flask-SocketIO`: For real-time WebSocket communication.
    * `OpenCV (cv2)`: For video frame processing.
    * `MediaPipe`: For accurate pose and keypoint extraction.
    * `numpy`: For numerical operations (e.g., angle calculations).

## Project Structure

The repository will be structured into two main directories:
.
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PostureCanvas.jsx
│   │   │   └── VideoInput.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
└── backend/
├── app.py
├── pose_detector.py
├── requirements.txt
└── .env (optional, for environment variables)

## Setup Instructions

Follow these steps to set up and run the application locally.

### Backend Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-link>
    cd posture-detection-app/backend
    ```
2.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    The `requirements.txt` will contain:
    ```
    Flask==2.3.2
    Flask-SocketIO==5.3.0
    python-socketio==5.8.0
    eventlet==0.33.0
    opencv-python==4.9.0.80
    mediapipe==0.10.11
    numpy==1.26.4
    gunicorn==20.1.0
    ```
4.  **Run the Flask application:**
    ```bash
    python app.py
    ```
    The backend server will start on `http://127.0.0.1:5000`.

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd ../frontend
    ```
2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```
3.  **Run the React application:**
    ```bash
    npm run dev
    ```
    The frontend development server will start, typically on `http://localhost:5173`.

## Usage

1.  Ensure both the backend and frontend servers are running.
2.  Open your web browser and navigate to the frontend URL (e.g., `http://localhost:5173`).
3.  You will see options to "Upload Video" or "Use Webcam".
4.  **Upload Video**: Click the button, select a video file (MP4 recommended). The video will play, and real-time posture feedback will be displayed.
5.  **Use Webcam**: Click the button to grant camera access. Your live feed will be analyzed, and posture feedback will appear.
6.  "Bad Posture Detected" messages will appear on the screen when a rule is triggered, along with visual keypoints.

## Rule-Based Logic

The backend analyzes keypoints extracted by MediaPipe and applies the following rules:

### Squat Posture Detection

* **Knee Over Toe**: Flags if the horizontal position (x-coordinate) of the knee is significantly forward of the ankle.
    * *Logic*: Checks if `knee_x > ankle_x + threshold` (considering camera perspective).
* **Hunched Back (Back Angle)**: Flags if the angle formed by the hip, shoulder, and ear is less than 150 degrees. A smaller angle indicates a more hunched position.
    * *Logic*: Angle between `LEFT_HIP`, `LEFT_SHOULDER`, `LEFT_EAR` < 150°.

### Desk Sitting Posture Detection

* **Neck Bend**: Flags if the angle formed by the shoulder, ear, and nose is less than 150 degrees. A smaller angle indicates the neck is bent forward.
    * *Logic*: Angle between `LEFT_SHOULDER`, `LEFT_EAR`, `NOSE` < 150°.
* **Back Not Straight**: Flags if the angle formed by the hip, shoulder, and ear deviates significantly from 180 degrees (e.g., less than 160 degrees or greater than 200 degrees).
    * *Logic*: Angle between `LEFT_HIP`, `LEFT_SHOULDER`, `LEFT_EAR` is not within [160°, 200°].

*Note: All angles are calculated in degrees.*

## Deployment

To deploy this application, you will need to deploy the frontend and backend separately or together depending on your chosen platform.

**Frontend Deployment (e.g., Vercel, Netlify):**
1.  Build the React app: `npm run build`
2.  Upload the contents of the `dist` folder to your hosting provider.

**Backend Deployment (e.g., Render, Heroku, Railway, AWS EC2):**
1.  Containerize your Flask app (e.g., using Docker) or set up a Python environment on your chosen platform.
2.  Ensure your `requirements.txt` is correctly specified.
3.  Configure environment variables if needed (e.g., for CORS origins in a production environment).
4.  Expose the Flask-SocketIO server correctly.

**Public Deployment URL:**
[https://github.com/Ananthisuresh/realfy-posture-detection-app.git]- Github
[https://realfy-posture-detection-app.vercel.app/] - Vercel

Complete project link:
[https://snddhr7s-5173.inc1.devtunnels.ms/]


## Demo Video

**Demo Video Link:**
[https://youtu.be/vA7JJ4Casto]
