import {
  registerBaseSheetAbilityOrdering,
  registerBaseSheetClassDeletes,
  registerBaseSheetClassDrops,
  registerBaseSheetItemFilters,
} from './adapters/base-sheet.js';
import {
  registerAlternateSheetAbilityOrdering,
  registerAlternateSheetClassDropFix,
  registerAlternateSheetItemFilters,
  registerAlternateSheetVeteranControl,
} from './adapters/alternate-sheet.js';

Hooks.once('ready', async () => {
  if (game.system?.id !== 'blades-in-the-dark') return;

  registerBaseSheetAbilityOrdering();
  registerBaseSheetClassDrops();
  registerBaseSheetItemFilters();
  registerBaseSheetClassDeletes();
  await registerAlternateSheetItemFilters();
  await registerAlternateSheetAbilityOrdering();
  await registerAlternateSheetVeteranControl();
  await registerAlternateSheetClassDropFix();
});
