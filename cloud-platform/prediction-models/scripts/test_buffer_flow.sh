#!/bin/bash
# Full end-to-end test: apply tc → model detects CRITICAL → send messages → buffer fills
#
# Usage: sudo bash test_buffer_flow.sh
# Cleanup: sudo bash test_buffer_flow.sh --cleanup

IFACE="wlp3s0"
BACKEND="http://localhost:5000"
MONITOR_DIR="$(dirname "$0")/.."

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'; BOLD='\033[1m'

cleanup() {
  echo -e "\n${YELLOW}[cleanup] Removing tc rules from $IFACE...${NC}"
  tc qdisc del dev "$IFACE" root 2>/dev/null
  echo -e "${GREEN}[cleanup] Done. Network restored.${NC}"
  # Push STABLE back so backend resets
  curl -s -X POST "$BACKEND/api/network/state" \
    -H "Content-Type: application/json" \
    -d '{"state":"STABLE"}' > /dev/null
  echo -e "${GREEN}[cleanup] Backend state reset to STABLE.${NC}"
}

if [[ "$1" == "--cleanup" ]]; then
  cleanup; exit 0
fi

if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}Run with sudo: sudo bash $0${NC}"; exit 1
fi

echo -e "${BOLD}=== SmartCamp Buffer Flow Test ===${NC}\n"

# ── Step 1: Apply tc rules ────────────────────────────────────────────────────
echo -e "${BOLD}[1/5] Applying tc rules (1100ms delay + 20% loss)...${NC}"
tc qdisc del dev "$IFACE" root 2>/dev/null
tc qdisc add dev "$IFACE" root netem delay 1100ms loss 20%
echo "     tc: $(tc qdisc show dev $IFACE)"

# ── Step 2: Verify RTT is actually high ───────────────────────────────────────
echo -e "\n${BOLD}[2/5] Measuring ping after tc (takes ~15s)...${NC}"
PING_OUT=$(ping -c 5 -W 5 8.8.8.8 2>&1)
echo "$PING_OUT" | tail -3
RTT=$(echo "$PING_OUT" | grep -oP 'avg/max/mdev = [\d.]+/\K[\d.]+' 2>/dev/null || echo "999")
LOSS=$(echo "$PING_OUT" | grep -oP '[\d.]+(?=% packet loss)' | head -1 || echo "0")
echo -e "     RTT=${RTT}ms  Loss=${LOSS}%"

# ── Step 3: Push CRITICAL state directly (bypass 30s monitor wait) ───────────
echo -e "\n${BOLD}[3/5] Pushing CRITICAL state to backend (simulating model output)...${NC}"
curl -s -X POST "$BACKEND/api/network/state" \
  -H "Content-Type: application/json" \
  -d "{\"state\":\"CRITICAL\",\"metrics\":{\"rtt_avg\":$RTT,\"rtt_max\":1800,\"packet_loss\":$LOSS,\"jitter\":200,\"bandwidth\":0.4,\"bridge_alive\":true,\"queue_depth\":180}}"
echo ""

STATE=$(curl -s "$BACKEND/api/network/status" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['state'])" 2>/dev/null)
echo -e "     Backend state is now: ${RED}$STATE${NC}"

# ── Step 4: Send test messages to fill the buffer ─────────────────────────────
echo -e "\n${BOLD}[4/5] Sending test messages (should buffer LOW/MEDIUM/HIGH)...${NC}"
for i in 1 2 3; do
  curl -s -X POST "$BACKEND/api/network/state" \
    -H "Content-Type: application/json" \
    -d '{"state":"CRITICAL"}' > /dev/null

  # Trigger a forecast (MEDIUM/HIGH priority message through SAAMP)
  RESULT=$(curl -s "$BACKEND/api/prediction/forecast?days=1" 2>/dev/null)
  STATUS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null)
  echo "     Message $i → status: $STATUS"
  sleep 1
done

# ── Step 5: Check buffer count ────────────────────────────────────────────────
echo -e "\n${BOLD}[5/5] Checking buffer...${NC}"
STATUS_JSON=$(curl -s "$BACKEND/api/network/status")
BUFFERED=$(echo "$STATUS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['buffered_messages'])" 2>/dev/null)
echo -e "     Buffered messages: ${YELLOW}$BUFFERED${NC}"

if [[ "$BUFFERED" -gt 0 ]]; then
  echo -e "\n${GREEN}SUCCESS — buffer has $BUFFERED message(s).${NC}"
  echo -e "${GREEN}In the frontend Network QoS tab you should see the orange buffer counter.${NC}"
else
  echo -e "\n${YELLOW}Buffer is 0 — messages may have been published as CRITICAL priority.${NC}"
  echo -e "${YELLOW}Try a checkin/registration in the frontend while the CRITICAL state is active.${NC}"
fi

echo -e "\n${BOLD}To restore network:${NC}  sudo bash $0 --cleanup"
