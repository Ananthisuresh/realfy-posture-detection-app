#!/bin/bash

# Upgrade pip and dependencies
pip install --upgrade pip setuptools wheel

# Install everything from requirements.txt first
pip install -r requirements.txt

# Then install mediapipe manually from GitHub
pip install protobuf==3.20.3
pip install git+https://github.com/google/mediapipe.git
