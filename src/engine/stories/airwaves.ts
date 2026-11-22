// The chapters of the story "airwaves", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { expiryDate } from '../chapters/expiry-date';
import { chainOfTrust } from '../chapters/chain-of-trust';
import { stolenLaptop } from '../chapters/stolen-laptop';

export const chapters: Chapter[] = [expiryDate, chainOfTrust, stolenLaptop];
