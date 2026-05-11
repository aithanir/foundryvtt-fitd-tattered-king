import { openFormDialog } from '../../../../systems/blades-in-the-dark/module/lib/dialog-compat.js';
import { CLASSES_PACK, escapeHtml, localize, normalizeName } from '../shared.js';
import { switchBaseSheetInvestigatorClass } from '../core/actor-class.js';
import { getInvestigatorPackEntries } from '../core/investigator-items.js';

export async function openInvestigatorClassDialog(actor) {
  if (!actor?.isOwner) return;

  const classes = sortByName(await getInvestigatorPackEntries('class', CLASSES_PACK));
  const content = `
    <form class="items-to-add">
      <div class="items-list">
        <div class="item-group">
          <header>${escapeHtml(game.i18n.localize('BITD.Class'))}</header>
          ${classes
            .map(
              (classItem) => `
                <div class="item-block">
                  <input
                    id="select-class-${escapeHtml(classItem.id)}"
                    type="radio"
                    name="select_class"
                    value="${escapeHtml(classItem.id)}"
                  >
                  <label for="select-class-${escapeHtml(classItem.id)}">
                    ${escapeHtml(classItem.name)}
                  </label>
                </div>
              `
            )
            .join('')}
        </div>
      </div>
    </form>
  `;
  const result = await openFormDialog({
    title: localize('ClassDialogTitle'),
    content,
    okLabel: game.i18n.localize('Add'),
    cancelLabel: game.i18n.localize('Cancel'),
  });
  if (!result?.select_class) return;

  const classItem = classes.find((item) => item.id === result.select_class);
  if (!classItem) return;

  await switchBaseSheetInvestigatorClass(actor, classItem);
}

function sortByName(items) {
  return items.sort((a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name)));
}
