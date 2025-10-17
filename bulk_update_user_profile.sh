#!/bin/bash

# Bulk User Profile Updater
# Updates a custom profile attribute for multiple Okta users
# Usage: ./bulk_update_user_profile.sh

set -e

# --- CONFIGURATION ---
# Load environment variables from .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "Error: .env file not found. Please create one with OKTA_DOMAIN and OKTA_API_TOKEN"
    exit 1
fi

# Validate required environment variables
if [ -z "$OKTA_DOMAIN" ] || [ -z "$OKTA_API_TOKEN" ]; then
    echo "Error: OKTA_DOMAIN and OKTA_API_TOKEN must be set in .env"
    exit 1
fi

# --- USER INPUT ---
echo "=== Bulk User Profile Updater ==="
echo ""
echo "This script updates custom profile attributes for multiple users."
echo "You can provide user IDs or emails."
echo ""
read -p "Enter the profile attribute name (e.g., rip_employee): " ATTRIBUTE_NAME
read -p "Enter the value (true/false for boolean, or text): " ATTRIBUTE_VALUE

# Convert string "true"/"false" to JSON boolean
if [ "$ATTRIBUTE_VALUE" = "true" ] || [ "$ATTRIBUTE_VALUE" = "false" ]; then
    JSON_VALUE="$ATTRIBUTE_VALUE"
else
    JSON_VALUE="\"$ATTRIBUTE_VALUE\""
fi

echo ""
echo "Enter user IDs or emails (one per line, empty line to finish):"
users=()
while IFS= read -r line; do
    [ -z "$line" ] && break
    users+=("$line")
done

if [ ${#users[@]} -eq 0 ]; then
    echo "No users provided. Exiting."
    exit 0
fi

# --- CONFIRMATION ---
echo ""
echo "Will update ${#users[@]} users with: $ATTRIBUTE_NAME = $ATTRIBUTE_VALUE"
echo ""
read -p "Proceed? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ] && [ "$CONFIRM" != "y" ]; then
    echo "Operation cancelled."
    exit 0
fi

# --- SCRIPT LOGIC ---
json_payload="{\"profile\": {\"$ATTRIBUTE_NAME\": $JSON_VALUE}}"

echo ""
echo "=== Processing Users ==="
success_count=0
fail_count=0

for user in "${users[@]}"; do
    echo "Updating user: $user"
    
    API_URL="https://${OKTA_DOMAIN}/api/v1/users/${user}"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
        -H "Accept: application/json" \
        -H "Content-Type: application/json" \
        -H "Authorization: SSWS ${OKTA_API_TOKEN}" \
        -d "$json_payload")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ]; then
        echo "✓ Successfully updated $user"
        ((success_count++))
    else
        echo "✗ Failed to update $user. Status: $http_code"
        echo "  Response: $body"
        ((fail_count++))
    fi
    
    echo "---------------------------------"
done

echo ""
echo "=== Summary ==="
echo "Success: $success_count"
echo "Failed: $fail_count"
echo "Total: ${#users[@]}"
