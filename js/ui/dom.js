// Small DOM helpers: element builder, dialogs and toasts.
import { titleCase } from './format.js';

const PROPERTY_KEYS = new Set(['value', 'checked', 'selected', 'disabled', 'open']);

// h('button', { class: 'btn', onClick: fn }, 'Save') — text children are always inserted as text.
// Dropdown options and groups are shown in Title Case everywhere (values are unchanged).
export function h(tag, props = {}, ...children) {
  if (tag === 'option' || tag === 'optgroup') {
    children = children.map((c) => (typeof c === 'string' ? titleCase(c) : c));
    if (props?.label) props = { ...props, label: titleCase(props.label) };
  }
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (PROPERTY_KEYS.has(key)) el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  appendChildren(el, children);
  return el;
}

// Replaces el's contents. Accepts nested arrays and skips null/false, like h().
export function mount(el, ...children) {
  el.replaceChildren();
  appendChildren(el, children);
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Builds an SVG element (namespaced). Attributes are set as-is.
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) if (value != null) el.setAttribute(key, value);
  appendChildren(el, children);
  return el;
}

// Opens a modal. build(close) returns the dialog's content; call close(value) to resolve the promise.
// Pressing Escape resolves with undefined unless `required` is set.
export function showDialog(build, { required = false } = {}) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'dialog' });
    let result;
    const close = (value) => {
      result = value;
      dialog.close();
    };
    if (required) dialog.addEventListener('cancel', (e) => e.preventDefault());
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });
    dialog.append(build(close));
    document.body.append(dialog);
    dialog.showModal();
  });
}

export function confirmDialog(message, { title = 'Are you sure?', okLabel = 'OK', danger = false } = {}) {
  return showDialog((close) =>
    h('div', { class: 'dialog-body' },
      h('h2', {}, title),
      h('p', {}, message),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => close(false) }, 'Cancel'),
        h('button', { class: danger ? 'btn btn-danger' : 'btn btn-primary', type: 'button', onClick: () => close(true) }, okLabel),
      ),
    ),
  ).then(Boolean);
}

// A message with a single OK button.
export function infoDialog(message, { title }) {
  return showDialog((close) =>
    h('div', { class: 'dialog-body' },
      h('h2', {}, title),
      h('p', {}, message),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => close() }, 'OK'))));
}

export function toast(message) {
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.classList.add('toast-out'), 2200);
  setTimeout(() => el.remove(), 2600);
}
