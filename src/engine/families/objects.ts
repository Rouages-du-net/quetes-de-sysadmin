// The objects family (see families.ts): S3 object storage ("The Dance
// Troupe"): Garage's CLI, the AWS CLI (aws s3, aws s3api, aws configure),
// rclone, and curl towards the cluster's endpoints, with their model
// (garage.ts, objects-client.ts).

import type { Command } from '../commands/index';
import { OBJECTS_PROGRAMS, s3Curl } from '../objects-client';
import { registerFamily } from '../families';

export const HOOKS = { s3Curl };

registerFamily(
  'objects',
  Object.fromEntries(Object.entries(OBJECTS_PROGRAMS).map(([name, launch]) => [name, { ownOptions: true, launch } satisfies Command])),
  HOOKS,
);
