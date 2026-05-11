import { MODULE_ID } from './shared.js';

export function wrapMethod(target, methodName, wrapper, options = {}) {
  if (typeof target?.[methodName] !== 'function') {
    warnMissingMethod(options.label ?? methodName);
    return false;
  }

  if (options.libWrapperTarget && isLibWrapperActive()) {
    try {
      const wrapperType = options.type ?? 'WRAPPER';
      libWrapper.register(
        MODULE_ID,
        options.libWrapperTarget,
        wrapper,
        libWrapper[wrapperType] ?? wrapperType
      );
      return true;
    } catch (error) {
      console.warn(
        `${MODULE_ID} | libWrapper could not wrap ${options.libWrapperTarget}; using direct wrapper fallback.`,
        error
      );
    }
  }

  wrapDirectly(target, methodName, wrapper);
  return true;
}

function isLibWrapperActive() {
  return (
    game.modules.get('lib-wrapper')?.active && typeof globalThis.libWrapper?.register === 'function'
  );
}

function wrapDirectly(target, methodName, wrapper) {
  const original = target[methodName];
  target[methodName] = function (...args) {
    return wrapper.call(this, original.bind(this), ...args);
  };
}

function warnMissingMethod(label) {
  console.warn(`${MODULE_ID} | ${label} was not found; wrapper not registered.`);
}
