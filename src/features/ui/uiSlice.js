import { createSlice, nanoid } from '@reduxjs/toolkit';

/**
 * Cross-cutting UI chrome: the single modal host and the toast host.
 * `modal.type` is a key into the MODAL_COMPONENTS registry in
 * components/Modal.jsx; `modal.props` are passed straight through — this
 * mirrors the artifact's single `openModal(html, handlers)` host but keeps
 * the actual dialog markup as ordinary React components.
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    modal: { type: null, props: {} },
    toast: { id: null, message: '' },
  },
  reducers: {
    openModal(state, action) {
      const { type, props = {} } = action.payload;
      state.modal = { type, props };
    },
    closeModal(state) {
      state.modal = { type: null, props: {} };
    },
    showToast: {
      reducer(state, action) {
        state.toast = action.payload;
      },
      prepare(message) {
        return { payload: { id: nanoid(), message } };
      },
    },
    clearToast(state) {
      state.toast = { id: null, message: '' };
    },
  },
});

export const { openModal, closeModal, showToast, clearToast } = uiSlice.actions;
export default uiSlice.reducer;

export const selectModal = (state) => state.ui.modal;
export const selectToast = (state) => state.ui.toast;
