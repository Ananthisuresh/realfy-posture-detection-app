import React, { useState, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

// Define the backend URL
const BACKEND_URL = 'http://127.0.0.1:5000'; // IMPORTANT: Change this to your deployed backend URL before deployment!

// Main App Component
function App() {
  // State to manage the video source (uploaded file URL)
  const [videoSrc, setVideoSrc] = useState(null);
  // State to manage if webcam is active
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  // State to store posture feedback from the backend
  const [postureFeedback, setPostureFeedback] = useState(null);
  // State to manage the MediaStream from the webcam
  const [webcamStream, setWebcamStream] = useState(null);
  // State to manage the socket connection
  const [socket, setSocket] = useState(null);
  // State to show loading indicator for video processing
  const [isLoading, setIsLoading] = useState(false);
  // State to manage error messages
  const [error, setError] = useState(null);

  // Refs for the video and canvas elements
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Effect hook to initialize Socket.IO connection
  useEffect(() => {
    // Connect to the backend Socket.IO server
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      cors: {
        origin: "*", // Allow all origins for development, refine in production
        methods: ["GET", "POST"]
      }
    });

    // Event listener for successful connection
    newSocket.on('connect', () => {
      console.log('Connected to backend Socket.IO');
      setError(null); // Clear any previous errors
    });

    // Event listener for disconnection
    newSocket.on('disconnect', () => {
      console.log('Disconnected from backend Socket.IO');
    });

    // Event listener for connection errors
    newSocket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err);
      setError('Could not connect to the backend. Please ensure the backend server is running and accessible.');
    });

    // Event listener for posture feedback from the backend
    newSocket.on('frame_feedback', (data) => {
      setPostureFeedback(data);
      // Draw keypoints on canvas
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context && data.keypoints && data.keypoints.length > 0) {
        // Clear only the previous drawings (keypoints, lines) from the canvas
        // The actual video frame is displayed by the <video> element underneath
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw keypoints
        context.fillStyle = data.is_bad_posture ? 'red' : 'lime'; // Red for bad, lime for good posture
        context.strokeStyle = data.is_bad_posture ? 'red' : 'lime';
        context.lineWidth = 2;

        data.keypoints.forEach(kp => {
          if (kp.visibility > 0.7) { // Only draw highly visible keypoints
            context.beginPath();
            context.arc(kp.x, kp.y, 5, 0, 2 * Math.PI); // Draw a circle for each keypoint
            context.fill();
            context.stroke();
          }
        });

        // Optionally draw lines between keypoints (simplified for common connections)
        const drawLine = (p1_id, p2_id) => {
          const kp1 = data.keypoints.find(kp => kp.id === p1_id);
          const kp2 = data.keypoints.find(kp => kp.id === p2_id);
          if (kp1 && kp2 && kp1.visibility > 0.7 && kp2.visibility > 0.7) {
            context.beginPath();
            context.moveTo(kp1.x, kp1.y);
            context.lineTo(kp2.x, kp2.y);
            context.stroke();
          }
        };

        // Example connections for basic pose visualization
        drawLine(mp.solutions.pose.PoseLandmark.LEFT_SHOULDER.value, mp.solutions.pose.PoseLandmark.LEFT_ELBOW.value);
        drawLine(mp.solutions.pose.PoseLandmark.LEFT_ELBOW.value, mp.solutions.pose.PoseLandmark.LEFT_WRIST.value);
        drawLine(mp.solutions.pose.PoseLandmark.RIGHT_SHOULDER.value, mp.solutions.pose.PoseLandmark.RIGHT_ELBOW.value);
        drawLine(mp.solutions.pose.PoseLandmark.RIGHT_ELBOW.value, mp.solutions.pose.PoseLandmark.RIGHT_WRIST.value);
        drawLine(mp.solutions.pose.PoseLandmark.LEFT_HIP.value, mp.solutions.pose.PoseLandmark.LEFT_KNEE.value);
        drawLine(mp.solutions.pose.PoseLandmark.LEFT_KNEE.value, mp.solutions.pose.PoseLandmark.LEFT_ANKLE.value);
        drawLine(mp.solutions.pose.PoseLandmark.RIGHT_HIP.value, mp.solutions.pose.PoseLandmark.RIGHT_KNEE.value);
        drawLine(mp.solutions.pose.PoseLandmark.RIGHT_KNEE.value, mp.solutions.pose.PoseLandmark.RIGHT_ANKLE.value);
        drawLine(mp.solutions.pose.PoseLandmark.LEFT_SHOULDER.value, mp.solutions.pose.PoseLandmark.RIGHT_SHOULDER.value);
        drawLine(mp.solutions.pose.PoseLandmark.LEFT_HIP.value, mp.solutions.pose.PoseLandmark.RIGHT_HIP.value);
        drawLine(mp.solutions.pose.PoseLandmark.LEFT_SHOULDER.value, mp.solutions.pose.PoseLandmark.LEFT_HIP.value);
        drawLine(mp.solutions.pose.PoseLandmark.RIGHT_SHOULDER.value, mp.solutions.pose.PoseLandmark.RIGHT_HIP.value);
      }
    });

    setSocket(newSocket); // Store the socket instance

    // Cleanup function: disconnect socket when component unmounts
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
      newSocket.disconnect();
    };
  }, []); // Empty dependency array means this runs once on mount

  // Function to handle video file upload
  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Create a URL for the uploaded video file
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsWebcamActive(false); // Deactivate webcam if video is uploaded
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop()); // Stop webcam stream
        setWebcamStream(null);
      }
      setPostureFeedback(null); // Clear previous feedback
      setError(null); // Clear errors
      setIsLoading(true); // Show loading indicator
    }
  };

  // Function to start webcam stream
  const startWebcam = async () => {
    try {
      // Request access to user's media devices (video only)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setWebcamStream(stream);
      setVideoSrc(null); // Clear video source if webcam is active
      setIsWebcamActive(true); // Activate webcam
      setPostureFeedback(null); // Clear previous feedback
      setError(null); // Clear errors
      setIsLoading(false); // No loading for webcam, it's real-time
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setError('Could not access webcam. Please ensure camera permissions are granted.');
    }
  };

  // Function to stop webcam stream
  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop()); // Stop all tracks in the stream
      setWebcamStream(null);
    }
    setIsWebcamActive(false); // Deactivate webcam
    setPostureFeedback(null); // Clear feedback
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
  };

  // Function to replay the uploaded video
  const handleReplayVideo = () => {
    if (videoRef.current && videoSrc) {
      videoRef.current.currentTime = 0; // Rewind to the beginning
      videoRef.current.play(); // Play the video
      setPostureFeedback(null); // Clear previous feedback for a fresh analysis run
      setIsLoading(true); // Show loading as analysis restarts
    }
  };

  // Callback function to send video frames to the backend
  const sendFrameToBackend = useCallback(() => {
    if (!socket || !socket.connected || (!videoRef.current && !webcamStream)) {
      // Only send frames if socket is connected and there's a video/webcam source
      return;
    }

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;

    if (!videoElement || !canvasElement) {
      return;
    }

    const context = canvasElement.getContext('2d');
    if (!context) {
      return;
    }

    // Set canvas dimensions to match video/webcam feed
    canvasElement.width = videoElement.videoWidth || videoElement.clientWidth;
    canvasElement.height = videoElement.videoHeight || videoElement.clientHeight;

    // We no longer draw the video frame here, as the <video> element handles it.
    // The canvas will remain transparent, allowing keypoints to overlay.

    // Get the image data from the video element directly (not the canvas)
    // to send to the backend for processing.
    // Create a temporary canvas to get the image data from the video
    const tempCanvas = document.createElement('canvas');
    const tempContext = tempCanvas.getContext('2d');
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;
    tempContext.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
    const imageData = tempCanvas.toDataURL('image/png');

    // Emit the frame data to the backend via Socket.IO
    socket.emit('process_frame', { image: imageData });
  }, [socket, webcamStream]); // Recreate if socket or webcamStream changes

  // Effect hook to manage frame processing loop for video/webcam
  useEffect(() => {
    let animationFrameId;
    let intervalId;

    const videoElement = videoRef.current;

    const startProcessing = () => {
      // For video playback, use requestAnimationFrame for smooth frame capture
      if (videoSrc && !isWebcamActive) {
        const loop = () => {
          if (videoElement && !videoElement.paused && !videoElement.ended) {
            sendFrameToBackend();
          }
          animationFrameId = requestAnimationFrame(loop);
        };
        animationFrameId = requestAnimationFrame(loop);
      }
      // For webcam, use setInterval for consistent frame rate
      else if (isWebcamActive && webcamStream) {
        intervalId = setInterval(sendFrameToBackend, 100); // Send frame every 100ms (10 FPS)
      }
    };

    // Start processing when video is loaded or webcam is ready
    if (videoElement) {
      videoElement.onloadeddata = () => {
        setIsLoading(false); // Hide loading after video loads
        startProcessing();
      };
      videoElement.onplay = () => {
        setIsLoading(false); // Hide loading when video starts playing
        startProcessing();
      };
      videoElement.onpause = () => {
        cancelAnimationFrame(animationFrameId);
        clearInterval(intervalId);
      };
      videoElement.onended = () => {
        cancelAnimationFrame(animationFrameId);
        clearInterval(intervalId);
        setPostureFeedback(null); // Clear feedback when video ends
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
      };
      // If webcam is already active, start processing immediately
      if (isWebcamActive && webcamStream && videoElement.srcObject) {
         startProcessing();
      }
    } else if (isWebcamActive && webcamStream) {
      // If webcam is active but video element not yet ready, wait for it
      // This case is handled by `videoRef.current.srcObject = webcamStream;` below
    }

    // Cleanup function: stop animation frame and interval on unmount or state change
    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(intervalId);
    };
  }, [videoSrc, isWebcamActive, webcamStream, sendFrameToBackend]); // Re-run when these states change

  // Effect hook to assign webcam stream to video element
  useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream;
      videoRef.current.play().catch(e => console.error("Error playing webcam stream:", e));
    }
  }, [webcamStream]);

  // Define MediaPipe solutions for drawing keypoints
  // This is a placeholder; in a real app, you'd import this or define it more robustly.
  // For the purpose of this example, we're mimicking the structure needed.
  const mp = {
    solutions: {
      pose: {
        PoseLandmark: {
          NOSE: { value: 0 },
          LEFT_EYE_INNER: { value: 1 },
          LEFT_EYE: { value: 2 },
          LEFT_EYE_OUTER: { value: 3 },
          RIGHT_EYE_INNER: { value: 4 },
          RIGHT_EYE: { value: 5 },
          RIGHT_EYE_OUTER: { value: 6 },
          LEFT_EAR: { value: 7 },
          RIGHT_EAR: { value: 8 },
          MOUTH_LEFT: { value: 9 },
          MOUTH_RIGHT: { value: 10 },
          LEFT_SHOULDER: { value: 11 },
          RIGHT_SHOULDER: { value: 12 },
          LEFT_ELBOW: { value: 13 },
          RIGHT_ELBOW: { value: 14 },
          LEFT_WRIST: { value: 15 },
          RIGHT_WRIST: { value: 16 },
          LEFT_PINKY: { value: 17 },
          RIGHT_PINKY: { value: 18 },
          LEFT_INDEX: { value: 19 },
          RIGHT_INDEX: { value: 20 },
          LEFT_THUMB: { value: 21 },
          RIGHT_THUMB: { value: 22 },
          LEFT_HIP: { value: 23 },
          RIGHT_HIP: { value: 24 },
          LEFT_KNEE: { value: 25 },
          RIGHT_KNEE: { value: 26 },
          LEFT_ANKLE: { value: 27 },
          RIGHT_ANKLE: { value: 28 },
          LEFT_HEEL: { value: 29 },
          RIGHT_HEEL: { value: 30 },
          LEFT_FOOT_INDEX: { value: 31 },
          RIGHT_FOOT_INDEX: { value: 32 },
        },
        POSE_CONNECTIONS: [
          // Example connections (simplified, MediaPipe has many more)
          [11, 13], [13, 15], // Left arm
          [12, 14], [14, 16], // Right arm
          [11, 12], // Shoulders
          [23, 25], [25, 27], // Left leg
          [24, 26], [26, 28], // Right leg
          [23, 24], // Hips
          [11, 23], [12, 24], // Torso
          [7, 11], [8, 12], // Ear to shoulder
          [0, 7], [0, 8] // Nose to ear
        ]
      }
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white font-inter p-4 sm:p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-5xl bg-gray-800 rounded-3xl shadow-2xl p-6 sm:p-10 border border-gray-700 backdrop-blur-sm bg-opacity-70">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 drop-shadow-lg">
          Realfy Posture AI
        </h1>
        <p className="text-center text-gray-300 mb-8 max-w-2xl mx-auto text-lg">
          Upload a video or use your webcam for real-time posture analysis during squats or desk sitting.
        </p>

        {error && (
          <div className="bg-red-700 bg-opacity-80 text-white p-4 rounded-xl mb-6 text-center shadow-md border border-red-600 animate-pulse">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-6 mb-10">
          <label htmlFor="video-upload" className="cursor-pointer bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105 text-center text-lg flex items-center justify-center">
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            Upload Video
            <input
              id="video-upload"
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
          </label>
          {!isWebcamActive ? (
            <button
              onClick={startWebcam}
              className="bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105 text-lg flex items-center justify-center"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.87-4.87a1 1 0 011.41 1.41L16.41 11H20a1 1 0 011 1v4a1 1 0 01-1 1h-4.59l-4.87 4.87a1 1 0 01-1.41-1.41L11 16.41V20a1 1 0 01-1 1H6a1 1 0 01-1-1v-4.59L.13 10.13a1 1 0 011.41-1.41L5 11V6a1 1 0 011-1h4a1 1 0 011 1v4z"></path></svg>
              Use Webcam
            </button>
          ) : (
            <button
              onClick={stopWebcam}
              className="bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105 text-lg flex items-center justify-center"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              Stop Webcam
            </button>
          )}

          {/* New Replay Video Button */}
          {videoSrc && !isWebcamActive && (
            <button
              onClick={handleReplayVideo}
              className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105 text-lg flex items-center justify-center"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004 16.087V18m-2.5-1.5l1.5 1.5 1.5-1.5m1.5-1.5l-1.5-1.5-1.5 1.5m-1.5-1.5l1.5-1.5-1.5 1.5m-1.5-1.5l1.5-1.5-1.5 1.5M12 21a9 9 0 100-18 9 9 0 000 18z"></path></svg>
              Replay Video
            </button>
          )}
        </div>

        {isLoading && (
          <div className="text-center text-blue-400 text-xl mb-6 animate-pulse">
            <svg className="animate-spin h-8 w-8 text-blue-400 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing video...
          </div>
        )}

        {(videoSrc || isWebcamActive) ? (
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-xl border border-gray-600">
            {/* Video element to play the stream */}
            <video
              ref={videoRef}
              src={videoSrc}
              controls={true} // ALWAYS show controls for uploaded video
              autoPlay
              muted={isWebcamActive} // Mute webcam to avoid echo
              className="absolute inset-0 w-full h-full object-contain"
            ></video>
            {/* Canvas element to draw video and overlay feedback */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none" // Added pointer-events-none
            ></canvas>

            {/* Posture Feedback Display */}
            {postureFeedback && (
              <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-xl font-semibold px-6 py-3 rounded-full shadow-lg border ${postureFeedback.is_bad_posture ? 'bg-red-600 border-red-500' : 'bg-green-600 border-green-500'} bg-opacity-80 transition-all duration-300 ease-in-out transform hover:scale-105`}>
                {postureFeedback.is_bad_posture ? (
                  <span className="flex items-center">
                    <svg className="w-7 h-7 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    Bad Posture Detected!
                  </span>
                ) : (
                  <span className="flex items-center">
                    <svg className="w-7 h-7 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Good Posture
                  </span>
                )}
                {postureFeedback.message && (
                  <span className="ml-2 text-base text-gray-200">({postureFeedback.message})</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-video bg-gray-700 rounded-xl flex flex-col items-center justify-center text-gray-400 text-xl border border-gray-600 border-dashed p-8">
            <svg className="w-20 h-20 mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1.5-1.25-2.75m-6.875-6.125A4.125 4.125 0 1112 10.5a4.125 4.125 0 01-4.125-4.125V6.75m-3.5 6.75H5.25m8.5 0h3.5m-1.02-3.615A8.25 8.25 0 0120.25 10.5c0 2.21-1.207 4.16-3.006 5.25m-16.173 0C4.924 14.66 3.75 12.71 3.75 10.5a8.25 8.25 0 0112.573-7.765"></path></svg>
            <p>Ready to analyze your posture?</p>
            <p className="text-base mt-2">Upload a video or use your webcam to begin.</p>
          </div>
        )}

        <div className="mt-10 text-center text-gray-400 text-sm">
          <p>Developed by Ananthi Suresh</p> {/* just added my name */}
        </div>
      </div>
    </div>
  );
}

export default App;
