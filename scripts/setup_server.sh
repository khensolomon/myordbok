#!/bin/bash

# --- INFO ---
# Version: 1.3.2
# Last Updated: 2026-02-22
# Changes: Added descriptive note for the Swap Size prompt to explain its purpose.

# --- DEFAULT VARIABLES ---
DEFAULT_BASE_DIR="/var/www"
DEFAULT_PROJECT_NAME="app"
DEFAULT_DB_USER="root"
DEFAULT_DB_PASSWORD="change_this_password_123"
DEFAULT_SWAP_SIZE="2G" # Options: 1G, 2G, 4G, etc.

# --- CONFIGURATION ---
#
# Usage: sudo ./setup_server.sh
# The script will now prompt you for the required configuration values.
#
# The Recommended Way (Download, Inspect, Execute):
#   curl -O https://raw.githubusercontent.com/.../setup_server.sh
#   nano setup_server.sh
#   chmod +x setup_server.sh
#   sudo ./setup_server.sh

# Interactive Prompts
echo "--- Server Configuration ---"
read -p "Base Directory [$DEFAULT_BASE_DIR]: " INPUT_BASE_DIR
BASE_DIR=${INPUT_BASE_DIR:-$DEFAULT_BASE_DIR}

echo "Note: The project will be created under $BASE_DIR/"
read -p "Project [$DEFAULT_PROJECT_NAME]: " INPUT_PROJECT_NAME
PROJECT_NAME=${INPUT_PROJECT_NAME:-$DEFAULT_PROJECT_NAME}

read -p "DB Name [$PROJECT_NAME]: " INPUT_DB_NAME
DB_NAME=${INPUT_DB_NAME:-$PROJECT_NAME}

read -p "DB User [$DEFAULT_DB_USER]: " INPUT_DB_USER
DB_USER=${INPUT_DB_USER:-$DEFAULT_DB_USER}

read -sp "DB Password [$DEFAULT_DB_PASSWORD]: " INPUT_DB_PASSWORD
echo "" # Move to a new line after hidden password input
DB_PASSWORD=${INPUT_DB_PASSWORD:-$DEFAULT_DB_PASSWORD}

echo "Note: Swap provides emergency RAM using disk space to prevent crashes."
read -p "Swap Size [$DEFAULT_SWAP_SIZE]: " INPUT_SWAP_SIZE
SWAP_SIZE=${INPUT_SWAP_SIZE:-$DEFAULT_SWAP_SIZE}

# Fixed path based on project name and base directory
PROJECT_PATH="$BASE_DIR/$PROJECT_NAME"
LOG_PATH="/var/log/$PROJECT_NAME"

# Determine the actual user if running with sudo
ACTUAL_USER=${SUDO_USER:-$USER}

echo "----------------------------"
echo "Setup server (v1.3.2)..."
echo "Project:     $PROJECT_NAME"
echo "Directory:   $PROJECT_PATH"
echo "DB Name:     $DB_NAME"
echo "DB User:     $DB_USER"
echo "DB Password: [HIDDEN]"
echo "Swap Size:   $SWAP_SIZE"
echo "Actual user: $ACTUAL_USER"
echo "----------------------------"

# Final confirmation prompt
read -p "Do you want to continue with the installation? (y/n): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo "Installation cancelled by user."
    exit 1
fi


echo "Done"