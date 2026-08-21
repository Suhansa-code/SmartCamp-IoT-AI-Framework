// Network domain data — state/priority/status color maps, QoS routing matrix,
// and the ML feature list shared by the network pages and panels.

import { P } from './theme.data'

export const BLUE = '#60A5FA'

export const STATE_COLOR  = { GOOD: P.green, WEAK: P.amber, POOR: '#F97316', OFFLINE: P.red }
export const PRIO_COLOR   = { CRITICAL: P.red, IMPORTANT: P.amber, ROUTINE: BLUE }
export const STATUS_COLOR = { sent: P.green, buffered: P.amber, dropped: P.red, delayed: P.amber }

export const QOS_MATRIX = {
  CRITICAL:  ['QoS 2', 'QoS 2', 'QoS 2', 'Buffer'],
  IMPORTANT: ['QoS 2', 'QoS 1', 'QoS 1', 'Buffer'],
  ROUTINE:   ['QoS 0', 'QoS 0', 'Drop',  'Drop'],
}

export const FEATURES = [
  { key: 'rtt_avg',     label: 'RTT Average',    importance: 0.18, fmt: (v) => `${v}ms`    },
  { key: 'rtt_max',     label: 'RTT Max',        importance: 0.09, fmt: (v) => `${v}ms`    },
  { key: 'jitter',      label: 'Jitter',         importance: 0.14, fmt: (v) => `${v}ms`    },
  { key: 'packet_loss', label: 'Packet Loss',    importance: 0.22, fmt: (v) => `${v}%`     },
  { key: 'queue_depth', label: 'Queue Depth',    importance: 0.11, fmt: (v) => v           },
  { key: 'queue_delta', label: 'Queue Delta',    importance: 0.13, fmt: (v) => v           },
  { key: 'throughput',  label: 'Throughput',     importance: 0.06, fmt: (v) => `${v}m/s`   },
  { key: 'bandwidth',   label: 'Bandwidth',      importance: 0.04, fmt: (v) => `${v}KB/s`  },
  { key: 'drop_rate',   label: 'Drop Rate',      importance: 0.05, fmt: (v) => `${v}/s`    },
  { key: 'bridge_alive',label: 'Bridge Alive',   importance: 0.19, fmt: (v) => (v ? 'YES' : 'NO') },
]