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
echo "⚠️  WARNING: This modifies user profile attributes in production"
echo "   • Changes are immediate and affect user access/attributes"
echo "   • Ensure you have the correct user list before proceeding"
echo ""
echo "This script updates profile attributes for multiple users."
echo "You can provide user IDs or emails."
echo ""

# Fetch user schema to show available attributes
echo "Fetching available profile attributes from Okta..."
SCHEMA_URL="https://${OKTA_DOMAIN}/api/v1/meta/schemas/user/default"
SCHEMA_RESPONSE=$(curl -s -X GET "$SCHEMA_URL" \
    -H "Accept: application/json" \
    -H "Authorization: SSWS ${OKTA_API_TOKEN}")

# Define standard Okta base attributes
STANDARD_ATTRS="firstName|lastName|email|login|mobilePhone|secondEmail|profileUrl|preferredLanguage|userType|organization|title|displayName|nickName|primaryPhone|streetAddress|city|state|zipCode|countryCode|postalAddress|locale|timezone|employeeNumber|costCenter|division|department|managerId|manager"

# Extract all attributes
ALL_ATTRS=$(echo "$SCHEMA_RESPONSE" | grep -o '"[^"]*":' | grep -v '"id"\|"status"\|"created"\|"lastUpdated"' | tr -d '":' | sort -u)

# Categorize attributes
STANDARD_LIST=$(echo "$ALL_ATTRS" | grep -E "^($STANDARD_ATTRS)$")
CUSTOM_LIST=$(echo "$ALL_ATTRS" | grep -vE "^($STANDARD_ATTRS)$")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STANDARD OKTA ATTRIBUTES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -n "$STANDARD_LIST" ]; then
    echo "$STANDARD_LIST" | column
else
    echo "(none found)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CUSTOM ATTRIBUTES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -n "$CUSTOM_LIST" ]; then
    echo "$CUSTOM_LIST" | column
else
    echo "(none found - add in: Admin Console → Directory → Profile Editor)"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
read -p "Enter the attribute name to update: " ATTRIBUTE_NAME
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
echo "=== IMPACT SUMMARY ==="
echo "Attribute: $ATTRIBUTE_NAME"
echo "New Value: $ATTRIBUTE_VALUE"
echo "Affected Users: ${#users[@]}"
echo ""
echo "Users to be updated:"
for user in "${users[@]}"; do
    echo "  - $user"
done
echo ""
read -p "⚠️  Proceed with updating ${#users[@]} users? (yes/no): " CONFIRM
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
