#!/bin/bash
#
# GCP Budget Alerts Setup Script
#
# This script creates budget alerts for your GCP project to prevent
# unexpected billing surprises.
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Billing account linked to project
# - roles/billing.admin or roles/billing.costsManager permission
#
# Usage:
#   chmod +x scripts/setup-budget-alerts.sh
#   ./scripts/setup-budget-alerts.sh [PROJECT_ID] [BUDGET_AMOUNT]
#
# Example:
#   ./scripts/setup-budget-alerts.sh ai-lms-pro 500
#

set -e

# Configuration
PROJECT_ID="${1:-ai-lms-pro}"
BUDGET_AMOUNT="${2:-500}"  # Monthly budget in USD
NOTIFICATION_EMAIL="${3:-alerts@yourdomain.com}"

echo "🔧 Setting up GCP Budget Alerts for project: $PROJECT_ID"
echo "   Monthly budget: \$$BUDGET_AMOUNT USD"
echo ""

# Get billing account
echo "📋 Fetching billing account..."
BILLING_ACCOUNT=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingAccountName)" 2>/dev/null | sed 's/billingAccounts\///')

if [ -z "$BILLING_ACCOUNT" ]; then
    echo "❌ Error: Could not find billing account for project $PROJECT_ID"
    echo "   Make sure the project has billing enabled."
    exit 1
fi

echo "   Billing account: $BILLING_ACCOUNT"

# Create notification channel (email)
echo ""
echo "📧 Creating notification channel..."

CHANNEL_NAME="budget-alert-email"
EXISTING_CHANNEL=$(gcloud alpha monitoring channels list \
    --project="$PROJECT_ID" \
    --filter="displayName=$CHANNEL_NAME" \
    --format="value(name)" 2>/dev/null || echo "")

if [ -z "$EXISTING_CHANNEL" ]; then
    gcloud alpha monitoring channels create \
        --project="$PROJECT_ID" \
        --display-name="$CHANNEL_NAME" \
        --type="email" \
        --channel-labels="email_address=$NOTIFICATION_EMAIL" \
        --enabled
    echo "   ✅ Created email notification channel"
else
    echo "   ⏭️  Email notification channel already exists"
fi

# Create Pub/Sub topic for programmatic alerts
echo ""
echo "📡 Creating Pub/Sub topic for alerts..."

TOPIC_NAME="budget-alerts"
if gcloud pubsub topics describe "$TOPIC_NAME" --project="$PROJECT_ID" &>/dev/null; then
    echo "   ⏭️  Pub/Sub topic already exists"
else
    gcloud pubsub topics create "$TOPIC_NAME" --project="$PROJECT_ID"
    echo "   ✅ Created Pub/Sub topic: $TOPIC_NAME"
fi

# Create budget with alerts at 50%, 80%, 100%, 120%
echo ""
echo "💰 Creating budget with alerts..."

# Budget display name
BUDGET_NAME="${PROJECT_ID}-monthly-budget"

# Create budget using gcloud
cat > /tmp/budget.json << EOF
{
  "displayName": "$BUDGET_NAME",
  "budgetFilter": {
    "projects": ["projects/$PROJECT_ID"]
  },
  "amount": {
    "specifiedAmount": {
      "currencyCode": "USD",
      "units": "$BUDGET_AMOUNT"
    }
  },
  "thresholdRules": [
    {
      "thresholdPercent": 0.5,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 0.8,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 1.0,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 1.2,
      "spendBasis": "CURRENT_SPEND"
    }
  ],
  "notificationsRule": {
    "pubsubTopic": "projects/$PROJECT_ID/topics/$TOPIC_NAME",
    "schemaVersion": "1.0",
    "monitoringNotificationChannels": [],
    "enableProjectLevelRecipients": true
  }
}
EOF

echo "   Creating budget via API..."
echo "   (Note: You may need to create this manually in Cloud Console if API is not enabled)"

# Try to create budget via REST API
ACCESS_TOKEN=$(gcloud auth print-access-token)
RESPONSE=$(curl -s -X POST \
    "https://billingbudgets.googleapis.com/v1/billingAccounts/$BILLING_ACCOUNT/budgets" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d @/tmp/budget.json)

if echo "$RESPONSE" | grep -q "error"; then
    echo "   ⚠️  Could not create budget via API."
    echo "   Please create manually in Cloud Console:"
    echo "   1. Go to: https://console.cloud.google.com/billing/budgets"
    echo "   2. Click 'Create Budget'"
    echo "   3. Set amount to \$$BUDGET_AMOUNT"
    echo "   4. Add thresholds: 50%, 80%, 100%, 120%"
    echo "   5. Enable email notifications"
else
    echo "   ✅ Budget created successfully!"
fi

rm -f /tmp/budget.json

# Create Cloud Function to handle budget alerts (optional)
echo ""
echo "📋 Summary:"
echo "   ✅ Project: $PROJECT_ID"
echo "   ✅ Budget: \$$BUDGET_AMOUNT/month"
echo "   ✅ Alerts at: 50%, 80%, 100%, 120%"
echo "   ✅ Pub/Sub topic: $TOPIC_NAME"
echo ""
echo "🔔 To receive email alerts:"
echo "   1. Go to Cloud Console > Billing > Budgets"
echo "   2. Edit the budget"
echo "   3. Add your email under 'Manage notifications'"
echo ""
echo "📚 Documentation: https://cloud.google.com/billing/docs/how-to/budgets"
