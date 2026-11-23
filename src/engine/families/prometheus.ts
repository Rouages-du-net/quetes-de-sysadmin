// The prometheus family (see families.ts): Prometheus and the Alertmanager ("The Bike Share"): promtool, amtool, the daemons, curl towards the metrics.

import { PROMETHEUS_COMMANDS, metricsCurl } from '../commands/prometheus';
import { registerFamily } from '../families';

export const HOOKS = { metricsCurl };

registerFamily('prometheus', PROMETHEUS_COMMANDS, HOOKS);
