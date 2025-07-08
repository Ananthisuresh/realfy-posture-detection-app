from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import base64
import numpy as np
import cv2
from pose_detector import PoseDetector # Import the pose detection logic

app = Flask(__name__)
# Allow all origins for development. In production, specify your frontend URL.
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet') # Use eventlet for async I/O

# Initialize the PoseDetector
pose_detector = PoseDetector()

@app.route('/')
def index():
    """
    A simple route to check if the backend is running.
    """
    return "Posture Detection Backend is running!"

@socketio.on('connect')
def handle_connect():
    """
    Handles new client connections.
    """
    print('Client connected:', request.sid)

@socketio.on('disconnect')
def handle_disconnect():
    """
    Handles client disconnections.
    """
    print('Client disconnected:', request.sid)

@socketio.on('process_frame')
def handle_process_frame(data):
    """
    Receives a video frame from the frontend, processes it for posture,
    and emits feedback back to the frontend.
    """
    try:
        # Extract base64 image data (e.g., "data:image/png;base64,iVBORw...")
        image_data = data['image']
        # Remove the "data:image/png;base64," prefix
        header, encoded_data = image_data.split(',', 1)
        # Decode base64 string to bytes
        image_bytes = base64.b64decode(encoded_data)
        # Convert bytes to a numpy array
        np_arr = np.frombuffer(image_bytes, np.uint8)
        # Decode the numpy array into an OpenCV image (BGR format)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            print("Error: Could not decode image frame.")
            return

        # Process the frame using the PoseDetector
        feedback = pose_detector.process_frame(frame)

        # Emit the feedback back to the client
        emit('frame_feedback', feedback)

    except Exception as e:
        print(f"Error processing frame: {e}")
        # Optionally emit an error message back to the client
        emit('frame_feedback', {'error': str(e), 'is_bad_posture': False, 'message': 'Processing error'})

if __name__ == '__main__':
    # Run the SocketIO app. debug=True allows auto-reloading during development.
    # For production, set debug=False and use a production-ready WSGI server like Gunicorn.
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)