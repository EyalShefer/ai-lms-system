#!/bin/bash
# Comprehensive Bagrut Seeder Runner
# סקריפט להרצת מערכת האכלוס בצורה יציבה

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "========================================"
echo "  Comprehensive Bagrut Content Seeder"
echo "  מערכת אכלוס תוכן בגרויות"
echo "========================================"
echo -e "${NC}"

# Check for GEMINI_API_KEY
if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}Error: GEMINI_API_KEY environment variable not set${NC}"
    echo "Set it with: export GEMINI_API_KEY=your-api-key"
    exit 1
fi

# Change to functions directory
cd "$(dirname "$0")/../.." || exit 1

# Log file
LOG_DIR="logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/bagrut_seeding_$(date +%Y%m%d_%H%M%S).log"

echo -e "${GREEN}Starting seeder at $(date)${NC}"
echo -e "${YELLOW}Logging to: $LOG_FILE${NC}"
echo ""

# Parse arguments
ARGS=""
if [ "$1" == "--resume" ]; then
    ARGS="--resume"
    echo -e "${BLUE}Mode: RESUME (continuing from last progress)${NC}"
elif [ "$1" == "--dry-run" ]; then
    ARGS="--dry-run"
    echo -e "${BLUE}Mode: DRY RUN (no actual changes)${NC}"
elif [ -n "$1" ]; then
    ARGS="$1"
    echo -e "${BLUE}Mode: Custom ($1)${NC}"
else
    echo -e "${BLUE}Mode: FULL SEEDING${NC}"
fi

echo ""
echo -e "${YELLOW}Press Ctrl+C to stop at any time (progress is saved)${NC}"
echo ""

# Run the seeder with logging
npx ts-node src/scripts/comprehensiveBagrutSeeder.ts $ARGS 2>&1 | tee "$LOG_FILE"

# Check exit status
EXIT_CODE=${PIPESTATUS[0]}

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}========================================"
    echo "  Seeding completed successfully!"
    echo "========================================${NC}"
else
    echo -e "${RED}========================================"
    echo "  Seeding finished with errors (exit code: $EXIT_CODE)"
    echo "  Check log file: $LOG_FILE"
    echo "  Run with --resume to continue"
    echo "========================================${NC}"
fi

echo ""
echo "Log saved to: $LOG_FILE"
echo "Progress saved to: src/scripts/bagrut_seeding_progress.json"
