#!/bin/bash

# Upgrade pip
pip install --upgrade pip

# Install mediapipe manually from source
pip install --upgrade setuptools wheel
pip install protobuf==3.20.3  # Required for mediapipe compatibility
pip install opencv-python
pip install git+https://github.com/google/mediapipe.git

# Then install the rest
pip install -r requirements.txt
