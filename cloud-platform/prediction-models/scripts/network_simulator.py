#!/usr/bin/env python3
"""
Network Condition Simulator + Dataset Collector

Creates labelled training data for QoS adaptation by cycling your
laptop's network through different states using 'tc' traffic control.

Usage:
  sudo python3 network_simulator.py              # interactive cycle
  sudo python3 network_simulator.py --auto        # auto-cycle all states
  sudo python3 network_simulator.py --profile DEGRADED  # single state
  sudo python3 network_simulator.py --traffic     # + generate iperf load
  sudo python3 network_simulator.py --cleanup     # remove tc rules

Output: network_simulation_log.csv with labelled ground-truth data.
"""

import argparse
import csv
import datetime
import os
import signal
import subprocess
import sys
import time
import random
import re
import json
from pathlib import Path


PROFILES = {
    'STABLE': {
        'label':       'STABLE',
        'bandwidth':   '50mbit',
        'delay_ms':    10,
        'jitter_ms':   2,
        'loss_pct':    0.0,
        'corrupt_pct': 0.0,
        'description': 'Ideal conditions — fast & reliable',
    },
    'DEGRADED': {
        'label':       'DEGRADED',
        'bandwidth':   '5mbit',
        'delay_ms':    80,
        'jitter_ms':   20,
        'loss_pct':    1.5,
        'corrupt_pct': 0.1,
        'description': 'Congested — high latency, some loss',
    },
    'CRITICAL': {
        'label':       'CRITICAL',
        'bandwidth':   '512kbit',
        'delay_ms':    300,
        'jitter_ms':   80,
        'loss_pct':    8.0,
        'corrupt_pct': 1.0,
        'description': 'Severely degraded — near disconnection',
    },
    'OFFLINE': {
        'label':       'CRITICAL',   # maps to same ML label
        'bandwidth':   '0',
        'delay_ms':    999,
        'jitter_ms':   0,
        'loss_pct':    100.0,
        'corrupt_pct': 0.0,
        'description': 'Interface down — no connectivity',
    },
}

CYCLE_ORDER = ['STABLE', 'DEGRADED', 'CRITICAL', 'STABLE', 'DEGRADED',
               'CRITICAL', 'STABLE', 'DEGRADED', 'STABLE', 'OFFLINE']

LOG_FILE = 'network_simulation_log.csv'
TARGET_HOST = '8.8.8.8'  # for ping measurement
EMQX_HOST = 'i17140d1.ala.asia-southeast1.emqxsl.com'  # your broker



def run(cmd, check=True, timeout=15):
    """Run a shell command and return (returncode, stdout, stderr)."""
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, '', 'timeout'
    except Exception as e:
        return -1, '', str(e)


def get_active_interface():
    """Auto-detect the active network interface (wlan0/eth0 etc)."""
    # Try common interfaces first
    for iface in ['wlan0', 'eth0', 'enp0s3', 'enp2s0', 'wlp2s0', 'enx*', 'wl*']:
        code, _, _ = run(f'ip link show {iface} 2>/dev/null', check=False)
        if code == 0:
            return iface

    # Fallback: find the default route interface
    code, out, _ = run("ip route get 8.8.8.8 2>/dev/null | grep -oP 'dev \\K\\S+'", check=False)
    if code == 0 and out:
        return out
    code, out, _ = run("route -n | grep '^0.0.0.0' | awk '{print $8}' | head -1", check=False)
    if code == 0 and out:
        return out
    return 'wlan0'


def interface_state(iface, up=True):
    """Bring interface up or down."""
    state = 'up' if up else 'down'
    run(f'ip link set {iface} {state}', check=False)


def get_current_qdisc(iface):
    """Check current tc rules on interface."""
    code, out, _ = run(f'tc qdisc show dev {iface}', check=False)
    return out


def apply_profile(iface, profile):
    """Apply tc traffic control rules for a given profile."""
    # Clear existing rules
    run(f'tc qdisc del dev {iface} root 2>/dev/null', check=False)

    if profile['label'] == 'CRITICAL' and profile.get('bandwidth') == '0':
        # OFFLINE: just take interface down
        interface_state(iface, False)
        return {'applied': True, 'method': 'interface_down'}

    # Ensure interface is up
    interface_state(iface, True)
    time.sleep(0.5)

    p = profile

    # Step 1: Add netem (delay, jitter, loss, corrupt)
    netem_parts = []
    if p['delay_ms'] > 0 or p['jitter_ms'] > 0:
        netem_parts.append(f'delay {p["delay_ms"]}ms {p["jitter_ms"]}ms distribution normal')
    if p['loss_pct'] > 0:
        netem_parts.append(f'loss {p["loss_pct"]}%')
    if p['corrupt_pct'] > 0:
        netem_parts.append(f'corrupt {p["corrupt_pct"]}%')

    if netem_parts:
        netem_cmd = f'tc qdisc add dev {iface} root netem {" ".join(netem_parts)}'
        code, _, err = run(netem_cmd, check=False)
        if code != 0:
            print(f"  ⚠ netem failed: {err}")

        # Step 2: Add bandwidth limit on top (tbf = Token Bucket Filter)
        if p['bandwidth'] not in ('0', ''):
            # Need to replace root with a prio qdisc + tbf for bandwidth
            bandwidth_kbps = p['bandwidth'].replace('mbit', '000').replace('kbit', '')
            try:
                bw_val = int(bandwidth_kbps)
                burst = max(bw_val // 10, 1600)
                limit = max(bw_val * 2, 10000)
                run(f'tc qdisc del dev {iface} root 2>/dev/null', check=False)
                run(
                    f'tc qdisc add dev {iface} root handle 1: prio',
                    check=False
                )
                run(
                    f'tc qdisc add dev {iface} parent 1:1 handle 10: netem '
                    f'delay {p["delay_ms"]}ms {p["jitter_ms"]}ms distribution normal '
                    f'loss {p["loss_pct"]}% '
                    f'corrupt {p["corrupt_pct"]}%',
                    check=False
                )
                run(
                    f'tc qdisc add dev {iface} parent 10: handle 20: tbf '
                    f'rate {p["bandwidth"]} burst {burst} latency 400ms',
                    check=False
                )
                # Filter all IP traffic through the shaped class
                run(
                    f'tc filter add dev {iface} protocol ip parent 1:0 prio 1 '
                    f'u32 match ip src 0.0.0.0/0 flowid 1:1',
                    check=False
                )
                return {'applied': True, 'method': 'prio+netem+tbf'}
            except (ValueError, TypeError):
                pass

    return {'applied': True, 'method': 'netem'}


def clear_profile(iface):
    """Remove all tc rules and bring interface up."""
    interface_state(iface, True)
    time.sleep(0.3)
    run(f'tc qdisc del dev {iface} root 2>/dev/null', check=False)
    # Also delete any ingress
    run(f'tc qdisc del dev {iface} ingress 2>/dev/null', check=False)


def measure_ping(count=5, host=TARGET_HOST):
    """Measure RTT and packet loss."""
    code, out, _ = run(f'ping -c {count} -W 3 {host} 2>&1', check=False, timeout=20)
    rtt_avg = 999
    rtt_max = 999
    packet_loss = 100
    jitter = 0

    loss_match = re.search(r'(\d+(?:\.\d+)?)% packet loss', out)
    if loss_match:
        packet_loss = float(loss_match.group(1))

    stats_match = re.search(
        r'rtt min/avg/max/mdev = [\d.]+/([\d.]+)/([\d.]+)/([\d.]+)',
        out
    )
    if stats_match:
        rtt_avg = float(stats_match.group(1))
        rtt_max = float(stats_match.group(2))
        jitter = float(stats_match.group(3))

    return {'rtt_avg': rtt_avg, 'rtt_max': rtt_max,
            'packet_loss': packet_loss, 'jitter': jitter}


def measure_throughput(host=TARGET_HOST, duration=5):
    """Measure bandwidth to a target using iperf3 (TCP)."""
    bw = 0
    code, out, _ = run(
        f'iperf3 -c {host} -t {duration} --omit 1 2>&1',
        check=False, timeout=duration + 10
    )
    bw_match = re.search(r'(\d+(?:\.\d+)?)\s*(Mbits|Kbits)/sec', out)
    if bw_match:
        val = float(bw_match.group(1))
        unit = bw_match.group(2)
        bw = val if unit == 'Mbits' else val / 1000
    return bw


def check_mqtt_broker(host=EMQX_HOST, port=8883):
    """Quick check if EMQX broker is reachable."""
    code, _, _ = run(
        f'echo "x" | timeout 3 bash -c "cat < /dev/null > /dev/tcp/{host}/{port}" 2>/dev/null',
        check=False
    )
    return code == 0


def log_to_csv(log_path, timestamp, profile_label, ping_metrics,
               throughput, broker_reachable, tc_params):
    """Append one labelled row to the CSV dataset."""
    exists = log_path.exists()
    with open(log_path, 'a', newline='') as f:
        w = csv.writer(f)
        if not exists:
            w.writerow([
                'timestamp', 'profile_label',
                'rtt_avg', 'rtt_max', 'packet_loss', 'jitter',
                'bandwidth_mbps', 'throughput_mbps',
                'bridge_alive', 'hour',
                'applied_delay_ms', 'applied_jitter_ms',
                'applied_loss_pct', 'applied_bandwidth',
            ])
        w.writerow([
            timestamp,
            profile_label,
            round(ping_metrics['rtt_avg'], 2),
            round(ping_metrics['rtt_max'], 2),
            round(ping_metrics['packet_loss'], 2),
            round(ping_metrics['jitter'], 2),
            throughput,
            tc_params.get('bandwidth', ''),
            int(broker_reachable),
            datetime.datetime.now().hour,
            tc_params.get('delay_ms', 0),
            tc_params.get('jitter_ms', 0),
            tc_params.get('loss_pct', 0),
            tc_params.get('bandwidth', ''),
        ])

    print(f"  → Logged to {log_path.name}")


def run_cycle(iface, profile_name, profile, duration, with_traffic):
    """Apply a profile, measure, log, wait."""
    print(f"\n{'='*60}")
    print(f"▶ Profile: {profile_name} — {profile['description']}")
    print(f"   {profile.get('bandwidth', 'N/A')} bw | "
          f"{profile.get('delay_ms', 0)}ms delay | "
          f"{profile.get('loss_pct', 0)}% loss")
    print(f"{'='*60}")

    # Apply
    meta = apply_profile(iface, profile)
    if meta['method'] == 'interface_down':
        print("  ⚡ Interface taken down")
    else:
        qdisc = get_current_qdisc(iface)
        qdisc_summary = qdisc.split('\n')[0][:80] if qdisc else 'none'
        print(f"  tc: {qdisc_summary}")

    # Wait for effects to settle
    time.sleep(2)

    # Measure
    print("  Measuring...")
    ping = measure_ping(count=5)
    print(f"  ping → RTT: {ping['rtt_avg']:.1f}ms, loss: {ping['packet_loss']:.1f}%")

    bw = 0
    if with_traffic:
        bw = measure_throughput(duration=5)
        print(f"  iperf3 → {bw:.2f} Mbps")

    broker_up = check_mqtt_broker()
    print(f"  EMQX broker: {'online' if broker_up else 'unreachable'}")

    # Log
    log_to_csv(
        Path(LOG_FILE),
        datetime.datetime.now().isoformat(),
        profile['label'],
        ping,
        bw,
        broker_up,
        profile,
    )

    # Wait for the rest of the duration
    remaining = max(0, duration - 10)
    if remaining > 0:
        print(f"  Holding for {remaining}s...")
        # Measure periodically during hold
        for _ in range(remaining // 10):
            time.sleep(10)
            ping2 = measure_ping(count=2)
            log_to_csv(
                Path(LOG_FILE),
                datetime.datetime.now().isoformat(),
                profile['label'] + '_mid',
                ping2,
                bw,
                broker_up,
                profile,
            )


def setup_signal_handler(iface):
    """Ensure cleanup on Ctrl+C."""
    def handler(signum, frame):
        print("\n\n⚠ Cleaning up tc rules...")
        clear_profile(iface)
        print("Done. Exiting.")
        sys.exit(0)
    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)


def show_status(iface):
    """Show current network state."""
    print(f"\nActive interface: {iface}")
    qdisc = get_current_qdisc(iface)
    if qdisc:
        print(f"tc qdisc:\n  {qdisc.replace(chr(10), chr(10)+'  ')}")
    else:
        print("tc qdisc: (none — default kernel behaviour)")

    ping = measure_ping(count=3)
    print(f"Ping ({TARGET_HOST}): RTT={ping['rtt_avg']}ms, loss={ping['packet_loss']}%")

    broker = check_mqtt_broker()
    print(f"EMQX broker: {'✓ online' if broker else '✗ unreachable'}")

    print(f"\nLog file: {LOG_FILE} ({Path(LOG_FILE).stat().st_size if Path(LOG_FILE).exists() else 0} bytes)")


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Network Condition Simulator for QoS Dataset Creation',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  sudo %(prog)s --interactive     # step through each profile manually
  sudo %(prog)s --auto             # auto-cycle all profiles (5min each)
  sudo %(prog)s --auto --traffic   # same + iperf3 traffic generation
  sudo %(prog)s --profile STABLE   # set a single profile and hold
  sudo %(prog)s --cleanup          # remove all tc rules
  sudo %(prog)s --status           # show current network state
  sudo %(prog)s --random --hours 2 # random profile cycling for 2 hours
        """
    )
    parser.add_argument('--iface', default=None,
                        help='Network interface (auto-detect if not set)')
    parser.add_argument('--auto', action='store_true',
                        help='Auto-cycle through all profiles')
    parser.add_argument('--interactive', action='store_true',
                        help='Step through profiles one at a time')
    parser.add_argument('--profile', default=None,
                        choices=list(PROFILES.keys()),
                        help='Apply a single profile and hold')
    parser.add_argument('--duration', type=int, default=60,
                        help='Seconds per profile (default: 60)')
    parser.add_argument('--traffic', action='store_true',
                        help='Generate iperf3 traffic during measurement')
    parser.add_argument('--cleanup', action='store_true',
                        help='Remove all tc rules and exit')
    parser.add_argument('--status', action='store_true',
                        help='Show current network state')
    parser.add_argument('--random', action='store_true',
                        help='Random profile cycling')
    parser.add_argument('--hours', type=float, default=1.0,
                        help='Total hours for random cycling (default: 1)')
    parser.add_argument('--samples', type=int, default=0,
                        help='Override: set exact number of samples to collect')

    args = parser.parse_args()

    # Auto-detect interface
    iface = args.iface or get_active_interface()
    print(f"Interface: {iface}")

    setup_signal_handler(iface)

    # ── Cleanup ─────────────────────────────────────────
    if args.cleanup:
        clear_profile(iface)
        print("All tc rules cleared.")
        return

    # ── Status ──────────────────────────────────────────
    if args.status:
        show_status(iface)
        return

    # ── Single profile ──────────────────────────────────
    if args.profile:
        profile = PROFILES[args.profile]
        run_cycle(iface, args.profile, profile, args.duration, args.traffic)
        return

    # ── Interactive ──────────────────────────────────────
    if args.interactive:
        print("\nInteractive mode — press Enter to advance, 'q' to quit\n")
        for name in PROFILES:
            print(f"\nNext: {name} — {PROFILES[name]['description']}")
            inp = input("Apply? [Enter=yes, s=skip, q=quit]: ")
            if inp.lower() == 'q':
                break
            if inp.lower() == 's':
                continue
            run_cycle(iface, name, PROFILES[name], args.duration, args.traffic)
            input("Press Enter to continue...")
        return

    # ── Auto cycle ───────────────────────────────────────
    if args.auto:
        total = len(CYCLE_ORDER)
        print(f"\nAuto-cycling {total} profiles ({args.duration}s each = "
              f"{total * args.duration // 60} min total)")
        for i, name in enumerate(CYCLE_ORDER):
            print(f"\n--- [{i+1}/{total}] ---")
            run_cycle(iface, name, PROFILES[name], args.duration, args.traffic)
        print("\n✓ Cycle complete!")
        return

    # ── Random cycling ──────────────────────────────────
    if args.random:
        total_seconds = int(args.hours * 3600)
        names = list(PROFILES.keys())
        counts = {n: 0 for n in names}
        elapsed = 0
        sample_count = 0
        max_samples = args.samples or 999999

        print(f"\nRandom cycling for {args.hours}h (max {max_samples} samples)")
        print(f"{'='*60}")

        while elapsed < total_seconds and sample_count < max_samples:
            name = random.choice(names)
            counts[name] += 1
            dur = random.randint(max(10, args.duration // 2),
                                 args.duration * 2)
            sample_count += 1
            run_cycle(iface, name, PROFILES[name], dur, args.traffic)
            elapsed += dur + 12  # + overhead

        print(f"\n✓ Random cycling complete!")
        print(f"Profile distribution: {counts}")
        print(f"Total samples logged: {sample_count}")
        total_rows = 0
        if Path(LOG_FILE).exists():
            with open(LOG_FILE) as f:
                total_rows = sum(1 for _ in f) - 1  # - header
        print(f"Total rows in {LOG_FILE}: {total_rows}")
        return

    # ── Default: show help ──────────────────────────────
    parser.print_help()


if __name__ == '__main__':
    main()
