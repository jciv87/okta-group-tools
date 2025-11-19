#!/bin/bash

# This script performs the initial setup for the Okta Group Tools.

echo "Starting Okta Group Tools setup..."

# 1. Install Node.js dependencies
echo "Installing dependencies from package.json..."
if npm install; then
    echo "Dependencies installed successfully."
else
    echo "Failed to install dependencies. Please check for errors."
    exit 1
fi

# 2. Set up environment variables
if [ ! -f .env ]; then
    echo "Copying .env.example to .env..."
    cp .env.example .env
    echo "Successfully created .env file."
    echo "IMPORTANT: Please edit the .env file to add your Okta domain and API token."
else
    echo ".env file already exists. Skipping creation."
fi

# 3. Run preflight checks to verify setup
echo "Running preflight checks to validate configuration..."
if npm run preflight; then
    echo "Preflight checks passed successfully."
    echo "Setup is complete! You can now use the tools."
else
    echo "Preflight checks failed. Please review the output above, check your .env configuration, and try again."
    exit 1
fi

exit 0
