import { describe, it, expect } from 'vitest';
import uiReducer, { openModal, closeModal, showToast, clearToast, selectModal, selectToast } from './uiSlice';

function wrap(state) {
  return { ui: state };
}

describe('uiSlice', () => {
  it('starts with no modal and no toast', () => {
    const state = uiReducer(undefined, { type: '@@init' });
    expect(selectModal(wrap(state))).toEqual({ type: null, props: {} });
    expect(selectToast(wrap(state))).toEqual({ id: null, message: '' });
  });

  it('openModal sets the type and props, defaulting props to {}', () => {
    let state = uiReducer(undefined, openModal({ type: 'confirm', props: { title: 'Sure?' } }));
    expect(selectModal(wrap(state))).toEqual({ type: 'confirm', props: { title: 'Sure?' } });

    state = uiReducer(undefined, openModal({ type: 'confirm' }));
    expect(selectModal(wrap(state))).toEqual({ type: 'confirm', props: {} });
  });

  it('closeModal resets to the empty modal state', () => {
    const opened = uiReducer(undefined, openModal({ type: 'confirm', props: { a: 1 } }));
    const closed = uiReducer(opened, closeModal());
    expect(selectModal(wrap(closed))).toEqual({ type: null, props: {} });
  });

  it('showToast assigns a unique id to each toast', () => {
    const first = uiReducer(undefined, showToast('Saved.'));
    const second = uiReducer(first, showToast('Saved again.'));
    expect(selectToast(wrap(first)).message).toBe('Saved.');
    expect(selectToast(wrap(second)).message).toBe('Saved again.');
    expect(selectToast(wrap(first)).id).not.toBe(selectToast(wrap(second)).id);
  });

  it('clearToast resets to the empty toast state', () => {
    const shown = uiReducer(undefined, showToast('Hi'));
    const cleared = uiReducer(shown, clearToast());
    expect(selectToast(wrap(cleared))).toEqual({ id: null, message: '' });
  });
});
