/**
 * Program seed for `program_slots`. The data itself lives in src/lib/program.ts
 * so the pure libs (parser, engine) can share it; this file is the seed entry
 * point the import script uses.
 */
export { PROGRAM_SLOTS, DAYS, DAY_LABEL, findSlot, parseDay } from '../../src/lib/program.ts'
export type { Day, ProgramSlot } from '../../src/lib/program.ts'
