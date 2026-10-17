#!/usr/bin/env bash
# Shape the Pi's uplink so the network model sees genuinely degraded conditions.
#
# Safe to run over SSH, unlike network_simulator.py's OFFLINE profile:
#   * SSH egress (sport 22) is filtered into an UNSHAPED prio band, so your
#     session survives even at the SEVERE profile.
#   * A detached dead-man timer removes the qdisc after TTL seconds, so a
#     dropped session cannot leave the Pi shaped forever.
#   * The interface is never taken down.
#
# tc root qdiscs are EGRESS only. Delay is applied on the way out, so a
# `delay 300ms` profile shows as roughly +300ms of ping RTT, not +600ms.
#
# Usage:
#   sudo ./tc_shape.sh status
#   sudo ./tc_shape.sh apply DEGRADED
#   sudo ./tc_shape.sh apply SEVERE --iface eth0 --ttl 600
#   sudo ./tc_shape.sh clear
set -euo pipefail

TTL=900
IFACE=""
ACTION="${1:-status}"
PROFILE="${2:-}"
[[ "${PROFILE}" == --* ]] && PROFILE=""

shift $(( $# > 0 ? 1 : 0 )) || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --iface) IFACE="$2"; shift 2 ;;
    --ttl)   TTL="$2";   shift 2 ;;
    *)       shift ;;
  esac
done

# The default-route interface. network_simulator.py's get_active_interface()
# probes wlan0 BEFORE eth0, so on a wired Pi whose wlan0 merely exists it
# shapes the wrong link and nothing appears to happen. Ask the routing table.
if [[ -z "$IFACE" ]]; then
  IFACE=$(ip -o route get 8.8.8.8 2>/dev/null | sed -n 's/.* dev \([^ ]*\).*/\1/p' | head -1)
fi
[[ -n "$IFACE" ]] || { echo "Could not determine interface; pass --iface" >&2; exit 1; }

# rate  delay  jitter  loss
# STABLE/DEGRADED/CRITICAL match PROFILES in network_simulator.py.
# SEVERE is added because CRITICAL does NOT cross label_network_state()'s
# CRITICAL thresholds: 300ms/8% only clears the DEGRADED bars (rtt>=300,
# loss>=5). Reaching CRITICAL needs rtt>=1000 or loss>=15.
profile_params() {
  case "$1" in
    # rate delay jitter loss burst  — burst must be >= rate/HZ, and never
    # below one MTU, or tbf either warns or shapes far under the target rate.
    STABLE)   echo "50mbit 10 2 0 256kbit" ;;
    DEGRADED) echo "5mbit 80 20 1.5 32kbit" ;;
    CRITICAL) echo "512kbit 300 80 8 16kbit" ;;
    SEVERE)   echo "256kbit 1200 200 25 16kbit" ;;
    *) echo "Unknown profile: $1 (STABLE|DEGRADED|CRITICAL|SEVERE)" >&2; exit 1 ;;
  esac
}

clear_qdisc() {
  tc qdisc del dev "$IFACE" root 2>/dev/null || true
  pkill -f "tc-shape-ttl-$IFACE" 2>/dev/null || true
}

case "$ACTION" in
  status)
    echo "Interface : $IFACE"
    echo "Root qdisc:"; tc qdisc show dev "$IFACE" | sed 's/^/  /'
    echo "Filters   :"; tc filter show dev "$IFACE" 2>/dev/null | sed 's/^/  /'
    ;;

  clear)
    clear_qdisc
    echo "Cleared shaping on $IFACE"
    ;;

  apply)
    [[ -n "$PROFILE" ]] || { echo "apply needs a profile" >&2; exit 1; }
    modprobe sch_netem 2>/dev/null || true
    read -r RATE DELAY JITTER LOSS BURST <<<"$(profile_params "$PROFILE")"
    clear_qdisc

    # band 1:1 = shaped (netem -> tbf), band 1:2 = unshaped SSH escape hatch.
    tc qdisc add dev "$IFACE" root handle 1: prio bands 3
    tc qdisc add dev "$IFACE" parent 1:1 handle 10: netem \
        delay "${DELAY}ms" "${JITTER}ms" distribution normal loss "${LOSS}%"
    # netem is classless but takes one child, so the rate limit hangs off it.
    tc qdisc add dev "$IFACE" parent 10: handle 20: tbf \
        rate "$RATE" burst "$BURST" latency 400ms

    # prio 1 wins: anything leaving from port 22 bypasses the shaper.
    tc filter add dev "$IFACE" protocol ip parent 1:0 prio 1 u32 \
        match ip sport 22 0xffff flowid 1:2
    # Everything else — including ping and the EMQX probe — is shaped.
    tc filter add dev "$IFACE" protocol ip parent 1:0 prio 2 u32 \
        match u32 0 0 flowid 1:1

    # Dead-man switch: detached from this shell so an SSH drop still reverts.
    setsid bash -c "sleep $TTL; tc qdisc del dev $IFACE root 2>/dev/null \
        # tc-shape-ttl-$IFACE" >/dev/null 2>&1 </dev/null &

    echo "Applied $PROFILE on $IFACE  (rate $RATE, delay ${DELAY}ms ±${JITTER}ms, loss ${LOSS}%)"
    echo "SSH on port 22 is unshaped. Auto-clears in ${TTL}s; 'clear' to revert now."
    ;;

  *)
    echo "Usage: sudo $0 {status|apply <STABLE|DEGRADED|CRITICAL|SEVERE>|clear} [--iface X] [--ttl N]" >&2
    exit 1 ;;
esac

