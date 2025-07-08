import cv2
import mediapipe as mp
import numpy as np
import math

class PoseDetector:
    """
    A class to detect human pose using MediaPipe and apply rule-based logic
    to identify bad posture for squats and desk sitting.
    """
    def __init__(self):
        """
        Initializes the MediaPipe Pose model.
        """
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False, # True for images, False for video
            model_complexity=1,      # 0, 1, or 2. 1 is good balance.
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.mp_drawing = mp.solutions.drawing_utils

    def _calculate_angle(self, a, b, c):
        """
        Calculates the angle between three 3D points (landmarks).
        Points are expected to be MediaPipe NormalizedLandmark objects.
        Returns angle in degrees.
        """
        # Convert landmarks to numpy arrays for vector operations
        a = np.array([a.x, a.y, a.z])
        b = np.array([b.x, b.y, b.z])
        c = np.array([c.x, c.y, c.z])

        # Create vectors BA and BC
        ba = a - b
        bc = c - b

        # Calculate cosine of the angle using dot product formula
        cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
        # Ensure cosine_angle is within valid range [-1, 1] to prevent NaN from arccos
        cosine_angle = np.clip(cosine_angle, -1.0, 1.0)
        angle_rad = np.arccos(cosine_angle)
        angle_deg = np.degrees(angle_rad)
        return angle_deg

    def _get_landmark_coords(self, landmark, image_width, image_height):
        """
        Converts normalized landmark coordinates to pixel coordinates.
        """
        return int(landmark.x * image_width), int(landmark.y * image_height)

    def _evaluate_squat_posture(self, landmarks, image_width, image_height):
        """
        Evaluates squat posture based on keypoint angles and positions.
        Rules:
        1. Knee over toe: Check if knee X is significantly past ankle X.
        2. Hunched back: Angle between hip, shoulder, and ear < 150 degrees.
        """
        feedback = {'is_bad_posture': False, 'message': ''}
        messages = []

        # Check if required landmarks are visible
        required_landmarks = [
            self.mp_pose.PoseLandmark.LEFT_HIP,
            self.mp_pose.PoseLandmark.LEFT_KNEE,
            self.mp_pose.PoseLandmark.LEFT_ANKLE,
            self.mp_pose.PoseLandmark.LEFT_SHOULDER,
            self.mp_pose.PoseLandmark.LEFT_EAR,
            self.mp_pose.PoseLandmark.NOSE # For general upper body orientation
        ]
        if not all(landmarks[lm.value] for lm in required_landmarks):
            # Not all required landmarks are detected, cannot evaluate posture reliably
            return feedback # Return default feedback

        left_hip = landmarks[self.mp_pose.PoseLandmark.LEFT_HIP.value]
        left_knee = landmarks[self.mp_pose.PoseLandmark.LEFT_KNEE.value]
        left_ankle = landmarks[self.mp_pose.PoseLandmark.LEFT_ANKLE.value]
        left_shoulder = landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        left_ear = landmarks[self.mp_pose.PoseLandmark.LEFT_EAR.value]
        nose = landmarks[self.mp_pose.PoseLandmark.NOSE.value]

        # 1. Knee Over Toe Check
        # Convert normalized coordinates to pixel coordinates for X-axis comparison
        knee_x_px, _ = self._get_landmark_coords(left_knee, image_width, image_height)
        ankle_x_px, _ = self._get_landmark_coords(left_ankle, image_width, image_height)

        # A simple heuristic: if knee is significantly forward of ankle.
        # This threshold might need tuning based on camera angle and distance.
        KNEE_OVER_TOE_THRESHOLD_PX = 20 # pixels
        if knee_x_px > ankle_x_px + KNEE_OVER_TOE_THRESHOLD_PX:
            messages.append("Knee over toe")
            feedback['is_bad_posture'] = True

        # 2. Hunched Back (Back Angle) Check
        # Angle between HIP, SHOULDER, EAR/NOSE for back straightness
        # A straight back would be close to 180 degrees. <150 indicates hunched.
        back_angle = self._calculate_angle(left_hip, left_shoulder, left_ear)
        if back_angle < 150: # Threshold for hunched back
            messages.append(f"Hunched back ({int(back_angle)}°)")
            feedback['is_bad_posture'] = True

        if messages:
            feedback['message'] = ", ".join(messages)
        return feedback

    def _evaluate_desk_posture(self, landmarks, image_width, image_height):
        """
        Evaluates desk sitting posture based on keypoint angles.
        Rules:
        1. Neck bend: Angle between shoulder, ear, and nose < 150 degrees.
        2. Back not straight: Angle between hip, shoulder, and ear is outside [160, 200] degrees.
        """
        feedback = {'is_bad_posture': False, 'message': ''}
        messages = []

        # Check if required landmarks are visible
        required_landmarks = [
            self.mp_pose.PoseLandmark.LEFT_SHOULDER,
            self.mp_pose.PoseLandmark.LEFT_EAR,
            self.mp_pose.PoseLandmark.NOSE,
            self.mp_pose.PoseLandmark.LEFT_HIP
        ]
        if not all(landmarks[lm.value] for lm in required_landmarks):
            # Not all required landmarks are detected, cannot evaluate posture reliably
            return feedback # Return default feedback

        left_shoulder = landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        left_ear = landmarks[self.mp_pose.PoseLandmark.LEFT_EAR.value]
        nose = landmarks[self.mp_pose.PoseLandmark.NOSE.value]
        left_hip = landmarks[self.mp_pose.PoseLandmark.LEFT_HIP.value]

        # 1. Neck Bend Check
        # Angle between SHOULDER, EAR, NOSE. A bent neck would have a smaller angle.
        neck_angle = self._calculate_angle(left_shoulder, left_ear, nose)
        if neck_angle < 150: # Original prompt was >30, which is a very small bend. 150 is more reasonable for a noticeable forward bend.
            messages.append(f"Neck bent ({int(neck_angle)}°)")
            feedback['is_bad_posture'] = True

        # 2. Back Not Straight Check
        # Angle between HIP, SHOULDER, EAR. Should be close to 180 for straight back.
        back_straightness_angle = self._calculate_angle(left_hip, left_shoulder, left_ear)
        if not (160 <= back_straightness_angle <= 200): # Allow some tolerance around 180
            messages.append(f"Back not straight ({int(back_straightness_angle)}°)")
            feedback['is_bad_posture'] = True

        if messages:
            feedback['message'] = ", ".join(messages)
        return feedback

    def process_frame(self, image):
        """
        Processes a single image frame to detect pose and evaluate posture.
        Args:
            image (np.array): The input image frame (BGR format from OpenCV).
        Returns:
            dict: A dictionary containing posture feedback, including:
                  - 'is_bad_posture': True if bad posture is detected.
                  - 'message': A string describing the detected bad posture.
                  - 'keypoints': A list of detected keypoints (x, y coordinates).
        """
        # Convert the image from BGR to RGB for MediaPipe processing
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        # Set image as not writeable to improve performance
        image_rgb.flags.writeable = False

        # Process the image to detect pose landmarks
        results = self.pose.process(image_rgb)

        # Set image back to writeable
        image_rgb.flags.writeable = True
        # Convert back to BGR for drawing with OpenCV
        image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)

        feedback = {'is_bad_posture': False, 'message': '', 'keypoints': []}

        if results.pose_landmarks:
            # Extract landmarks for drawing and analysis
            landmarks = results.pose_landmarks.landmark
            image_height, image_width, _ = image.shape

            # Store keypoints in pixel coordinates for frontend visualization
            keypoints_data = []
            for id, lm in enumerate(landmarks):
                cx, cy = self._get_landmark_coords(lm, image_width, image_height)
                keypoints_data.append({'id': id, 'x': cx, 'y': cy, 'visibility': lm.visibility})

            feedback['keypoints'] = keypoints_data

            # Evaluate posture based on detected landmarks
            # You might want to add a UI element on the frontend to select 'squat' or 'desk sitting' mode
            # For now, let's just run both and combine feedback or prioritize.
            # For this assignment, let's assume the user is performing either one.
            # A more robust solution would require user input for the activity.

            squat_feedback = self._evaluate_squat_posture(landmarks, image_width, image_height)
            desk_feedback = self._evaluate_desk_posture(landmarks, image_width, image_height)

            # Combine feedback (prioritize bad posture detection)
            if squat_feedback['is_bad_posture']:
                feedback.update(squat_feedback)
            elif desk_feedback['is_bad_posture']:
                feedback.update(desk_feedback)
            else:
                feedback['is_bad_posture'] = False
                feedback['message'] = 'Good Posture'

            # Draw landmarks and connections on the image (optional, for debugging or server-side visualization)
            # self.mp_drawing.draw_landmarks(image_bgr, results.pose_landmarks,
            #                                self.mp_pose.POSE_CONNECTIONS,
            #                                self.mp_drawing.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=2),
            #                                self.mp_drawing.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2)
            # )

        return feedback